'use client';
import { useCallback, useEffect, useState } from 'react';
import { ReactFlow, Controls, Background, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useParams, useRouter } from 'next/navigation';

export default function MindMapPage() {
  const { id } = useParams();
  const router = useRouter();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/notebooks/${id}/mindmap`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        const COLORS = [
          { bg: '#3b82f6', text: '#ffffff', border: '#2563eb' }, // Blue
          { bg: '#10b981', text: '#ffffff', border: '#059669' }, // Emerald
          { bg: '#f59e0b', text: '#ffffff', border: '#d97706' }, // Amber
          { bg: '#ec4899', text: '#ffffff', border: '#db2777' }, // Pink
          { bg: '#8b5cf6', text: '#ffffff', border: '#7c3aed' }, // Violet
          { bg: '#06b6d4', text: '#ffffff', border: '#0891b2' }, // Cyan
        ];

        const coloredNodes = (data.nodes || []).map((node: Node, i: number) => {
          const theme = COLORS[i % COLORS.length];
          return {
            ...node,
            style: {
              ...node.style,
              background: theme.bg,
              color: theme.text,
              borderColor: theme.border,
              borderWidth: '2px',
              borderRadius: '12px',
              padding: '12px 20px',
              fontWeight: 600,
              fontSize: '14px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            }
          };
        });

        const styledEdges = (data.edges || []).map((edge: Edge) => ({
          ...edge,
          animated: true,
          style: { stroke: '#9ca3af', strokeWidth: 2 }
        }));

        setNodes(coloredNodes);
        setEdges(styledEdges);
        setLoading(false);
      });
  }, [id]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    // Navigate to chat and pre-fill prompt about this node
    router.push(`/notebooks/${id}?prompt=Tell me more about ${encodeURIComponent(node.data.label as string)}`);
  };

  if (loading) return (
    <div className="flex h-full w-full items-center justify-center bg-[#FAFAFA] dark:bg-[#0A0A0A]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin" />
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium tracking-tight">Loading Mind Map...</span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full bg-[#FAFAFA] dark:bg-[#0A0A0A] rounded-xl overflow-hidden border border-black/[0.08] dark:border-white/[0.08] shadow-sm">
      <div className="px-6 py-4 border-b border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#111111] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c-1.105 0-2-.895-2-2V7c0-1.105.895-2 2-2h12c1.105 0 2 .895 2 2v10c0 1.105-.895 2-2 2H9z" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Topic Map</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Click a node to ask the AI about it.</p>
        </div>
      </div>
      <div className="flex-1 bg-[#FAFAFA] dark:bg-[#0A0A0A]">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-gray-500 font-medium tracking-tight">No mind map generated yet.</p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            className="[&_.react-flow\_\_node]:rounded-lg [&_.react-flow\_\_node]:border-black/10 [&_.react-flow\_\_node]:dark:border-white/10 [&_.react-flow\_\_node]:shadow-sm"
          >
            <Background color="#999" gap={20} size={1} />
            <Controls className="!bg-white dark:!bg-[#111111] !border-black/10 dark:!border-white/10 !shadow-sm [&_button]:!border-black/10 dark:[&_button]:!border-white/10 [&_button]:!text-gray-600 dark:[&_button]:!text-gray-400 hover:[&_button]:!bg-gray-50 dark:hover:[&_button]:!bg-gray-800" />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
