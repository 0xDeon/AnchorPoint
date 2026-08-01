import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

type NetworkType = 'TESTNET' | 'PUBLIC' | 'FUTURENET';

interface NetworkSelectorProps {
  apiBaseUrl: string;
}

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({ apiBaseUrl }) => {
  const [network, setNetwork] = useState<NetworkType>('TESTNET');
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetNetwork, setTargetNetwork] = useState<NetworkType>('TESTNET');

  useEffect(() => {
    fetchCurrentNetwork();
  }, []);

  const fetchCurrentNetwork = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/network`);
      if (response.ok) {
        const data = await response.json();
        if (data.network) {
          setNetwork(data.network);
        }
      }
    } catch (err) {
      console.error('Failed to fetch network config:', err);
    }
  };

  const handleNetworkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as NetworkType;
    if (value !== network) {
      setTargetNetwork(value);
      setIsModalOpen(true);
    }
  };

  const handleNetworkChangeConfirm = async () => {
    setIsModalOpen(false);
    setLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/network`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ network: targetNetwork }),
      });

      if (!response.ok) {
        throw new Error('Failed to switch network');
      }

      setNetwork(targetNetwork);
    } catch (err) {
      console.error('Error switching network:', err);
    } finally {
      setLoading(false);
    }
  };

  const networkColor = (net: NetworkType) => {
    switch (net) {
      case 'PUBLIC':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'FUTURENET':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`hidden rounded-full border px-2.5 py-1 text-xs font-semibold md:inline ${networkColor(network)}`}>
        {network}
      </span>

      {network === 'PUBLIC' && (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-400">
          <AlertTriangle size={12} aria-hidden="true" />
          Mainnet
        </span>
      )}

      <label htmlFor="network-selector" className="sr-only">
        Select Stellar Network
      </label>
      <select
        id="network-selector"
        value={network}
        onChange={handleNetworkChange}
        disabled={loading}
        className="input-field text-sm font-medium pr-8"
      >
        <option value="TESTNET">TESTNET</option>
        <option value="PUBLIC">PUBLIC (Mainnet)</option>
        <option value="FUTURENET">FUTURENET</option>
      </select>

      <ConfirmModal
        isOpen={isModalOpen}
        title="Switch Stellar Network?"
        message={`Are you sure you want to switch the Stellar network to ${targetNetwork}? This will alter system configurations, clear session indexes, and disconnect active client configurations.`}
        confirmText={`Switch to ${targetNetwork}`}
        requireTypingConfirm={true}
        onConfirm={handleNetworkChangeConfirm}
        onCancel={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default NetworkSelector;
