import { useState, useEffect, useCallback } from 'react';

interface Wallet {
  id: number;
  balance: string;
  currency: string;
}

interface Transaction {
  id: number;
  type: 'deposit' | 'withdrawal' | 'server_payment' | 'refund';
  amount: string;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  description: string;
  created_at: string;
}

export function useWallet() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/wallet', {
        headers: {
          'Content-Type': 'application/json'
        },
        cache: 'no-store'
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Auth error - user not authenticated, clear data but don't show error
          setWallet(null);
          setTransactions([]);
          setError(null);
          return;
        }
        const errorText = await res.text();
        console.error('API response not ok:', res.status, errorText);
        setError(`API error: ${res.status}`);
        return;
      }

      const data = await res.json();
      if (data.ok) {
        console.log('Wallet loaded:', data.wallet, 'Balance:', data.wallet?.balance);
        setWallet(data.wallet);
        setTransactions(data.transactions);
        setError(null);
      } else {
        console.error('API returned error:', data.error);
        setError(data.error);
      }
    } catch (err: any) {
      console.error('Load wallet error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const addFunds = useCallback(async (amount: number, description?: string) => {
    try {

      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount, description }),
        cache: 'no-store'
      });

      if (!res.ok) {
        if (res.status === 401) {
          return { success: false, error: 'Please sign in to add funds' };
        }
        const errorText = await res.text();
        console.error('Add funds API error:', res.status, errorText);
        return { success: false, error: `API error: ${res.status}` };
      }

      const data = await res.json();
      if (data.ok) {
        console.log('Funds added successfully, new balance:', data.balance);
        await loadWallet(); // Reload wallet data
        return { success: true, balance: data.balance };
      } else {
        console.error('Add funds returned error:', data.error);
        return { success: false, error: data.error };
      }
    } catch (err: any) {
      console.error('Add funds catch error:', err);
      return { success: false, error: err.message };
    }
  }, [loadWallet]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const balance = wallet ? parseFloat(wallet.balance) : 0;

  return {
    wallet,
    balance,
    transactions,
    loading,
    error,
    loadWallet,
    addFunds
  };
}