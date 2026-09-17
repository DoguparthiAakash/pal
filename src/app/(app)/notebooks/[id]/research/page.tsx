'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  FlaskConical, RefreshCw, Download, Share2, Database,
  FileText, Layers, Cpu, TrendingUp, Zap, ChevronRight,
  GitBranch, Tag, BarChart3, PieChart, Activity, BookOpen,
  Loader2, AlertCircle, CheckCircle2, ArrowRight
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChartData {
  kb_title: string;
  totals: {
    documents: number; chunks: number; concepts: number;
    unique_concepts: number; relations: number; ready_docs: number;
  };
  doc_stats: Array<{ id: string; title: string; status: string; chunk_count: number; size_kb: number | null; created_at: string; mime_type: string }>;
  concept_stats: Array<{ label: string; type: string; count: number }>;
  type_distribution: Array<{ type: string; count: number }>;
  status_breakdown: Array<{ status: string; count: number }>;
  mime_breakdown: Array<{ type: string; count: number }>;
  timeline: Array<{ date: string; count: number }>;
  relation_summary: Array<{ source: string; target: string; source_id: string; target_id: string; similarity: number; shared_concepts: string[] }>;
  cache_stats: { total: number; hits: number; hitRate: number };
}

interface RelationGraph {
  nodes: Array<{ id: string; title: string; chunk_count: number; status: string }>;
  edges: Array<{ source: string; target: string; weight: number; shared_concepts: string[] }>;
}

// ─── Colour helpers ───────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  Ready: '#22c55e', Processing: '#f59e0b', Pending: '#94a3b8', Failed: '#ef4444',
};
const TYPE_COLORS: Record<string, string> = {
  concept: '#6366f1', entity: '#0ea5e9', topic: '#f59e0b', fact: '#10b981',
  person: '#ec4899', place: '#8b5cf6', event: '#f97316', other: '#94a3b8',
};
const CHART_PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#f97316', '#06b6d4'];

