import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// ---------------------------------------------------------------------------
// useAutoRefresh hook
// ---------------------------------------------------------------------------

/**
 * Calls `callback` immediately and then on every `interval` milliseconds.
 * Stops polling when `interval` is `null`.
 */
export function useAutoRefresh(
  callback: () => void | Promise<void>,
  interval: number | null,
): { isRefreshing: boolean } {
  const [isRefreshing, setIsRefreshing] = useState(false);
// Calls `callback` immediately on mount, then on every `intervalMs`.
// When intervalMs is null (Off), polling is disabled.
// ---------------------------------------------------------------------------
function useAutoRefresh(callback: () => void, intervalMs: number | null): boolean {
  const [polling, setPolling] = useState(false);
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (interval === null) return;

    let cancelled = false;

    const fire = async () => {
      if (cancelled) return;
      setIsRefreshing(true);
      try {
        await savedCallback.current();
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    };

    // Trigger immediately on mount / interval change
    fire();

    const id = setInterval(fire, interval);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [interval]);

  return { isRefreshing };
}

// ---------------------------------------------------------------------------
// Refresh interval selector
// ---------------------------------------------------------------------------

const INTERVALS = [
  { label: 'Off', value: null },
  { label: '5s', value: 5_000 },
  { label: '15s', value: 15_000 },
  { label: '30s', value: 30_000 },
] as const;

type IntervalOption = (typeof INTERVALS)[number];

interface RefreshIntervalSelectProps {
  /** Currently selected interval value in ms, or null for off. */
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}

const RefreshIntervalSelect: React.FC<RefreshIntervalSelectProps> = ({
  value,
  onChange,
  disabled = false,
}) => (
  <select
    aria-label="Auto-refresh interval"
    disabled={disabled}
    value={value ?? 'off'}
    onChange={(e) => {
      const raw = e.target.value;
      onChange(raw === 'off' ? null : Number(raw));
    }}
    className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {INTERVALS.map((opt) => (
      <option key={opt.label} value={opt.value ?? 'off'}>
        {opt.label}
      </option>
    ))}
  </select>
);

// ---------------------------------------------------------------------------
// Refreshing spinner
// ---------------------------------------------------------------------------

const RefreshSpinner: React.FC<{ visible: boolean }> = ({ visible }) =>
  visible ? (
    <RefreshCw
      aria-label="Refreshing…"
      size={14}
      className="animate-spin text-blue-400"
    />
  ) : null;

// ---------------------------------------------------------------------------
// AdminWidgets component
// ---------------------------------------------------------------------------

export interface AdminMetrics {
  pendingTransactions: number;
  completedToday: number;
  failedToday: number;
  uptimePercent: number;
}

interface AdminWidgetsProps {
  /** Base URL for the anchor API, e.g. "http://localhost:3001". */
  apiBaseUrl: string;
}

/**
 * Displays key admin status metrics with a configurable auto-refresh interval.
 * Users can pick Off / 5 s / 15 s / 30 s from a dropdown.
 */
const AdminWidgets: React.FC<AdminWidgetsProps> = ({ apiBaseUrl }) => {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval_] = useState<number | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/metrics`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AdminMetrics = await res.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    }
  }, [apiBaseUrl]);

  const { isRefreshing } = useAutoRefresh(fetchMetrics, interval);

  const statCards: Array<{ label: string; value: string | number; accent: string }> = metrics
    ? [
        {
          label: 'Pending',
          value: metrics.pendingTransactions,
          accent: 'text-yellow-400',
        },
        {
          label: 'Completed today',
          value: metrics.completedToday,
          accent: 'text-emerald-400',
        },
        {
          label: 'Failed today',
          value: metrics.failedToday,
          accent: 'text-red-400',
        },
        {
          label: 'Uptime',
          value: `${metrics.uptimePercent.toFixed(1)} %`,
          accent: 'text-blue-400',
        },
      ]
    : [];

  return (
    <section
      aria-label="Admin status widgets"
      className="rounded-xl border border-slate-700 bg-slate-900 p-4"
    >
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-100">System Metrics</h2>
          <RefreshSpinner visible={isRefreshing} />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Auto-refresh:</span>
          <RefreshIntervalSelect value={interval} onChange={setInterval_} />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <p role="alert" className="mb-3 rounded-md bg-red-900/40 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {/* Metric cards */}
      {metrics ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="list">
          {statCards.map(({ label, value, accent }) => (
            <li
              key={label}
              className="flex flex-col gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-3"
            >
              <span className="text-xs text-slate-400">{label}</span>
              <span className={`text-xl font-bold ${accent}`}>{value}</span>
    // Always fire once on mount / interval change
    setPolling(true);
    void Promise.resolve().then(() => {
      savedCallback.current();
      setPolling(false);
    });

    if (intervalMs === null) return;

    const id = setInterval(() => {
      setPolling(true);
      void Promise.resolve().then(() => {
        savedCallback.current();
        setPolling(false);
      });
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs]);

  return polling;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type RefreshInterval = 5000 | 15000 | 30000 | null;

interface IntervalOption {
  label: string;
  value: RefreshInterval;
}

const INTERVAL_OPTIONS: IntervalOption[] = [
  { label: 'Off', value: null },
  { label: '5s', value: 5000 },
  { label: '15s', value: 15000 },
  { label: '30s', value: 30000 },
];

interface MetricItem {
  label: string;
  value: string | number;
  unit?: string;
}

interface AdminWidgetsProps {
  /** Base URL of the backend API, e.g. "http://localhost:3002" */
  apiBaseUrl: string;
}

// ---------------------------------------------------------------------------
// AdminWidgets
// ---------------------------------------------------------------------------
const AdminWidgets: React.FC<AdminWidgetsProps> = ({ apiBaseUrl }) => {
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<RefreshInterval>(null);

  const fetchMetrics = useCallback(async () => {
    setFetchError(null);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${apiBaseUrl}/api/health`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data: Record<string, unknown> = await res.json();

      // Build a flat metric list from whatever the health endpoint returns
      const items: MetricItem[] = [];
      for (const [key, val] of Object.entries(data)) {
        if (key === 'timestamp') continue;
        if (typeof val === 'object' && val !== null) {
          const sub = val as Record<string, unknown>;
          if ('status' in sub) {
            items.push({ label: key.charAt(0).toUpperCase() + key.slice(1), value: String(sub.status) });
          }
          if ('latencyMs' in sub && typeof sub.latencyMs === 'number') {
            items.push({ label: `${key} latency`, value: sub.latencyMs, unit: 'ms' });
          }
        } else if (typeof val === 'string' || typeof val === 'number') {
          items.push({ label: key, value: val });
        }
      }

      setMetrics(items);
      setLastRefresh(new Date());
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load system metrics');
    }
  }, [apiBaseUrl]);

  const isPolling = useAutoRefresh(fetchMetrics, selectedInterval);

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-slate-100">System Metrics</h3>

        <div className="flex items-center gap-2">
          {/* Spinner shown while a background poll is in progress */}
          {isPolling && (
            <RefreshCw
              size={13}
              className="animate-spin text-primary"
              aria-label="Refreshing…"
            />
          )}

          {/* Auto-refresh interval selector */}
          <label htmlFor="refresh-interval" className="sr-only">
            Auto-refresh interval
          </label>
          <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 p-1">
            {INTERVAL_OPTIONS.map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                id={opt.value === null ? 'refresh-interval' : undefined}
                onClick={() => setSelectedInterval(opt.value)}
                aria-pressed={selectedInterval === opt.value}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  selectedInterval === opt.value
                    ? 'bg-primary text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Manual refresh */}
          <button
            type="button"
            onClick={() => void fetchMetrics()}
            disabled={isPolling}
            aria-label="Refresh metrics now"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <RefreshCw size={12} className={isPolling ? 'animate-spin' : ''} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {fetchError && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400"
        >
          {fetchError}
        </p>
      )}

      {/* Metrics grid */}
      {metrics.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="System metric values">
          {metrics.map((m) => (
            <li
              key={m.label}
              className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {m.label}
              </span>
              <span className="text-sm font-semibold text-slate-200">
                {m.value}
                {m.unit && <span className="ml-0.5 text-xs font-normal text-slate-500">{m.unit}</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        !error && (
          <p className="text-xs text-slate-400">
            Select a refresh interval above to load metrics.
          </p>
        )
      )}
    </section>
  );
};

export { AdminWidgets, RefreshIntervalSelect, RefreshSpinner };
        !fetchError && (
          <p className="text-sm text-slate-500">No metrics available.</p>
        )
      )}

      {/* Last refresh timestamp */}
      {lastRefresh && (
        <p className="mt-3 text-right text-xs text-slate-600" aria-live="polite">
          Last refreshed: {lastRefresh.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
};

export default AdminWidgets;
