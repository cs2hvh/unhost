'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FaPlus } from 'react-icons/fa';
import { Loader2, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { calculateCryptoDepositFee, formatFeeStructure, MINIMUM_DEPOSIT_AMOUNT } from '@/config/fees';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { getCurrencies, createCryptoPayment } from '@/app/actions/crypto';
import toast from 'react-hot-toast';

interface CurrencyInfo {
  code: string;
  confirmations_required: number;
}

// Currency display names and info
const currencyInfo: Record<string, { name: string; network?: string }> = {
  'BTC': { name: 'Bitcoin' },
  'ETH': { name: 'Ethereum' },
  'LTC': { name: 'Litecoin' },
  'TRX': { name: 'Tron' },
  'USDT_ERC20': { name: 'USDT', network: 'ERC-20' },
  'USDT_TRC20': { name: 'USDT', network: 'TRC-20' },
};

export default function AddFundsSection() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [currencies, setCurrencies] = useState<CurrencyInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingCurrencies, setLoadingCurrencies] = useState(true);

  useEffect(() => {
    loadCurrencies();
  }, []);

  const loadCurrencies = async () => {
    setLoadingCurrencies(true);
    try {
      const result = await getCurrencies();

      if (result.success && result.currencies) {
        setCurrencies(result.currencies);
      } else {
        toast.error(result.error || 'Failed to load supported currencies');
      }
    } catch (error) {
      toast.error('Failed to load supported currencies');
    } finally {
      setLoadingCurrencies(false);
    }
  };

  const handleSubmit = async () => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!selectedCurrency) {
      toast.error('Please select a cryptocurrency');
      return;
    }

    const numAmount = parseFloat(amount);
    if (numAmount < MINIMUM_DEPOSIT_AMOUNT) {
      toast.error(`Minimum amount is $${MINIMUM_DEPOSIT_AMOUNT.toFixed(2)}`);
      return;
    }

    setIsLoading(true);

    try {
      const result = await createCryptoPayment({
        amount: numAmount,
        currency: selectedCurrency
      });

      if (!result.success || !result.order_id) {
        throw new Error(result.error || 'Failed to create payment');
      }

      toast.success('Redirecting to payment page...');

      // Reset form
      setAmount('');
      setSelectedCurrency('');

      // Redirect to payment page using order_id
      setTimeout(() => {
        router.push(`/payments/${result.order_id}`);
      }, 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create payment');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
      <CardHeader className="border-b border-white/10">
        <CardTitle className="text-white text-xl font-medium flex items-center space-x-3">
          <FaPlus className="h-5 w-5" />
          <span>Add Funds</span>
        </CardTitle>
        <CardDescription className="text-white/60">
          Add funds to your wallet using cryptocurrency
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {loadingCurrencies ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-white font-medium">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={MINIMUM_DEPOSIT_AMOUNT}
                step="0.01"
                disabled={isLoading}
                className="bg-white/5 border-white/10 text-white h-12"
              />
              <p className="text-xs text-white/60">
                Minimum: ${MINIMUM_DEPOSIT_AMOUNT.toFixed(2)}
              </p>
            </div>

            <div className="space-y-3">
              <Label className="text-white font-medium">Select Cryptocurrency</Label>

              <div className="grid grid-cols-2 gap-2">
                {currencies.map((currency) => {
                  const info = currencyInfo[currency.code];
                  const isEnabled = currency.code === 'USDT_TRC20' || currency.code === 'XMR' || currency.code === 'TRX';
                  return (
                    <Button
                      key={currency.code}
                      type="button"
                      variant="outline"
                      className={cn(
                        "h-16 p-3 flex items-center gap-3 transition-all bg-white/5 border-white/10 hover:bg-white/10",
                        selectedCurrency === currency.code
                          ? "border-primary bg-primary/10 ring-1 ring-primary"
                          : "hover:border-primary/50",
                        !isEnabled && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => setSelectedCurrency(
                        selectedCurrency === currency.code ? '' : currency.code
                      )}
                      disabled={isLoading || !isEnabled}
                    >
                      {currency.code && (
                        <Image
                          src={`https://ahura.blr1.cdn.digitaloceanspaces.com/currencies/${currency.code.toLowerCase()}.svg`}
                          alt={currency.code}
                          width={24}
                          height={24}
                          className="rounded-full flex-shrink-0"
                        />
                      )}
                      <div className="text-left flex-1 min-w-0">
                        <div className="font-medium text-sm truncate text-white">
                          {info?.name || currency.code}
                        </div>
                        <div className="text-xs text-white/60">
                          {info?.network ? `${currency.code} (${info.network})` : currency.code}
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>

            {amount && parseFloat(amount) >= MINIMUM_DEPOSIT_AMOUNT && selectedCurrency && (
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <h4 className="text-sm font-medium mb-2 text-white">Payment Summary</h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-white/80">
                    <span>Amount:</span>
                    <span className="font-medium text-white">${parseFloat(amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-white/80">
                    <span>Processing Fee:</span>
                    <span className="font-medium text-white">${calculateCryptoDepositFee(selectedCurrency, parseFloat(amount)).toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-white/60 mb-1">
                    {formatFeeStructure(selectedCurrency)}
                  </div>
                  <div className="border-t border-white/10 pt-1.5">
                    <div className="flex justify-between font-medium text-white">
                      <span>Total to Pay:</span>
                      <span>${(parseFloat(amount) + calculateCryptoDepositFee(selectedCurrency, parseFloat(amount))).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={isLoading || !amount || !selectedCurrency || loadingCurrencies}
              className="w-full bg-gradient-to-r from-[#3B82F6] to-[#1D4ED8] hover:from-[#2563EB] hover:to-[#1E40AF] text-white font-medium h-12 rounded-xl"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4 mr-2" />
                  Add Funds
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
