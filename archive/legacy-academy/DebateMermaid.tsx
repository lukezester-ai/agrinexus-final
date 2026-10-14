'use client';
import mermaid from 'mermaid';
import { useEffect, useRef } from 'react';

export default function DebateMermaid({ chartId, code }: { chartId: string; code: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
    if (ref.current) {
      mermaid.render(chartId, code).then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg;
      });
    }
  }, [code, chartId]);

  return <div ref={ref} className="mermaid-container overflow-x-auto py-4" />;
}
