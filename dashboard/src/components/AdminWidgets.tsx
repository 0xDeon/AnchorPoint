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
export default AdminWidgets;
