import React from 'react';

const placeholder = /^\{\{(b\d+)\}\}$/;

export default function ProblemBlankActivity({ problem, values = {}, onChange }) {
  const renderParts = (line, lineIndex) => line.replaceAll('**', '').split(/(\{\{b\d+\}\})/g).map((part, partIndex) => {
    const match = part.match(placeholder);
    if (!match) return <span key={`${lineIndex}-${partIndex}`}>{part}</span>;
    const id = match[1];
    return <input
      key={`${lineIndex}-${partIndex}`}
      type="text"
      value={values[id] || ''}
      onChange={event => onChange(id, event.target.value)}
      aria-label={`${problem.title} 풀이 빈칸 ${id.slice(1)}번`}
      maxLength={200}
      className="inline-block align-middle w-36 max-w-full mx-1 my-1 px-2 py-1 border border-amber-300 rounded-md bg-white text-slate-900 outline-none focus:ring-2 focus:ring-amber-400"
    />;
  });

  return <div className="space-y-2 text-xs leading-relaxed text-slate-800">
    {problem.blankActivity.templateLines.map((line, index) => {
      if (line.startsWith('|---')) return null;
      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line.slice(1, -1).split('|');
        return <div key={index} className="grid gap-1 min-w-[650px] border-b border-amber-200 pb-1" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
          {cells.map((cell, cellIndex) => <div key={cellIndex} className="px-1 break-words">{renderParts(cell.trim(), `${index}-${cellIndex}`)}</div>)}
        </div>;
      }
      return <div key={index} className="whitespace-pre-wrap">{renderParts(line, index)}</div>;
    })}
  </div>;
}
