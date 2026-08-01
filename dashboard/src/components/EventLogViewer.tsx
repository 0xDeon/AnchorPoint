import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal, Filter, Trash2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { CircleSlash, Terminal } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventTopic = 'transfer' | 'mint' | 'swap' | string;

export interface ContractEvent {
  id: string;
  topic: EventTopic;
  timestamp: string; // ISO string
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Syntax-highlighted JSON renderer
// ---------------------------------------------------------------------------

/** Minimal syntax highlighter – colours keys, strings, numbers, booleans, null. */
const HighlightedJson: React.FC<{ value: unknown }> = ({ value }) => {
  const highlighted = React.useMemo(() => {
    const json = JSON.stringify(value, null, 2);
    return json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(
        /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (match) => {
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              // JSON key
              return `<span class="text-blue-300">${match}</span>`;
            }
            // String value
            return `<span class="text-emerald-300">${match}</span>`;
          }
          if (/true|false/.test(match)) {
            return `<span class="text-yellow-300">${match}</span>`;
          }
          if (/null/.test(match)) {
            return `<span class="text-red-400">${match}</span>`;
          }
          // Number
          return `<span class="text-purple-300">${match}</span>`;
        },
      );
  }, [value]);

  return (
    <pre
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: highlighted }}
      className="overflow-x-auto whitespace-pre-wrap break-all text-xs leading-relaxed"
    />
  );
};

// ---------------------------------------------------------------------------
// Topic badge
// ---------------------------------------------------------------------------

const TOPIC_COLORS: Record<string, string> = {
  transfer: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  mint: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  swap: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
};

const TopicBadge: React.FC<{ topic: EventTopic }> = ({ topic }) => {
  const cls = TOPIC_COLORS[topic] ?? 'bg-slate-700/40 text-slate-300 border-slate-600/40';
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}
    >
      {topic}
    </span>
  );
};
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

const KNOWN_TOPICS: EventTopic[] = ['transfer', 'mint', 'swap'];

interface EventLogViewerProps {
  /** Base URL for the anchor API. The component connects to `{apiBaseUrl}/api/events`. */
  apiBaseUrl: string;
  /** Maximum number of log entries to keep in memory (default: 200). */
  maxEntries?: number;
}

/**
 * Terminal-style viewer that streams Soroban contract events from
 * `GET /api/events` (Server-Sent Events) and renders them with syntax
 * highlighting. Supports topic filtering.
 */
const EventLogViewer: React.FC<EventLogViewerProps> = ({
  apiBaseUrl,
  maxEntries = 200,
}) => {
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [topicFilter, setTopicFilter] = useState<EventTopic | 'all'>('all');
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

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    setError(null);
    const url = `${apiBaseUrl}/api/events`;
    const es = new EventSource(url);
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
        const event: ContractEvent = JSON.parse(e.data as string);
        setEvents((prev) => {
          const next = [...prev, event];
          return next.length > maxEntries ? next.slice(next.length - maxEntries) : next;
        });
      } catch {
        // Ignore malformed events
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
      setError('Connection lost. Retrying…');
      es.close();
      esRef.current = null;
    };
  }, [apiBaseUrl, maxEntries]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const filtered =
    topicFilter === 'all' ? events : events.filter((e) => e.topic === topicFilter);

  const handleClear = () => setEvents([]);

  return (
    <section
      aria-label="Contract event log"
      className="flex h-full flex-col rounded-xl border border-slate-700 bg-slate-950"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-slate-700 bg-slate-900 px-4 py-2">
        <Terminal size={15} className="shrink-0 text-slate-400" />
        <span className="text-xs font-semibold text-slate-200">Event Stream</span>

        {/* Connection indicator */}
        <span
          aria-label={connected ? 'Connected' : 'Disconnected'}
          className={`ml-1 inline-block h-2 w-2 rounded-full ${
            connected ? 'animate-pulse bg-emerald-400' : 'bg-red-500'
          }`}
        />

        <div className="ml-auto flex items-center gap-2">
          {/* Topic filter */}
          <Filter size={13} className="text-slate-400" aria-hidden="true" />
          <select
            aria-label="Filter by topic"
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value as EventTopic | 'all')}
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All topics</option>
            {KNOWN_TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Clear log */}
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear log"
            className="rounded-md border border-slate-700 bg-slate-800 p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Log body */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Contract events"
        className="flex-1 overflow-y-auto p-3 font-mono"
      >
        {error && (
          <p className="mb-2 text-xs text-red-400">{error}</p>
        )}

        {filtered.length === 0 ? (
          <p className="text-xs text-slate-500">
            {connected
              ? 'Waiting for events…'
              : 'Not connected. Check the API server.'}
          </p>
        ) : (
          filtered.map((event) => (
            <div
              key={event.id}
              className="mb-3 rounded-lg border border-slate-800 bg-slate-900 p-3"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <TopicBadge topic={event.topic} />
                <span className="text-[10px] text-slate-500">{event.timestamp}</span>
                <span className="text-[10px] font-mono text-slate-600">{event.id}</span>
              </div>
              <HighlightedJson value={event.payload} />
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
    </section>

      {/* Footer */}
      <p className="mt-2 text-right text-xs text-slate-600">
        {filtered.length} event{filtered.length !== 1 ? 's' : ''} shown
        {filter ? ` (filtered: ${filter})` : ''}
      </p>
    </div>
  );
};

export default EventLogViewer;
