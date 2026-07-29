import React, { useId, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const tooltipVariants = {
  hidden: { opacity: 0, y: 4, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.15, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: 4,
    scale: 0.97,
    transition: { duration: 0.1, ease: 'easeIn' },
  },
};

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface TooltipProps {
  /** Explanatory text shown in the floating bubble. */
  content: string;
  /** Element that triggers the tooltip. */
  children: React.ReactNode;
  /**
   * Preferred placement relative to the trigger.
   * @default 'top'
   */
  placement?: 'top' | 'bottom';
}

/**
 * Animated tooltip that wraps any element.
 * Reveals on hover **and** keyboard focus for full accessibility.
 *
 * @example
 * <Tooltip content="The duration the SEP-10 challenge is valid.">
 *   <input … />
 * </Tooltip>
 */
const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  placement = 'top',
}) => {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  const isTop = placement === 'top';

  return (
    <span className="relative inline-flex items-center">
      <span
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
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
            key="tooltip"
            variants={tooltipVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={[
              'pointer-events-none absolute left-1/2 z-50 w-64 -translate-x-1/2 rounded-lg',
              'border border-slate-600 bg-slate-800 px-3 py-2 text-xs leading-relaxed text-slate-200 shadow-xl',
              isTop ? 'bottom-full mb-2' : 'top-full mt-2',
            ].join(' ')}
          >
            {content}
            {/* Arrow */}
            <span
              aria-hidden="true"
              className={[
                'absolute left-1/2 -translate-x-1/2 border-4 border-transparent',
                isTop
                  ? 'top-full border-t-slate-800'
                  : 'bottom-full border-b-slate-800',
              ].join(' ')}
            />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
};

// ---------------------------------------------------------------------------
// InfoTooltip — convenience component for configuration label help icons
// ---------------------------------------------------------------------------

/**
 * Pre-built help icon `(?)` that shows an explanatory tooltip on hover.
 *
 * Designed to sit inline next to a form label:
 * ```tsx
 * <label>
 *   SEP-10 Challenge Window
 *   <InfoTooltip content="Time window in seconds during which a signed challenge is accepted." />
 * </label>
 * ```
 */
export const InfoTooltip: React.FC<{ content: string; placement?: 'top' | 'bottom' }> = ({
  content,
  placement = 'top',
}) => (
  <Tooltip content={content} placement={placement}>
    <button
      type="button"
      aria-label={`Help: ${content}`}
      tabIndex={0}
      className="ml-1.5 inline-flex cursor-help items-center rounded-full text-slate-400 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-transparent"
    >
      <HelpCircle size={14} aria-hidden="true" />
    </button>
  </Tooltip>
);

// ---------------------------------------------------------------------------
// Pre-defined tooltips for common anchor configuration terms
// ---------------------------------------------------------------------------

/**
 * Ready-to-use `<InfoTooltip>` components for technical SEP terms.
 * Import and drop next to any matching configuration label.
 *
 * @example
 * import { AnchorConfigTooltips } from './Tooltip';
 * ...
 * <label>JWT TTL <AnchorConfigTooltips.JwtTtl /></label>
 */
export const AnchorConfigTooltips = {
  Sep10ChallengeWindow: () => (
    <InfoTooltip
      content="The time window (in seconds) during which a signed SEP-10 challenge transaction is considered valid. Defaults to 300 s. Expired challenges are rejected."
    />
  ),
  JwtTtl: () => (
    <InfoTooltip
      content="JSON Web Token time-to-live in seconds. After this period the JWT expires and the user must re-authenticate via SEP-10."
    />
  ),
  HotWalletThreshold: () => (
    <InfoTooltip
      content="Minimum XLM balance the hot wallet must maintain. Transactions that would drop below this threshold are queued until funds are topped up."
    />
  ),
} as const;

export default Tooltip;
