'use client';
import { useCallback, useEffect, useState } from 'react';
import { ReactFlow, Controls, Background, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useParams } from 'next/navigation';

export default function MemoryGraphPage() {
  const { id } = useParams();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/notebooks/${id}/memory`)
      .then(res => res.json())
      .then(data => {
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
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

  if (loading) return (
    <div className="flex h-full w-full items-center justify-center bg-[#FAFAFA] dark:bg-[#0A0A0A]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin" />
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium tracking-tight">Loading Memory Network...</span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full bg-[#FAFAFA] dark:bg-[#0A0A0A] rounded-xl overflow-hidden border border-black/[0.08] dark:border-white/[0.08] shadow-sm">
      <div className="px-6 py-4 border-b border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#111111] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Obsidian Memory Store</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Neural network visualization of extracted concepts and relationships.</p>
        </div>
      </div>
      <div className="flex-1 bg-[#FAFAFA] dark:bg-[#0A0A0A]">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-gray-500 font-medium tracking-tight">No memory graph generated yet.</p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            className="[&_.react-flow\_\_node]:rounded-full [&_.react-flow\_\_node]:text-xs [&_.react-flow\_\_node]:font-medium [&_.react-flow\_\_node]:border-indigo-200 dark:[&_.react-flow\_\_node]:border-indigo-800/30 [&_.react-flow\_\_node]:bg-white dark:[&_.react-flow\_\_node]:bg-indigo-900/20 [&_.react-flow\_\_node]:text-indigo-900 dark:[&_.react-flow\_\_node]:text-indigo-100 [&_.react-flow\_\_node]:shadow-sm"
          >
            <Background color="#999" gap={24} size={1.5} />
            <Controls className="!bg-white dark:!bg-[#111111] !border-black/10 dark:!border-white/10 !shadow-sm [&_button]:!border-black/10 dark:[&_button]:!border-white/10 [&_button]:!text-gray-600 dark:[&_button]:!text-gray-400 hover:[&_button]:!bg-gray-50 dark:hover:[&_button]:!bg-gray-800" />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
