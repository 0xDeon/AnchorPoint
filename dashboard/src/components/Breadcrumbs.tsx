import React from 'react';
import React, { useMemo } from 'react';
import { ChevronRight, Home } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BreadcrumbItem {
  /** Display label for this segment. */
  label: string;
  /**
   * Optional navigation target.
   * - Pass a string URL/hash for `<a href>`.
   * - Pass a function for SPA navigation (e.g. `setActiveTab`).
   * - Omit for the last (active) segment.
   */
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
export interface Crumb {
  /** Display label for this breadcrumb step */
  label: string;
  /** Optional href — if omitted the crumb renders as plain text (current page) */
  href?: string;
}

export interface BreadcrumbsProps {
  /**
   * Explicit list of breadcrumb entries.
   * When provided, takes precedence over automatic URL parsing.
   * The last item is treated as the active (current) step.
   *
   * Example:
   * ```tsx
   * <Breadcrumbs crumbs={[
   *   { label: 'Dashboard', href: '/' },
   *   { label: 'Transactions', href: '/transactions' },
   *   { label: 'Tx #1042' },
   * ]} />
   * ```
   */
  crumbs?: Crumb[];
  /** Class names forwarded to the <nav> wrapper */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a URL pathname segment into a human-readable label.
 * e.g. "transaction-history" → "Transaction History"
 */
function segmentToLabel(segment: string): string {
  return segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Derives breadcrumb items by parsing `window.location.pathname`.
 * The first item is always "Dashboard" (root).
 */
function parsePathname(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [{ label: 'Dashboard', href: '/' }];

  let accumulated = '';
  for (let i = 0; i < segments.length; i++) {
    accumulated += `/${segments[i]}`;
    const isLast = i === segments.length - 1;
    items.push({
      label: segmentToLabel(segments[i]),
      href: isLast ? undefined : accumulated,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Breadcrumbs component
// ---------------------------------------------------------------------------

interface BreadcrumbsProps {
  /**
   * Explicit list of breadcrumb items.
   * When provided, `useLocation` is ignored.
   * When omitted, items are derived from `window.location.pathname`.
   */
  crumbs?: BreadcrumbItem[];
  /** Custom class name applied to the outer nav element. */
  className?: string;
  /** Show the home icon on the first crumb (default: true). */
  showHomeIcon?: boolean;
}

/**
 * Renders a horizontal breadcrumb trail.
 *
 * Usage in a React Router app:
 * ```tsx
 * <Breadcrumbs crumbs={[
 *   { label: 'Dashboard', href: '/' },
 *   { label: 'Transactions', href: '/transactions' },
 *   { label: 'Tx #1042' },
 * ]} />
 * ```
 *
 * Usage with SPA state navigation:
 * ```tsx
 * <Breadcrumbs crumbs={[
 *   { label: 'Dashboard', onClick: () => setActiveTab('dashboard') },
 *   { label: 'Transactions', onClick: () => setActiveTab('history') },
 *   { label: 'Tx #1042' },
 * ]} />
 * ```
 *
 * When `crumbs` is not provided, items are derived from
 * `window.location.pathname`.
 */
const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  crumbs,
  className = '',
  showHomeIcon = true,
}) => {
  const items: BreadcrumbItem[] = crumbs ?? parsePathname(window.location.pathname);

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1 text-sm ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="flex items-center gap-1">
              {/* Chevron separator (not before first item) */}
              {!isFirst && (
                <ChevronRight
                  size={13}
                  aria-hidden="true"
                  className="shrink-0 text-slate-500"
                />
              )}

              {isLast ? (
                /* Active / current segment — not a link */
                <span
                  aria-current="page"
                  className="flex items-center gap-1 font-medium text-slate-100"
                >
                  {isFirst && showHomeIcon && (
                    <Home size={13} aria-hidden="true" className="shrink-0" />
                  )}
                  {item.label}
                </span>
              ) : item.onClick ? (
                /* SPA navigation via callback */
                <button
                  type="button"
                  onClick={item.onClick}
                  className="flex items-center gap-1 text-slate-400 transition-colors hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-transparent"
                >
                  {isFirst && showHomeIcon && (
                    <Home size={13} aria-hidden="true" className="shrink-0" />
                  )}
                  {item.label}
                </button>
              ) : (
                /* Standard href link */
                <a
                  href={item.href}
                  className="flex items-center gap-1 text-slate-400 transition-colors hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-transparent"
                >
                  {isFirst && showHomeIcon && (
                    <Home size={13} aria-hidden="true" className="shrink-0" />
                  )}
                  {item.label}
                </a>
              )}
            </li>
 * Derives breadcrumb entries from `window.location.pathname`.
 *
 * e.g. `/transactions/1042` →
 *   [{ label: 'Dashboard', href: '/' }, { label: 'Transactions', href: '/transactions' }, { label: '1042' }]
 */
function parsePath(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return [{ label: 'Dashboard' }];
  }

  const crumbs: Crumb[] = [{ label: 'Dashboard', href: '/' }];

  segments.forEach((seg, idx) => {
    const label = seg
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const isLast = idx === segments.length - 1;
    crumbs.push({
      label,
      href: isLast ? undefined : `/${segments.slice(0, idx + 1).join('/')}`,
    });
  });

  return crumbs;
}

// ---------------------------------------------------------------------------
// Breadcrumbs Component
// ---------------------------------------------------------------------------

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ crumbs: crumbsProp, className = '' }) => {
  const crumbs = useMemo<Crumb[]>(() => {
    if (crumbsProp && crumbsProp.length > 0) return crumbsProp;
    return parsePath(window.location.pathname);
  }, [crumbsProp]);

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center ${className}`}>
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {crumbs.map((crumb, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === crumbs.length - 1;

          return (
            <React.Fragment key={`${crumb.label}-${idx}`}>
              {/* Chevron separator (not before the first item) */}
              {!isFirst && (
                <li aria-hidden="true" className="flex items-center text-slate-600">
                  <ChevronRight size={14} />
                </li>
              )}

              <li className="flex items-center">
                {isLast || !crumb.href ? (
                  /* Current / active step — no link, visually highlighted */
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className={`flex items-center gap-1 font-medium ${
                      isLast
                        ? 'text-slate-100'
                        : 'text-slate-400'
                    }`}
                  >
                    {isFirst && <Home size={13} aria-hidden="true" className="shrink-0" />}
                    {crumb.label}
                  </span>
                ) : (
                  /* Ancestor step — clickable link */
                  <a
                    href={crumb.href}
                    className="flex items-center gap-1 text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
                  >
                    {isFirst && <Home size={13} aria-hidden="true" className="shrink-0" />}
                    {crumb.label}
                  </a>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
