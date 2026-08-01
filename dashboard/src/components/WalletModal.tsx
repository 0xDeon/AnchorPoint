import { AnimatePresence, motion } from 'framer-motion';
import { Wallet2, X } from 'lucide-react';
import type { ReactNode } from 'react';

type WalletOption = {
  id: 'freighter' | 'albedo' | 'rango';
  name: string;
  description: string;
  accent: string;
};

type WalletModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (walletId: WalletOption['id']) => void;
  children?: ReactNode;
};

const walletOptions: WalletOption[] = [
  {
    id: 'freighter',
    name: 'Freighter',
    description: 'Connect your Stellar account with the Freighter browser extension.',
    accent: 'from-sky-500/20 to-cyan-500/20',
  },
  {
    id: 'albedo',
    name: 'Albedo',
    description: 'Use the Albedo wallet for a quick sign-in flow.',
    accent: 'from-fuchsia-500/20 to-violet-500/20',
  },
  {
    id: 'rango',
    name: 'Rango',
    description: 'Open the Rango wallet experience for cross-chain access.',
    accent: 'from-emerald-500/20 to-lime-500/20',
  },
];

export const WalletModal = ({ isOpen, onClose, onSelect, children }: WalletModalProps) => (
  <AnimatePresence>
    {isOpen ? (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Connect wallet"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950/95 p-5 shadow-2xl shadow-black/40"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Connect a wallet</p>
              <h2 className="mt-1 font-display text-2xl font-bold">Choose your provider</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-900 hover:text-slate-200"
              aria-label="Close wallet dialog"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-3">
            {walletOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(option.id)}
                className={`flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-gradient-to-r p-4 text-left transition hover:border-primary/40 hover:bg-slate-900 ${option.accent}`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70">
                  <Wallet2 size={18} aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold text-slate-100">{option.name}</p>
                  <p className="text-sm text-slate-400">{option.description}</p>
                </div>
              </button>
            ))}
          </div>

          {children ? <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-400">{children}</div> : null}
        </motion.div>
      </motion.div>
    ) : null}
  </AnimatePresence>
);

export default WalletModal;
