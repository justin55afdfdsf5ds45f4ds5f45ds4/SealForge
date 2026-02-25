import { useState, useEffect } from 'react';
import type { IntelligencePayload } from '../types/intelligence';
import { getTheme } from '../themes';

interface Props {
  content: string;
}

function tryParsePayload(content: string): IntelligencePayload | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.version === '1.0' && parsed.signal && parsed.reasoning) {
      return parsed as IntelligencePayload;
    }
  } catch {}
  return null;
}

function ConfidenceRing({ value, size = 56 }: { value: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
      <circle
        cx={size/2} cy={size/2} r={radius}
        stroke="currentColor" strokeWidth="4" fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
      <text
        x={size/2} y={size/2}
        textAnchor="middle" dominantBaseline="central"
        className="fill-white text-xs font-bold"
        transform={`rotate(90, ${size/2}, ${size/2})`}
      >
        {value}%
      </text>
    </svg>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-current transition-all duration-700 ease-out"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-mono opacity-70">{value}%</span>
    </div>
  );
}

function StyledMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactElement[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  function flushList() {
    if (listItems.length === 0) return;
    const Tag = listType === 'ol' ? 'ol' : 'ul';
    const cls = listType === 'ol' ? 'list-decimal' : 'list-disc';
    elements.push(
      <Tag key={elements.length} className={`${cls} list-inside space-y-1 text-gray-300 text-sm`}>
        {listItems.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
      </Tag>
    );
    listItems = [];
    listType = null;
  }

  function renderInline(line: string) {
    // Bold: **text**
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') { flushList(); continue; }
    if (trimmed === '---' || trimmed === '***') {
      flushList();
      elements.push(<hr key={elements.length} className="border-gray-700" />);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(<h3 key={elements.length} className="text-white font-bold text-base mt-2">{renderInline(trimmed.slice(4))}</h3>);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(<h2 key={elements.length} className="text-white font-bold text-lg mt-3">{renderInline(trimmed.slice(3))}</h2>);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(<h1 key={elements.length} className="text-white font-bold text-xl mt-4">{renderInline(trimmed.slice(2))}</h1>);
      continue;
    }
    if (/^[-*]\s/.test(trimmed)) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(trimmed.replace(/^[-*]\s+/, ''));
      continue;
    }
    if (/^\d+[.)]\s/.test(trimmed)) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(trimmed.replace(/^\d+[.)]\s+/, ''));
      continue;
    }
    flushList();
    elements.push(<p key={elements.length} className="text-gray-300 text-sm leading-relaxed">{renderInline(trimmed)}</p>);
  }
  flushList();

  return <div className="space-y-2">{elements}</div>;
}

