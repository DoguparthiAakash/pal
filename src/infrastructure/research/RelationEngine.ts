import { adminClient as supabase } from '@/infrastructure/auth/admin';

export interface DocumentRelation {
  id: string;
  source_doc_id: string;
  source_doc_title: string;
  target_doc_id: string;
  target_doc_title: string;
  relation_type: string;
  similarity_score: number;
  shared_concepts: string[];
  computed_at: string;
}

export interface RelationGraph {
  nodes: Array<{ id: string; title: string; chunk_count: number; status: string }>;
  edges: Array<{
    source: string;
    target: string;
    weight: number;
    shared_concepts: string[];
  }>;
}

/**
 * RelationEngine
 *
 * Computes pairwise cross-document relations within a knowledge base
 * using centroid embeddings (average of all chunk embeddings per document).
 *
 * Stores results in the `document_relations` table.
 * Subsequent calls read from that table (fast) unless forced=true.
 */
export class RelationEngine {
  private static readonly MIN_SIMILARITY = 0.3;

  /**
   * Compute pairwise document relations for all Ready docs in a KB.
   * Results are upserted into document_relations.
   */
  static async computeRelations(
    knowledgeBaseId: string,
    userId: string,
    force = false
  ): Promise<{ computed: number; skipped: boolean }> {
    // Verify KB ownership
    const { data: kb } = await supabase
      .from('knowledge_bases')
      .select('id')
      .eq('id', knowledgeBaseId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!kb) throw new Error('Knowledge base not found or unauthorized');

    // Check if recent relations exist (skip unless force=true)
    if (!force) {
      const { count } = await supabase
        .from('document_relations')
        .select('id', { count: 'exact', head: true })
        .eq('knowledge_base_id', knowledgeBaseId);

      if ((count ?? 0) > 0) {
        return { computed: 0, skipped: true };
      }
    }

    // Get all Ready documents
    const { data: docs } = await supabase
      .from('documents')
      .select('id, title')
      .eq('knowledge_base_id', knowledgeBaseId)
      .eq('user_id', userId)
      .eq('status', 'Ready')
      .is('deleted_at', null);

    if (!docs || docs.length < 2) {
      return { computed: 0, skipped: true };
    }

    // Fetch centroid embeddings (average of all chunk embeddings per doc)
    const docCentroids = await Promise.all(
      docs.map(async (doc) => {
        const { data: chunks } = await supabase
          .from('chunks')
          .select('embedding')
          .eq('document_id', doc.id);

        if (!chunks || chunks.length === 0) return null;

        // Parse embeddings (stored as "[...]" string or array)
        const vecs = chunks.map(c => {
          const raw = c.embedding as unknown as string;
          return typeof raw === 'string' ? JSON.parse(raw) as number[] : raw as unknown as number[];
        });

        // Compute centroid (element-wise mean)
        const dim = vecs[0].length;
        const centroid = new Array(dim).fill(0);
        for (const vec of vecs) {
          for (let i = 0; i < dim; i++) centroid[i] += vec[i];
        }
        for (let i = 0; i < dim; i++) centroid[i] /= vecs.length;

        return { doc, centroid };
      })
    );

    const validDocs = docCentroids.filter(Boolean) as Array<{
      doc: { id: string; title: string };
      centroid: number[];
    }>;

    // Get memory nodes (concepts) per document for shared_concepts
    const { data: allNodes } = await supabase
      .from('memory_nodes')
      .select('document_id, label')
      .eq('knowledge_base_id', knowledgeBaseId);

    const conceptsByDoc = new Map<string, Set<string>>();
    for (const node of allNodes || []) {
      if (!conceptsByDoc.has(node.document_id)) {
        conceptsByDoc.set(node.document_id, new Set());
      }
      conceptsByDoc.get(node.document_id)!.add(node.label.toLowerCase());
    }

    // Compute all pairs
    const relations: any[] = [];
    let computed = 0;

    for (let i = 0; i < validDocs.length; i++) {
      for (let j = i + 1; j < validDocs.length; j++) {
        const a = validDocs[i];
        const b = validDocs[j];

        // Cosine similarity (both are L2-normalized, so dot product == cosine sim)
        const sim = this.cosineSimilarity(a.centroid, b.centroid);
        if (sim < this.MIN_SIMILARITY) continue;

        // Shared concepts
        const conceptsA = conceptsByDoc.get(a.doc.id) ?? new Set<string>();
        const conceptsB = conceptsByDoc.get(b.doc.id) ?? new Set<string>();
        const shared = [...conceptsA].filter(c => conceptsB.has(c));

        relations.push({
          knowledge_base_id: knowledgeBaseId,
          source_doc_id: a.doc.id,
          target_doc_id: b.doc.id,
          relation_type: 'semantic_similarity',
          similarity_score: Math.round(sim * 1000) / 1000,
          shared_concepts: shared.slice(0, 20),
        });
        computed++;
      }
    }

    if (relations.length > 0) {
      await supabase
        .from('document_relations')
        .upsert(relations, { onConflict: 'source_doc_id,target_doc_id,relation_type' });
    }

    return { computed, skipped: false };
  }

  /**
   * Retrieve pre-computed relations as a graph-ready structure.
   */
  static async getRelationGraph(
    knowledgeBaseId: string,
    userId: string,
    minSimilarity = 0.3
  ): Promise<RelationGraph> {
    // Verify KB ownership
    const { data: kb } = await supabase
      .from('knowledge_bases')
      .select('id')
      .eq('id', knowledgeBaseId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!kb) throw new Error('Unauthorized');

    // Get documents (nodes)
    const { data: docs } = await supabase
      .from('documents')
      .select('id, title, status')
      .eq('knowledge_base_id', knowledgeBaseId)
      .eq('user_id', userId)
      .is('deleted_at', null);

    const docIds = new Set((docs || []).map(d => d.id));

    // Chunk counts per doc
    const chunkCounts = new Map<string, number>();
    if (docIds.size > 0) {
      const { data: chunks } = await supabase
        .from('chunks')
        .select('document_id')
        .in('document_id', [...docIds]);

      for (const c of chunks || []) {
        chunkCounts.set(c.document_id, (chunkCounts.get(c.document_id) ?? 0) + 1);
      }
    }

    // Get edges
    const { data: relations } = await supabase
      .from('document_relations')
      .select('source_doc_id, target_doc_id, similarity_score, shared_concepts')
      .eq('knowledge_base_id', knowledgeBaseId)
      .gte('similarity_score', minSimilarity);

    return {
      nodes: (docs || []).map(d => ({
        id: d.id,
        title: d.title,
        chunk_count: chunkCounts.get(d.id) ?? 0,
        status: d.status,
      })),
      edges: (relations || []).map(r => ({
        source: r.source_doc_id,
        target: r.target_doc_id,
        weight: r.similarity_score,
        shared_concepts: r.shared_concepts ?? [],
      })),
    };
  }

  /**
   * Find all documents most related to a specific document.
   */
  static async getRelatedDocuments(
    docId: string,
    knowledgeBaseId: string,
    userId: string,
    limit = 5
  ) {
    const { data } = await supabase
      .from('document_relations')
      .select('source_doc_id, target_doc_id, similarity_score, shared_concepts')
      .eq('knowledge_base_id', knowledgeBaseId)
      .or(`source_doc_id.eq.${docId},target_doc_id.eq.${docId}`)
      .gte('similarity_score', this.MIN_SIMILARITY)
      .order('similarity_score', { ascending: false })
      .limit(limit);

    return data ?? [];
  }

  private static cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
