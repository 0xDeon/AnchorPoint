import React, { useEffect, useRef, useState } from 'react';
import { CircleSlash, Terminal } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Topics the viewer can filter by. Empty string means "all". */
type EventTopic = '' | 'transfer' | 'mint' | 'swap';

interface ContractEvent {
  id: string;
  topic: string;
  /** Raw payload received from the stream */
  data: unknown;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal JSON syntax highlighter — returns an array of <span> elements. */
function SyntaxHighlight({ value }: { value: unknown }): React.ReactElement {
  const json = JSON.stringify(value, null, 2);

  const tokens = json.split(/("(?:\\.|[^"\\])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g);

  return (
    <span>
      {tokens.map((token, i) => {
        if (/^"/.test(token)) {
          // Distinguish keys (followed by colon) from string values
          const isKey = i + 1 < tokens.length && tokens[i + 1]?.trimStart().startsWith(':');
          return (
            <span key={i} className={isKey ? 'text-sky-300' : 'text-emerald-300'}>
              {token}
            </span>
          );
        }
        if (/^(true|false)$/.test(token))
          return <span key={i} className="text-amber-400">{token}</span>;
        if (token === 'null')
          return <span key={i} className="text-slate-500">{token}</span>;
        if (/^-?\d/.test(token))
          return <span key={i} className="text-violet-300">{token}</span>;
        return <span key={i} className="text-slate-300">{token}</span>;
      })}
    </span>
  );
}

function topicColor(topic: string): string {
  switch (topic.toLowerCase()) {
    case 'transfer': return 'text-sky-400 border-sky-500/30 bg-sky-500/10';
    case 'mint':     return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    case 'swap':     return 'text-violet-400 border-violet-500/30 bg-violet-500/10';
    default:         return 'text-slate-400 border-slate-600/30 bg-slate-700/30';
  }
}

// ---------------------------------------------------------------------------
// EventLogViewer
// ---------------------------------------------------------------------------

const EVENTS_URL = '/api/events';

const FILTER_OPTIONS: { label: string; value: EventTopic }[] = [
  { label: 'All', value: '' },
  { label: 'transfer', value: 'transfer' },
  { label: 'mint', value: 'mint' },
  { label: 'swap', value: 'swap' },
];

const EventLogViewer: React.FC = () => {
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [filter, setFilter] = useState<EventTopic>('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  // Connect to SSE stream
  useEffect(() => {
    setError(null);
    const es = new EventSource(EVENTS_URL);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const parsed: Omit<ContractEvent, 'id'> = JSON.parse(e.data as string);
        const event: ContractEvent = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          topic: parsed.topic ?? 'unknown',
          data: parsed.data ?? parsed,
          timestamp: parsed.timestamp ?? new Date().toISOString(),
        };
        setEvents((prev) => [...prev.slice(-199), event]); // keep last 200
      } catch {
        // non-JSON frames (e.g. keep-alive comments) are silently ignored
      }
    };

    es.onerror = () => {
      setConnected(false);
      setError('Stream disconnected. Reconnecting…');
    };

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, []);

  const filtered = filter
    ? events.filter((ev) => ev.topic.toLowerCase() === filter)
    : events;

  return (
    <div className="glass-card flex flex-col p-6" style={{ minHeight: '400px' }}>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Terminal size={18} className="text-primary" aria-hidden="true" />
          <h3 className="text-lg font-bold text-slate-100">Contract Event Stream</h3>
          <span
            aria-label={connected ? 'Connected' : 'Disconnected'}
            className={`inline-block h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-emerald-500' : 'bg-red-500'}`}
          />
        </div>

        {/* Topic filter */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 p-1" role="group" aria-label="Filter by event topic">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              aria-pressed={filter === opt.value}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                filter === opt.value
                  ? 'bg-primary text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <p role="alert" className="mb-3 rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {error}
        </p>
      )}

      {/* Terminal window */}
      <div
        className="flex-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed"
        style={{ maxHeight: '460px' }}
        aria-live="polite"
        aria-label="Contract event log"
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-600">
            <CircleSlash size={24} aria-hidden="true" />
            <span>{connected ? 'Waiting for events…' : 'Connecting to event stream…'}</span>
          </div>
        ) : (
          filtered.map((ev) => (
            <div key={ev.id} className="mb-3 border-b border-slate-800/60 pb-3 last:border-0 last:pb-0">
              {/* Row header */}
              <div className="mb-1 flex items-center gap-2">
                <span className="text-slate-600">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${topicColor(ev.topic)}`}
                >
                  {ev.topic}
                </span>
              </div>
              {/* Syntax-highlighted payload */}
              <pre className="overflow-x-auto whitespace-pre-wrap break-all text-slate-300">
                <SyntaxHighlight value={ev.data} />
              </pre>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <p className="mt-2 text-right text-xs text-slate-600">
        {filtered.length} event{filtered.length !== 1 ? 's' : ''} shown
        {filter ? ` (filtered: ${filter})` : ''}
      </p>
    </div>
  );
};

export default EventLogViewer;