export default function IntelViewer({ content }: Props) {
  const payload = tryParsePayload(content);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [notes, setNotes] = useState('');
  const [checklist, setChecklist] = useState<Array<{ text: string; checked: boolean }>>([]);
  const [showAllSources, setShowAllSources] = useState(false);

  useEffect(() => {
    if (!payload) return;
    // Initialize checklist from actions
    setChecklist(
      (payload.actions || []).map(a => ({ text: a.label, checked: false }))
    );
    // Animate reasoning steps
    const steps = payload.reasoning?.steps?.length || 0;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setVisibleSteps(i);
      if (i >= steps) clearInterval(timer);
    }, 600);
    return () => clearInterval(timer);
  }, [content]);

  // Fallback: render styled markdown-like content if not a valid payload
  if (!payload) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-700 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-green-400 text-sm font-semibold uppercase tracking-wider">Decrypted Intelligence</span>
        </div>
        <StyledMarkdown text={content} />
      </div>
    );
  }

  const theme = getTheme(payload.signal.theme);
  const { signal, reasoning, conclusion, actions, sources, metadata } = payload;

  const toggleCheck = (idx: number) => {
    setChecklist(prev => prev.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item));
  };

  const addCheckItem = () => {
    const text = prompt('Add action item:');
    if (text) setChecklist(prev => [...prev, { text, checked: false }]);
  };

  const displayedSources = showAllSources ? sources : sources.slice(0, 4);
  const created = new Date(signal.timestamp);
  const timeAgo = getTimeAgo(created);

  return (
    <div className="space-y-4">
      {/* === SIGNAL HEADER === */}
      <div className={`rounded-xl overflow-hidden border ${theme.border}`}>
        <div className={`bg-gradient-to-r ${theme.gradient} p-6`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${theme.accentBg} text-white mb-3`}>
                <span>{theme.icon}</span>
                <span>{theme.label}</span>
                <span className="opacity-60">|</span>
                <span>{signal.category}</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">{signal.title}</h2>
              <div className="flex items-center gap-4 text-sm text-white/70">
                <span>{timeAgo}</span>
                <span>{metadata.data_sources_scanned} sources analyzed</span>
              </div>
            </div>
            <div className={`${theme.accent} flex-shrink-0`}>
              <ConfidenceRing value={signal.confidence} />
            </div>
          </div>
        </div>
      </div>

      {/* === REASONING CHAIN === */}
      <div className={`rounded-xl bg-gray-900/80 border ${theme.border} p-5`}>
        <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="text-lg">{'\u{1F9E0}'}</span> Reasoning Chain
        </h3>
        <div className="space-y-0">
          {reasoning.steps.map((step, i) => (
            <div
              key={i}
              className={`transition-all duration-500 ${i < visibleSteps ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              {i > 0 && (
                <div className="flex justify-center py-1">
                  <div className={`w-0.5 h-6 bg-gradient-to-b ${theme.gradient} opacity-30`} />
                </div>
              )}
              <div className={`rounded-lg bg-gray-800/60 border ${theme.border} p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-semibold ${theme.accent}`}>{step.label}</span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed mb-2">{step.text}</p>
                <div className={`${theme.accent}`}>
                  <ConfidenceBar value={step.confidence} />
                </div>
                {step.source && (
                  <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    <span>{'\u{1F4CE}'}</span> {step.source}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* === CONCLUSION / THE PLAY === */}
      <div className={`rounded-xl bg-gray-900/80 border-2 ${theme.border} p-5`}>
        <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="text-lg">{'\u{1F4B0}'}</span> The Play
        </h3>
        <div className="space-y-3">
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Verdict</div>
            <p className="text-white font-medium">{conclusion.summary}</p>
          </div>
          <div className={`${theme.accentBg} rounded-lg p-3`}>
            <div className="text-xs text-gray-400 uppercase mb-1">Action</div>
            <p className={`${theme.accent} font-semibold`}>{conclusion.play}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Window:</span>
            <span className={`text-xs font-mono ${theme.accent} px-2 py-0.5 rounded ${theme.accentBg}`}>
              {conclusion.timeframe}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-700/50">
            {actions.map((action, i) => (
              <a
                key={i}
                href={action.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${theme.accentBg} ${theme.accent} hover:opacity-80 transition-opacity`}
              >
                {action.type === 'defi' && '\u{1F4B1}'}
                {action.type === 'research' && '\u{1F50D}'}
                {action.type === 'trade' && '\u{1F4C8}'}
                {action.type === 'track' && '\u{1F440}'}
                {action.type === 'external' && '\u{1F517}'}
                {action.label}
                <span className="opacity-50">{'\u{2192}'}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* === SOURCES === */}
      <div className={`rounded-xl bg-gray-900/80 border ${theme.border} p-5`}>
        <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="text-lg">{'\u{1F4CE}'}</span> Sources ({sources.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {displayedSources.map((source, i) => (
            <div key={i} className="rounded-lg bg-gray-800/60 border border-gray-700/50 p-3">
              <div className="flex items-start gap-2">
                <span className="text-sm">
                  {source.type === 'api' && '\u{1F4CA}'}
                  {source.type === 'rss' && '\u{1F4F0}'}
                  {source.type === 'web' && '\u{1F310}'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-200 truncate">{source.title}</div>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 hover:text-gray-300 truncate block"
                  >
                    {source.url.replace(/^https?:\/\//, '').slice(0, 40)}...
                  </a>
                  <span className={`inline-block text-xs px-1.5 py-0.5 rounded mt-1 ${theme.accentBg} ${theme.accent}`}>
                    {source.type.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {sources.length > 4 && (
          <button
            onClick={() => setShowAllSources(!showAllSources)}
            className="mt-3 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {showAllSources ? 'Show less' : `+${sources.length - 4} more sources [Show All]`}
          </button>
        )}
      </div>

      {/* === NOTES & CHECKLIST === */}
      <div className={`rounded-xl bg-gray-900/80 border ${theme.border} p-5`}>
        <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="text-lg">{'\u{1F4DD}'}</span> My Notes
        </h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Type your notes here..."
          className="w-full bg-gray-800/60 border border-gray-700/50 rounded-lg p-3 text-sm text-gray-300 placeholder-gray-600 resize-y min-h-[60px] focus:outline-none focus:border-gray-500"
          rows={3}
        />
        <div className="mt-3 space-y-2">
          {checklist.map((item, i) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => toggleCheck(i)}
                className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-0 focus:ring-offset-0"
              />
              <span className={`text-sm ${item.checked ? 'line-through text-gray-600' : 'text-gray-300'}`}>
                {item.text}
              </span>
            </label>
          ))}
        </div>
        <button
          onClick={addCheckItem}
          className="mt-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          + Add action item
        </button>
      </div>

      {/* === METADATA FOOTER === */}
      <div className="text-center text-xs text-gray-600 space-y-1">
        <div>Generated by {metadata.agent} | Model: {metadata.model}</div>
        <div>Created: {new Date(metadata.generated_at).toLocaleString()}</div>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