function pct(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

// ─── Inline Bar Chart ─────────────────────────────────────────────────────────
function BarChart({ items, colorFn }: { items: Array<{ label: string; value: number; color?: string }>; colorFn?: (label: string) => string }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const color = item.color ?? colorFn?.(item.label) ?? CHART_PALETTE[i % CHART_PALETTE.length];
        const width = pct(item.value, max);
        return (
          <div key={item.label} className="flex items-center gap-3">
            <div className="w-28 text-xs text-gray-600 dark:text-gray-400 truncate shrink-0">{item.label}</div>
            <div className="flex-1 bg-gray-100 dark:bg-white/5 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${width}%`, backgroundColor: color }}
              />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right shrink-0">{item.value}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Donut Chart (SVG) ────────────────────────────────────────────────────────
function DonutChart({ segments }: { segments: Array<{ label: string; value: number; color: string }> }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div className="text-sm text-gray-400 text-center py-4">No data yet</div>;
  const R = 42; const CX = 56; const CY = 56;
  let cumAngle = -90;
  const paths = segments.map(seg => {
    const angle = (seg.value / total) * 360;
    const start = (cumAngle * Math.PI) / 180;
    const end = ((cumAngle + angle) * Math.PI) / 180;
    const x1 = CX + R * Math.cos(start); const y1 = CY + R * Math.sin(start);
    const x2 = CX + R * Math.cos(end); const y2 = CY + R * Math.sin(end);
    const large = angle > 180 ? 1 : 0;
    const path = `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
    cumAngle += angle;
    return { ...seg, path, angle };
  });
  return (
    <div className="flex items-center gap-5">
      <svg width="112" height="112" viewBox="0 0 112 112" className="shrink-0">
        {paths.map((p, i) => <path key={i} d={p.path} fill={p.color} opacity="0.9" />)}
        <circle cx={CX} cy={CY} r="26" fill="currentColor" className="text-white dark:text-[#121214]" />
        <text x={CX} y={CY + 5} textAnchor="middle" className="text-xs" fontSize="12" fill="currentColor" style={{ fill: 'var(--tw-prose-body, #6b7280)' }}>{total}</text>
      </svg>
      <div className="space-y-1.5">
        {segments.map(seg => (
          <div key={seg.label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-xs text-gray-600 dark:text-gray-300">{seg.label}</span>
            <span className="text-xs text-gray-400 ml-1">{pct(seg.value, total)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Relation Graph (Canvas) ───────────────────────────────────────────────────
function RelationGraphCanvas({ graph, onNodeClick }: { graph: RelationGraph; onNodeClick: (id: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const posRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || graph.nodes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    // Force-directed layout approximation (circular + repulsion iterations)
    const positions = new Map<string, { x: number; y: number; vx: number; vy: number }>();
    const r = Math.min(W, H) * 0.35;
    graph.nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / graph.nodes.length;
      positions.set(node.id, { x: W / 2 + r * Math.cos(angle), y: H / 2 + r * Math.sin(angle), vx: 0, vy: 0 });
    });

    // Simple force simulation
    for (let iter = 0; iter < 80; iter++) {
      // Repulsion
      for (const a of graph.nodes) {
        for (const b of graph.nodes) {
          if (a.id === b.id) continue;
          const pa = positions.get(a.id)!;
          const pb = positions.get(b.id)!;
          const dx = pa.x - pb.x; const dy = pa.y - pb.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 2500 / (dist * dist);
          pa.vx += (dx / dist) * force;
          pa.vy += (dy / dist) * force;
        }
      }
      // Attraction (edges)
      for (const edge of graph.edges) {
        const pa = positions.get(edge.source);
        const pb = positions.get(edge.target);
        if (!pa || !pb) continue;
        const dx = pb.x - pa.x; const dy = pb.y - pa.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const target = 120 * (1 - edge.weight);
        const force = (dist - target) * 0.05;
        pa.vx += (dx / dist) * force; pa.vy += (dy / dist) * force;
        pb.vx -= (dx / dist) * force; pb.vy -= (dy / dist) * force;
      }
      // Update
      for (const p of positions.values()) {
        p.vx *= 0.85; p.vy *= 0.85;
        p.x = Math.max(30, Math.min(W - 30, p.x + p.vx));
        p.y = Math.max(30, Math.min(H - 30, p.y + p.vy));
      }
    }

    // Persist positions for click detection
    for (const [id, pos] of positions) posRef.current.set(id, { x: pos.x, y: pos.y });

    // Draw
    ctx.clearRect(0, 0, W, H);

    // Edges
    for (const edge of graph.edges) {
      const pa = positions.get(edge.source)!;
      const pb = positions.get(edge.target)!;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.strokeStyle = `rgba(99, 102, 241, ${edge.weight * 0.7})`;
      ctx.lineWidth = Math.max(1, edge.weight * 4);
      ctx.stroke();
    }

    // Nodes
    for (const node of graph.nodes) {
      const p = positions.get(node.id)!;
      const radius = Math.max(10, Math.min(22, 8 + node.chunk_count * 0.5));
      const color = node.status === 'Ready' ? '#6366f1' : node.status === 'Processing' ? '#f59e0b' : '#94a3b8';

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label (truncated)
      const label = node.title.length > 12 ? node.title.slice(0, 10) + '…' : node.title;
      ctx.fillStyle = 'rgba(100,116,139,0.9)';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(label, p.x, p.y + radius + 14);
    }
  }, [graph]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    for (const [id, pos] of posRef.current) {
      const dist = Math.sqrt((mx - pos.x) ** 2 + (my - pos.y) ** 2);
      if (dist <= 24) {
        const node = graph.nodes.find(n => n.id === id);
        if (node) { setTooltip({ x: e.clientX, y: e.clientY, text: `${node.title} (${node.chunk_count} chunks)` }); return; }
      }
    }
    setTooltip(null);
  }, [graph]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    for (const [id, pos] of posRef.current) {
      const dist = Math.sqrt((mx - pos.x) ** 2 + (my - pos.y) ** 2);
      if (dist <= 24) { onNodeClick(id); return; }
    }
  }, [onNodeClick]);

  if (graph.nodes.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
        No documents to visualise. Upload documents to see connections.
      </div>
    );
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full h-64 rounded-xl cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        onClick={handleClick}
        style={{ background: 'var(--graph-bg, rgba(99,102,241,0.03))' }}
      />
      {tooltip && (
        <div className="fixed z-50 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg shadow-xl pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 12 }}>
          {tooltip.text}
        </div>
      )}
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-indigo-500" /> Ready</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-500" /> Processing</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-slate-400" /> Other</div>
        <div className="flex items-center gap-1.5 ml-auto"><div className="w-8 h-0.5 bg-indigo-400 opacity-70" /> edge = semantic link</div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className="bg-white dark:bg-[#16161a] border border-gray-200 dark:border-white/5 rounded-2xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function Card({ title, icon, children, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#16161a] border border-gray-200 dark:border-white/5 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-indigo-500">
            {icon}
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Export Button ────────────────────────────────────────────────────────────
function ExportButton({ notebookId, type, format, label }: { notebookId: string; type: string; format: string; label: string }) {
  const [loading, setLoading] = useState(false);
  const handleExport = async () => {
    setLoading(true);
    try {
      const url = `/api/research/export?notebookId=${notebookId}&type=${type}&format=${format}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const ext = format === 'csv' ? 'csv' : 'json';
      const filename = `pal-${type}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      {label}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ResearchPage({ params }: { params: { id: string } }) {
  const notebookId = params.id;
  const [data, setData] = useState<ChartData | null>(null);
  const [graph, setGraph] = useState<RelationGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [relLoading, setRelLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [minSim, setMinSim] = useState(0.3);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [chartsRes, graphRes] = await Promise.all([
        fetch(`/api/research/charts?notebookId=${notebookId}`),
        fetch(`/api/research/relations?notebookId=${notebookId}&minSimilarity=${minSim}`),
      ]);
      if (chartsRes.ok) setData(await chartsRes.json());
      if (graphRes.ok) setGraph(await graphRes.json());
    } finally {
      setLoading(false);
    }
  }, [notebookId, minSim]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const computeRelations = async (force = false) => {
    setRelLoading(true);
    try {
      await fetch('/api/research/relations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebookId, force }),
      });
      const res = await fetch(`/api/research/relations?notebookId=${notebookId}&minSimilarity=${minSim}`);
      if (res.ok) setGraph(await res.json());
    } finally {
      setRelLoading(false);
    }
  };

  const selectedDocNode = graph?.nodes.find(n => n.id === selectedDoc);
  const selectedDocEdges = graph?.edges.filter(e => e.source === selectedDoc || e.target === selectedDoc) ?? [];
  const compareDocA = data?.doc_stats.find(d => d.id === compareA);
  const compareDocB = data?.doc_stats.find(d => d.id === compareB);
  const compareRelation = data?.relation_summary.find(r =>
    (r.source_id === compareA && r.target_id === compareB) ||
    (r.source_id === compareB && r.target_id === compareA)
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-indigo-400 mx-auto" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading research data…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <AlertCircle size={32} className="text-red-400 mx-auto" />
          <p className="text-gray-500">Failed to load research data. Check your notebook ID.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#09090b]">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1.5">
              <BookOpen size={12} /> {data.kb_title}
              <ChevronRight size={12} />
              <FlaskConical size={12} className="text-indigo-500" />
              <span className="text-indigo-500 font-medium">Research Lab</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Research Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Cross-document analysis, knowledge relations, and data export
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#16161a] border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:border-indigo-300 transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {/* ── Stat Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard icon={<FileText size={18} />} label="Documents" value={data.totals.documents} sub={`${data.totals.ready_docs} ready`} color="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500" />
          <StatCard icon={<Layers size={18} />} label="Chunks" value={data.totals.chunks} sub="text segments" color="bg-blue-50 dark:bg-blue-900/20 text-blue-500" />
          <StatCard icon={<Tag size={18} />} label="Concepts" value={data.totals.unique_concepts} sub={`${data.totals.concepts} total`} color="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500" />
          <StatCard icon={<GitBranch size={18} />} label="Relations" value={data.totals.relations} sub="doc pairs" color="bg-violet-50 dark:bg-violet-900/20 text-violet-500" />
          <StatCard icon={<Zap size={18} />} label="Cache Hits" value={data.cache_stats.hits} sub={`${Math.round(data.cache_stats.hitRate * 100)}% rate`} color="bg-amber-50 dark:bg-amber-900/20 text-amber-500" />
          <StatCard icon={<Activity size={18} />} label="Cached Q's" value={data.cache_stats.total} sub="in memory" color="bg-pink-50 dark:bg-pink-900/20 text-pink-500" />
        </div>

        {/* ── Row 1: Status breakdown + Mime + Timeline ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card title="Document Status" icon={<PieChart size={14} />}>
            <DonutChart segments={data.status_breakdown.map((s, i) => ({
              label: s.status, value: s.count, color: STATUS_COLORS[s.status] ?? CHART_PALETTE[i],
            }))} />
          </Card>

          <Card title="File Types" icon={<Database size={14} />}>
            <BarChart items={data.mime_breakdown.map((m, i) => ({
              label: m.type, value: m.count, color: CHART_PALETTE[i % CHART_PALETTE.length],
            }))} />
          </Card>

          <Card title="Upload Timeline" icon={<TrendingUp size={14} />}>
            {data.timeline.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
            ) : (
              <BarChart items={data.timeline.map(t => ({
                label: t.date, value: t.count, color: '#6366f1',
              }))} />
            )}
          </Card>
        </div>

        {/* ── Row 2: Chunks per Doc ─────────────────────────────────────── */}
        <Card title="Chunks per Document" icon={<BarChart3 size={14} />}>
          <BarChart
            items={data.doc_stats
              .filter(d => d.status === 'Ready')
              .sort((a, b) => b.chunk_count - a.chunk_count)
              .slice(0, 20)
              .map((d, i) => ({ label: d.title, value: d.chunk_count, color: CHART_PALETTE[i % CHART_PALETTE.length] }))}
          />
        </Card>

        {/* ── Row 3: Concept Distribution ───────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Top Concepts" icon={<Tag size={14} />}>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {data.concept_stats.slice(0, 15).map((c, i) => (
                <div key={`${c.label}-${i}`} className="flex items-center gap-3 py-1">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[c.type] ?? '#94a3b8' }} />
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{c.label}</span>
                  <span className="text-xs text-gray-400">{c.count}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: TYPE_COLORS[c.type] ?? '#94a3b8', fontSize: '10px' }}>{c.type}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Concept Types" icon={<Cpu size={14} />}>
            <DonutChart segments={data.type_distribution.map((t, i) => ({
              label: t.type, value: t.count, color: TYPE_COLORS[t.type] ?? CHART_PALETTE[i],
            }))} />
          </Card>
        </div>

        {/* ── Row 4: Cross-Document Relation Graph ──────────────────────── */}
        <Card
          title="Cross-Document Relations"
          icon={<Share2 size={14} />}
          action={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>Min sim:</span>
                <input
                  type="range" min="0.1" max="0.9" step="0.1" value={minSim}
                  onChange={e => setMinSim(parseFloat(e.target.value))}
                  className="w-20"
                />
                <span>{minSim}</span>
              </div>
              <button
                onClick={() => computeRelations(true)}
                disabled={relLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {relLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Compute
              </button>
            </div>
          }
        >
          {graph ? (
            <RelationGraphCanvas graph={graph} onNodeClick={setSelectedDoc} />
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              Click "Compute" to discover document relations
            </div>
          )}

          {/* Selected node detail */}
          {selectedDoc && selectedDocNode && (
            <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800/30 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{selectedDocNode.title}</h4>
                <button onClick={() => setSelectedDoc(null)} className="text-xs text-gray-400 hover:text-gray-600">×</button>
              </div>
              <p className="text-xs text-gray-500 mb-3">{selectedDocNode.chunk_count} chunks · status: {selectedDocNode.status}</p>
              {selectedDocEdges.length === 0 ? (
                <p className="text-xs text-gray-400">No computed relations for this document yet.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Related documents:</p>
                  {selectedDocEdges.map((edge, i) => {
                    const otherId = edge.source === selectedDoc ? edge.target : edge.source;
                    const other = graph?.nodes.find(n => n.id === otherId);
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <ArrowRight size={12} className="text-indigo-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate block">{other?.title ?? otherId}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-indigo-500 font-medium">{(edge.weight * 100).toFixed(0)}% similar</span>
                            {edge.shared_concepts.slice(0, 3).map(c => (
                              <span key={c} className="text-xs px-1.5 py-0.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full text-gray-500">{c}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ── Row 5: Top Relations Table ────────────────────────────────── */}
        {data.relation_summary.length > 0 && (
          <Card title="Top Document Pairs" icon={<GitBranch size={14} />}>
            <div className="space-y-2">
              {data.relation_summary.map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/3 rounded-xl text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <FileText size={12} className="text-indigo-400 shrink-0" />
                      <span className="font-medium text-gray-800 dark:text-gray-200 truncate">{r.source}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 pl-3.5">
                      <ArrowRight size={10} className="text-gray-300" />
                      <span className="text-gray-600 dark:text-gray-400 truncate">{r.target}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-indigo-500 font-bold">{(r.similarity * 100).toFixed(0)}%</div>
                    <div className="text-xs text-gray-400">{r.shared_concepts.length} shared</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Row 6: Comparative Analysis ───────────────────────────────── */}
        <Card title="Comparative Analysis" icon={<Activity size={14} />}>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Document A</label>
              <select
                value={compareA}
                onChange={e => setCompareA(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a document…</option>
                {data.doc_stats.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Document B</label>
              <select
                value={compareB}
                onChange={e => setCompareB(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a document…</option>
                {data.doc_stats.filter(d => d.id !== compareA).map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
          </div>

          {compareDocA && compareDocB ? (
            <div>
              {compareRelation && (
                <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800/30 rounded-xl flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-indigo-500 shrink-0" />
                  <div>
                    <span className="font-bold text-indigo-600 text-lg">{(compareRelation.similarity * 100).toFixed(0)}%</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">semantic similarity</span>
                  </div>
                  {compareRelation.shared_concepts.length > 0 && (
                    <div className="ml-auto flex gap-1 flex-wrap">
                      {compareRelation.shared_concepts.slice(0, 5).map(c => (
                        <span key={c} className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-full">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {[{ doc: compareDocA, label: 'A' }, { doc: compareDocB, label: 'B' }].map(({ doc, label }) => (
                  <div key={label} className="bg-gray-50 dark:bg-white/3 rounded-xl p-4">
                    <div className="text-xs font-bold text-indigo-500 mb-2">DOC {label}</div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm mb-3 truncate">{doc.title}</p>
                    <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                      <div className="flex justify-between"><span>Status</span><span className="font-medium" style={{ color: STATUS_COLORS[doc.status] }}>{doc.status}</span></div>
                      <div className="flex justify-between"><span>Chunks</span><span className="font-medium text-gray-900 dark:text-white">{doc.chunk_count}</span></div>
                      <div className="flex justify-between"><span>Size</span><span className="font-medium text-gray-900 dark:text-white">{doc.size_kb ?? '—'} KB</span></div>
                      <div className="flex justify-between"><span>Type</span><span className="font-medium text-gray-900 dark:text-white truncate max-w-24">{doc.mime_type?.split('/')[1] ?? '—'}</span></div>
                      <div className="flex justify-between"><span>Uploaded</span><span className="font-medium text-gray-900 dark:text-white">{new Date(doc.created_at).toLocaleDateString()}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-gray-400">Select two documents to compare them</div>
          )}
        </Card>

        {/* ── Row 7: Export ─────────────────────────────────────────────── */}
        <Card title="Export Data" icon={<Download size={14} />}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ExportButton notebookId={notebookId} type="full" format="json" label="Full Export (JSON)" />
            <ExportButton notebookId={notebookId} type="docs" format="csv" label="Documents (CSV)" />
            <ExportButton notebookId={notebookId} type="relations" format="csv" label="Relations (CSV)" />
            <ExportButton notebookId={notebookId} type="concepts" format="json" label="Concepts (JSON)" />
            <ExportButton notebookId={notebookId} type="chunks" format="csv" label="Chunks (CSV)" />
            <ExportButton notebookId={notebookId} type="docs" format="json" label="Documents (JSON)" />
            <ExportButton notebookId={notebookId} type="relations" format="json" label="Relations (JSON)" />
            <ExportButton notebookId={notebookId} type="concepts" format="csv" label="Concepts (CSV)" />
          </div>
        </Card>

      </div>
    </div>
  );
}
