import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
  Printer,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TransactionStatusBadge } from './TransactionStatusBadge';
import type { TransactionStatus } from './TransactionStatusBadge';
import { CopyButton } from './Common/CopyButton';
import { TransactionExporter } from './TransactionExporter';
import { TransactionReceipt } from './TransactionReceipt';

type TransactionType = 'Deposit' | 'Withdrawal';
type SortKey = 'type' | 'asset' | 'amount' | 'status' | 'date';
type SortDir = 'asc' | 'desc';
type ColumnAlign = 'left' | 'right';

interface Transaction {
  id: string;
  type: TransactionType;
  asset: string;
  amount: number;
  status: TransactionStatus;
  date: string;
  reference: string;
  fees?: number;
  anchorSignature?: string;
}

const ALL_TRANSACTIONS: Transaction[] = Array.from({ length: 5000 }, (_, i) => {
  const isDeposit = i % 3 === 0;
  const statusList: TransactionStatus[] = ['Completed', 'Pending', 'Processing', 'Failed', 'Cancelled'];
  const status = statusList[i % statusList.length];
  const assets = ['USDC', 'EURT', 'ARST'];
  const asset = assets[i % assets.length];
  const amount = 50 + i * 25.5;
  const dateObj = new Date('2024-03-21');
  dateObj.setDate(dateObj.getDate() - Math.floor(i / 3));

  return {
    id: `tx-${String(i + 1).padStart(3, '0')}`,
    type: isDeposit ? 'Deposit' : 'Withdrawal',
    asset,
    amount,
    status,
    date: dateObj.toISOString().split('T')[0],
    reference: `REF-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    fees: status === 'Completed' ? parseFloat((amount * 0.01).toFixed(2)) : undefined,
    anchorSignature: status === 'Completed' ? `SIG-${Math.random().toString(36).substring(2, 10).toUpperCase()}` : undefined,
  };
});

type TransactionUpdatePayload = {
  id: string;
  status?: string;
  ledger?: number;
  amount?: number;
  [key: string]: unknown;
};

const fmtAmount = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SortIcon = ({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: SortDir }) => {
  if (col !== sortKey) return <ChevronsUpDown size={13} className="text-slate-600" aria-hidden="true" />;
  return dir === 'asc' ? (
    <ChevronUp size={13} className="text-primary-text" aria-hidden="true" />
  ) : (
    <ChevronDown size={13} className="text-primary-text" aria-hidden="true" />
  );
};

interface TransactionHistoryProps {
  socketUpdate?: TransactionUpdatePayload | null;
}

export const TransactionHistory = ({ socketUpdate }: TransactionHistoryProps) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'All'>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>(ALL_TRANSACTIONS);
  const parentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!socketUpdate) {
      return;
    }

    setTransactions((current) => {
      const index = current.findIndex((tx) => tx.id === socketUpdate.id);
      if (index === -1) {
        return [
          {
            id: socketUpdate.id,
            type: 'Deposit',
            asset: 'USDC',
            amount: typeof socketUpdate.amount === 'number' ? socketUpdate.amount : 0,
            status: (socketUpdate.status as TransactionStatus) ?? 'Completed',
            date: new Date().toISOString().split('T')[0],
            reference: `REF-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          },
          ...current,
        ];
      }

      const updatedTransaction = {
        ...current[index],
        ...socketUpdate,
        status: (socketUpdate.status as TransactionStatus) ?? current[index].status,
      };

      return [...current.slice(0, index), updatedTransaction, ...current.slice(index + 1)];
    });
  }, [socketUpdate]);

  const handleSort = useCallback(
    (key: SortKey) => {
      setSortDir((prev) => (sortKey === key ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
      setSortKey(key);
    },
    [sortKey],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return transactions.filter((tx) => {
      const matchesQuery =
        !q ||
        tx.id.toLowerCase().includes(q) ||
        tx.type.toLowerCase().includes(q) ||
        tx.asset.toLowerCase().includes(q) ||
        tx.reference.toLowerCase().includes(q) ||
        tx.status.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'All' || tx.status === statusFilter;
      const matchesFrom = !dateFrom || tx.date >= dateFrom;
      const matchesTo = !dateTo || tx.date <= dateTo;
      return matchesQuery && matchesStatus && matchesFrom && matchesTo;
    });
  }, [query, statusFilter, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'amount') {
        cmp = a.amount - b.amount;
      } else {
        cmp = a[sortKey].localeCompare(b[sortKey]);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  const virtualRows = virtualizer.getVirtualItems();

  const HEADERS: { key: SortKey; label: string; align: ColumnAlign }[] = [
    { key: 'type', label: 'Type', align: 'left' },
    { key: 'asset', label: 'Asset', align: 'left' },
    { key: 'amount', label: 'Amount', align: 'right' },
    { key: 'status', label: 'Status', align: 'left' },
    { key: 'date', label: 'Date', align: 'left' },
  ];

  const statusOptions: Array<TransactionStatus | 'All'> = ['All', 'Completed', 'Pending', 'Processing', 'Failed', 'Cancelled'];

  const handlePrintReceipt = useCallback((tx: Transaction) => {
    setSelectedTransaction(tx);
    setTimeout(() => window.print(), 100);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by ID, type, asset, reference…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            aria-label="Search transactions"
            className="input-field w-full pl-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="date-from" className="sr-only">
            From date
          </label>
          <input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            aria-label="Filter from date"
            className="input-field text-sm"
          />
          <label htmlFor="date-to" className="sr-only">
            To date
          </label>
          <input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            aria-label="Filter to date"
            className="input-field text-sm"
          />

          <label htmlFor="status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as TransactionStatus | 'All');
              setPage(1);
            }}
            className="input-field text-sm"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'All Statuses' : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <TransactionExporter
          transactions={sorted}
          totalCount={sorted.length}
          filters={{ query, status: statusFilter, dateFrom, dateTo }}
        />
      </div>
      {selectedTransaction && (
        <TransactionReceipt
          transaction={selectedTransaction}
          onPrint={() => window.print()}
        />
      )}

      <div className="glass-card overflow-x-auto">
        <table className="responsive-table w-full text-left" aria-label="Transaction history">
          <caption className="sr-only">
            Transaction history — {sorted.length} result{sorted.length !== 1 ? 's' : ''}
          </caption>
          <thead>
      <div className="glass-card overflow-hidden">
        <div ref={parentRef} className="max-h-[720px] overflow-y-auto">
          <table className="responsive-table w-full text-left" aria-label="Transaction history">
            <caption className="sr-only">
              Transaction history — {sorted.length} result{sorted.length !== 1 ? 's' : ''}
            </caption>
            <thead>
            <tr className="border-b border-slate-600 text-sm text-slate-400">
              {HEADERS.map(({ key, label, align }) => (
                <th
                  key={key}
                  scope="col"
                  className={`p-4 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  <button
                    onClick={() => handleSort(key)}
                    className={`inline-flex items-center gap-1 rounded hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-text ${
                      align === 'right' ? 'justify-end' : 'justify-start'
                    }`}
                    aria-label={`Sort by ${label}${sortKey === key ? `, currently ${sortDir}ending` : ''}`}
                  >
                    {label}
                    <SortIcon col={key} sortKey={sortKey} dir={sortDir} />
                  </button>
                </th>
              ))}
              <th scope="col" className="p-4 font-medium text-slate-400">
                Reference
              </th>
              <th scope="col" className="p-4 font-medium text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody style={{ height: virtualizer.getTotalSize() }} className="relative">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="transition-colors hover:bg-slate-900/50">
                  <td className="p-4">
                    <div className="h-4 w-20 animate-pulse rounded bg-slate-800" />
                  </td>
                  <td className="p-4">
                    <div className="h-4 w-12 animate-pulse rounded bg-slate-800" />
                  </td>
                  <td className="p-4">
                    <div className="h-4 w-16 animate-pulse rounded bg-slate-800" />
                  </td>
                  <td className="p-4">
                    <div className="h-6 w-20 animate-pulse rounded-full bg-slate-800" />
                  </td>
                  <td className="p-4">
                    <div className="h-4 w-24 animate-pulse rounded bg-slate-800" />
                  </td>
                  <td className="p-4">
                    <div className="h-4 w-24 animate-pulse rounded bg-slate-800" />
                  </td>
                  <td className="p-4">
                    <div className="h-8 w-20 animate-pulse rounded bg-slate-800" />
                  </td>
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  No transactions match your filters.
                </td>
              </tr>
            ) : (
              paginated.map((tx) => (
                <tr key={tx.id} className="transition-colors hover:bg-slate-900/50">
                  <td className="flex items-center gap-2 p-4" data-label="Type">
                    {tx.type === 'Deposit' ? (
                      <ArrowDownLeft size={16} className="text-emerald-400" aria-hidden="true" />
                    ) : (
                      <ArrowUpRight size={16} className="text-rose-400" aria-hidden="true" />
                    )}
                    {tx.type}
                  </td>
                  <td className="p-4" data-label="Asset">{tx.asset}</td>
                  <td className="p-4 font-mono" data-label="Amount">${fmtAmount(tx.amount)}</td>
                  <td className="p-4" data-label="Status">
                    <TransactionStatusBadge status={tx.status} />
                  </td>
                  <td className="p-4 text-sm text-slate-400" data-label="Date">
                    <time dateTime={tx.date}>{tx.date}</time>
                  </td>
                  <td className="p-4 font-mono text-xs text-slate-500" data-label="Reference">
                    <span className="inline-flex items-center gap-1.5">
                      {tx.reference}
                      <CopyButton value={tx.reference} label="Transaction reference" />
                    </span>
                  <td className="p-4 font-mono text-xs text-slate-500" data-label="Reference">{tx.reference}</td>
                  <td className="p-4" data-label="Actions">
                    {tx.status === 'Completed' && (
                      <button
                        type="button"
                        onClick={() => handlePrintReceipt(tx)}
                        className="action-button inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/50 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-text"
                        aria-label={`Print receipt for transaction ${tx.id}`}
                      >
                        <Printer size={14} aria-hidden="true" />
                        Receipt
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-slate-400">
        <span aria-live="polite" aria-atomic="true">
          {sorted.length === 0 ? 'No results' : `Showing 1–${sorted.length} of ${sorted.length}`}
        </span>
      </div>
    </div>
  );
};

export default TransactionHistory;
