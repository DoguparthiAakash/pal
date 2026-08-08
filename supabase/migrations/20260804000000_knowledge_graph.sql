-- 20260804000000_knowledge_graph.sql

-- Memory Nodes for Obsidian-like Knowledge Graph
CREATE TABLE public.memory_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_base_id UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    type TEXT NOT NULL, -- e.g., 'concept', 'entity', 'topic'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Memory Edges
CREATE TABLE public.memory_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_node_id UUID NOT NULL REFERENCES public.memory_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES public.memory_nodes(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL, -- e.g., 'relates_to', 'part_of', 'causes'
    weight FLOAT DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workspace Artifacts for caching generated Mind Maps, Guides, Notes
CREATE TABLE public.workspace_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_base_id UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'mindmap', 'guide', 'notes'
    content JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_id, type)
);

-- RLS Policies
ALTER TABLE public.memory_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own memory nodes"
    ON public.memory_nodes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.knowledge_bases kb
            WHERE kb.id = memory_nodes.knowledge_base_id
            AND kb.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can access their own memory edges"
    ON public.memory_edges FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.memory_nodes n
            JOIN public.knowledge_bases kb ON n.knowledge_base_id = kb.id
            WHERE n.id = memory_edges.source_node_id
            AND kb.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can access their own workspace artifacts"
    ON public.workspace_artifacts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.knowledge_bases kb
            WHERE kb.id = workspace_artifacts.knowledge_base_id
            AND kb.user_id = auth.uid()
        )
    );
