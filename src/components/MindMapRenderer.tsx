"use client";

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { useTheme } from 'next-themes';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

export default function MindMapRenderer({ data }: { data: any }) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');

  useEffect(() => {
    if (!data || !data.mermaid) return;

    // A modern, premium theme inspired by the user's reference image
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        primaryColor: '#4f46e5', // Indigo 600
        primaryTextColor: '#ffffff',
        primaryBorderColor: '#3730a3', // Indigo 800
        lineColor: '#9ca3af',
        secondaryColor: '#10b981', // Emerald 500
        tertiaryColor: '#ffffff',
        mainBkg: '#4338ca', // Indigo 700
        nodeBorder: '#312e81', // Indigo 900
        clusterBkg: theme === 'dark' ? '#1e1b4b' : '#e0e7ff',
        clusterBorder: '#4f46e5',
        fontFamily: 'inherit',
      },
      flowchart: {
        curve: 'stepBefore',
        nodeSpacing: 50,
        rankSpacing: 50
      },
      securityLevel: 'loose',
    });

    const renderChart = async () => {
      try {
        const id = `mermaid-chart-${Date.now()}`;
        // Clean up markdown block wrapping if AI messed up
        let rawMermaid = data.mermaid;
        if (rawMermaid.startsWith('```mermaid')) {
          rawMermaid = rawMermaid.replace(/^```mermaid\n/, '').replace(/\n```$/, '');
        } else if (rawMermaid.startsWith('```')) {
          rawMermaid = rawMermaid.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        // Process nodes to include progress bars as requested by the user's design
        rawMermaid = rawMermaid.replace(/\["([^"]+)"\]|\[([^\]]+)\]/g, (match: string, quotedText: string, unquotedText: string) => {
          const text = quotedText || unquotedText;
          if (text.includes('<div')) return match; // Already processed or custom
          
          // Generate a random progress for visual flair matching the UI image
          const progress = Math.floor(Math.random() * 60) + 20; 
          
          return `["<div style='display:flex;flex-direction:column;align-items:center;gap:12px;padding:4px 12px;'><div style='font-family:inherit;font-weight:600;font-size:14px;color:#ffffff;text-align:center;'>${text}</div><div style='width:140px;height:6px;background:#ffffff;border-radius:3px;overflow:hidden;display:flex;'><div style='width:${progress}%;height:100%;background:#10b981;border-radius:3px;'></div></div></div>"]`;
        });

        // Add classDef for the custom styling matching the image
        if (!rawMermaid.includes('classDef')) {
          rawMermaid += `\nclassDef default fill:#4f568a,stroke:#4f568a,stroke-width:1px,color:#ffffff,rx:12px,ry:12px;`;
        }

        let { svg } = await mermaid.render(id, rawMermaid);
        
        // Remove max-width so the SVG can maintain its native size for zooming/panning
        svg = svg.replace(/max-width:\s*[^;]+;?/g, '');
        
        setSvgContent(svg);
      } catch (err) {
        console.error('Mermaid render error:', err);
        setSvgContent(`<div class="text-red-500">Failed to render mind map graph.</div>`);
      }
    };

    renderChart();
  }, [data, theme]);

  if (!data || !data.mermaid) {
    return <div className="p-4 text-gray-500">Generating mind map...</div>;
  }

  return (
    <div 
      className="absolute inset-0 bg-gray-50 dark:bg-gray-900/50 flex flex-col"
      ref={containerRef}
    >
      {/* Zoom/Pan wrapper allows the user to explore the full native size of the graph */}
      <TransformWrapper
        initialScale={1}
        minScale={0.1}
        maxScale={4}
        centerOnInit={true}
        wheel={{ step: 0.1 }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-2 bg-white dark:bg-gray-800 p-2 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
              <button 
                onClick={() => zoomIn()} 
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
                title="Zoom In"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button 
                onClick={() => zoomOut()} 
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
                title="Zoom Out"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <button 
                onClick={() => resetTransform()} 
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
                title="Reset View"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>
            
            <TransformComponent 
              wrapperClass="flex-1 w-full"
            >
              <div 
                className="min-w-full min-h-full flex justify-center items-center cursor-grab active:cursor-grabbing p-12"
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
