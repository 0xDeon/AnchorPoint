import React, { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HelpCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Tooltip — generic hover/focus tooltip with Framer Motion animation
// ---------------------------------------------------------------------------

export interface TooltipProps {
  /** Text shown inside the tooltip bubble */
  content: string;
  /** Element that triggers the tooltip on hover/focus */
  children: React.ReactNode;
  /** Tooltip placement relative to the trigger. Defaults to "top". */
  placement?: 'top' | 'bottom';
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, placement = 'top' }) => {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  const isTop = placement === 'top';

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {/* Wrap children to propagate aria-describedby and capture focus */}
      <span
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
      >
        {typeof children === 'object' && children !== null && 'props' in children
          ? React.cloneElement(children as React.ReactElement, {
              'aria-describedby': visible ? tooltipId : undefined,
            })
          : children}
      </span>

      <AnimatePresence>
        {visible && (
          <motion.span
            id={tooltipId}
            role="tooltip"
            initial={{ opacity: 0, y: isTop ? 4 : -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isTop ? 4 : -4, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`pointer-events-none absolute left-1/2 z-50 w-60 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 shadow-xl ${
              isTop ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
          >
            {content}
            {/* Arrow */}
            <span
              aria-hidden="true"
              className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
                isTop
                  ? 'top-full border-t-slate-900'
                  : 'bottom-full border-b-slate-900'
              }`}
            />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
};

// ---------------------------------------------------------------------------
// ConfigLabel — wraps a configuration input label with an info (?) icon
// that shows a tooltip explaining the technical term on hover.
//
// Usage:
//   <ConfigLabel label="SEP-10 Challenge Window" tooltip="The time window (in seconds) ..." />
// ---------------------------------------------------------------------------

export interface ConfigLabelProps {
  /** The visible label text */
  label: string;
  /** Explanatory helper text shown in the tooltip */
  tooltip: string;
  /** HTML `for` attribute forwarded to the <label> element */
  htmlFor?: string;
  /** Extra classes on the outer wrapper */
  className?: string;
}

export const ConfigLabel: React.FC<ConfigLabelProps> = ({
  label,
  tooltip,
  htmlFor,
  className = '',
}) => (
  <label
    htmlFor={htmlFor}
    className={`mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-400 ${className}`}
  >
    {label}
    <Tooltip content={tooltip}>
      <button
        type="button"
        aria-label={`Help: ${label}`}
        className="flex items-center rounded text-slate-500 transition-colors hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        tabIndex={0}
      >
        <HelpCircle size={13} aria-hidden="true" />
      </button>
    </Tooltip>
  </label>
);

// ---------------------------------------------------------------------------
// Pre-built labels for common anchor configuration terms
// ---------------------------------------------------------------------------

export const SEP10ChallengWindowLabel: React.FC<{ htmlFor?: string }> = ({ htmlFor }) => (
  <ConfigLabel
    htmlFor={htmlFor}
    label="SEP-10 Challenge Window"
    tooltip="The time window (in seconds) during which a signed SEP-10 challenge transaction is considered valid. Typical range: 300–900 s."
  />
);

export const JwtTtlLabel: React.FC<{ htmlFor?: string }> = ({ htmlFor }) => (
  <ConfigLabel
    htmlFor={htmlFor}
    label="JWT TTL"
    tooltip="Time-to-live for the JWT issued after a successful SEP-10 authentication. Determines how long a user session stays active before re-authentication is required."
  />
);

export const HotWalletThresholdLabel: React.FC<{ htmlFor?: string }> = ({ htmlFor }) => (
  <ConfigLabel
    htmlFor={htmlFor}
    label="Hot Wallet Threshold"
    tooltip="The minimum XLM balance to maintain in the anchor's hot (signing) wallet. Transactions are paused when the balance falls below this threshold to prevent failed operations."
  />
);

export default Tooltip;
