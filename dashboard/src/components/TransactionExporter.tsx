import { Download } from 'lucide-react';

interface ExportableTransaction {
  id: string;
  type: string;
  asset: string;
  amount: number;
  status: string;
  date: string;
  reference: string;
}

interface TransactionExporterProps {
  transactions: ExportableTransaction[];
  totalCount: number;
  filters: Record<string, string>;
}

const CSV_COLUMNS: (keyof ExportableTransaction)[] = ['id', 'type', 'asset', 'amount', 'status', 'date', 'reference'];

const csvEscape = (value: string | number) => {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const todayStamp = () => new Date().toISOString().split('T')[0];

const triggerDownload = (content: string, mimeType: string, extension: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `AnchorPoint_Transactions_${todayStamp()}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const buildMetadataLines = (totalCount: number, filters: Record<string, string>, prefix: string) => {
  const activeFilters = Object.entries(filters)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');

  return [
    `${prefix}Exported: ${new Date().toISOString()}`,
    `${prefix}Total records: ${totalCount}`,
    `${prefix}Filters: ${activeFilters || 'none'}`,
  ];
};

export const TransactionExporter = ({ transactions, totalCount, filters }: TransactionExporterProps) => {
  const handleExportCsv = () => {
    const metadata = buildMetadataLines(totalCount, filters, '# ');
    const header = CSV_COLUMNS.join(',');
    const rows = transactions.map((tx) => CSV_COLUMNS.map((col) => csvEscape(tx[col])).join(','));
    const csv = [...metadata, header, ...rows].join('\n');
    triggerDownload(csv, 'text/csv;charset=utf-8', 'csv');
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      totalCount,
      filters,
      transactions,
    };
    triggerDownload(JSON.stringify(payload, null, 2), 'application/json', 'json');
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleExportCsv}
        className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 transition hover:border-primary/50 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <Download size={14} aria-hidden="true" />
        CSV
      </button>
      <button
        type="button"
        onClick={handleExportJson}
        className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 transition hover:border-primary/50 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <Download size={14} aria-hidden="true" />
        JSON
      </button>
    </div>
  );
};

export default TransactionExporter;
