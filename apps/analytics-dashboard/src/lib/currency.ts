import { useState, useEffect, useCallback } from 'react';

export type CurrencyMode = 'INR' | 'USD';

export const DEFAULT_USD_TO_INR_RATE = 100;
const STORAGE_KEY_RATE = 'evebash_usd_to_inr_rate';
const STORAGE_KEY_CURRENCY = 'evebash_active_currency';
const STORAGE_KEY_LAST_SYNCED = 'evebash_rate_last_synced';
const STORAGE_KEY_MARKET_RATE = 'evebash_market_rate';
const CURRENCY_CHANGE_EVENT = 'evebash-currency-change';

export function getStoredExchangeRate(): number {
  if (typeof window === 'undefined') return DEFAULT_USD_TO_INR_RATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RATE);
    if (!raw) return DEFAULT_USD_TO_INR_RATE;
    const parsed = parseFloat(raw);
    return isNaN(parsed) || parsed <= 0 ? DEFAULT_USD_TO_INR_RATE : parsed;
  } catch {
    return DEFAULT_USD_TO_INR_RATE;
  }
}

export function setStoredExchangeRate(rate: number): void {
  if (typeof window === 'undefined') return;
  try {
    const validRate = isNaN(rate) || rate <= 0 ? DEFAULT_USD_TO_INR_RATE : rate;
    localStorage.setItem(STORAGE_KEY_RATE, String(validRate));
    window.dispatchEvent(new CustomEvent(CURRENCY_CHANGE_EVENT, { detail: { rate: validRate } }));
  } catch (err) {
    console.warn('Failed to store exchange rate:', err);
  }
}

export function getStoredCurrency(): CurrencyMode {
  if (typeof window === 'undefined') return 'INR';
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CURRENCY);
    return raw === 'USD' ? 'USD' : 'INR';
  } catch {
    return 'INR';
  }
}

export function setStoredCurrency(currency: CurrencyMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CURRENCY, currency);
    window.dispatchEvent(new CustomEvent(CURRENCY_CHANGE_EVENT, { detail: { currency } }));
  } catch (err) {
    console.warn('Failed to store currency:', err);
  }
}

export async function fetchLiveUsdToInrRate(): Promise<{ rate: number; error?: string }> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const liveRate = data?.rates?.INR;
    if (typeof liveRate === 'number' && liveRate > 0) {
      const rounded = Math.round(liveRate * 100) / 100;
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_MARKET_RATE, String(rounded));
        localStorage.setItem(STORAGE_KEY_LAST_SYNCED, new Date().toISOString());
      }
      return { rate: rounded };
    }
    throw new Error('INR rate not found in response');
  } catch (err: any) {
    return { rate: DEFAULT_USD_TO_INR_RATE, error: err?.message || 'Failed to fetch live rate' };
  }
}

export function useCurrency() {
  const [currency, setCurrencyState] = useState<CurrencyMode>(getStoredCurrency);
  const [rate, setRateState] = useState<number>(getStoredExchangeRate);
  const [rateInput, setRateInputState] = useState<string>(() => String(getStoredExchangeRate()));
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string>('');
  const [marketRate, setMarketRate] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY_MARKET_RATE);
    return raw ? parseFloat(raw) : null;
  });
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY_LAST_SYNCED);
  });

  // Keep state synchronized with storage and cross-component custom events
  useEffect(() => {
    const handleCurrencyChange = (e: Event) => {
      const custom = e as CustomEvent<{ currency?: CurrencyMode; rate?: number }>;
      if (custom.detail) {
        if (custom.detail.currency !== undefined) {
          setCurrencyState(custom.detail.currency);
        }
        if (custom.detail.rate !== undefined) {
          setRateState(custom.detail.rate);
          setRateInputState(String(custom.detail.rate));
        }
      } else {
        setCurrencyState(getStoredCurrency());
        const storedRate = getStoredExchangeRate();
        setRateState(storedRate);
        setRateInputState(String(storedRate));
      }
    };

    window.addEventListener(CURRENCY_CHANGE_EVENT, handleCurrencyChange);
    window.addEventListener('storage', handleCurrencyChange);
    return () => {
      window.removeEventListener(CURRENCY_CHANGE_EVENT, handleCurrencyChange);
      window.removeEventListener('storage', handleCurrencyChange);
    };
  }, []);

  const setCurrency = useCallback((newCurr: CurrencyMode) => {
    setCurrencyState(newCurr);
    setStoredCurrency(newCurr);
  }, []);

  const setRate = useCallback((newRate: number) => {
    const validRate = isNaN(newRate) || newRate <= 0 ? DEFAULT_USD_TO_INR_RATE : newRate;
    setRateState(validRate);
    setRateInputState(String(validRate));
    setStoredExchangeRate(validRate);
  }, []);

  const handleRateInputChange = useCallback((raw: string) => {
    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
      setRateInputState(raw);
      const parsed = parseFloat(raw);
      if (!isNaN(parsed) && parsed > 0) {
        setRateState(parsed);
        setStoredExchangeRate(parsed);
      }
    }
  }, []);

  const syncLiveRate = useCallback(async () => {
    setIsSyncing(true);
    setSyncError('');
    try {
      const result = await fetchLiveUsdToInrRate();
      if (result.error) {
        setSyncError(result.error);
      } else {
        setRate(result.rate);
        setMarketRate(result.rate);
        setLastSyncedAt(new Date().toISOString());
      }
    } catch (err: any) {
      setSyncError(err?.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [setRate]);

  // Formatter helper: converts USD cost to current display string
  const formatCost = useCallback((amountUsd: number, decimals: number = 2): string => {
    if (amountUsd == null || isNaN(amountUsd)) return currency === 'INR' ? '₹0.00' : '$0.00';
    if (currency === 'USD') {
      return `$${amountUsd.toFixed(decimals)}`;
    }
    const inrValue = amountUsd * rate;
    return `₹${inrValue.toFixed(decimals)}`;
  }, [currency, rate]);

  const toDisplayValue = useCallback((amountUsd: number): number => {
    if (amountUsd == null || isNaN(amountUsd)) return 0;
    return currency === 'USD' ? amountUsd : amountUsd * rate;
  }, [currency, rate]);

  const currencySymbol = currency === 'INR' ? '₹' : '$';

  return {
    currency,
    setCurrency,
    rate,
    setRate,
    rateInput,
    handleRateInputChange,
    syncLiveRate,
    isSyncing,
    syncError,
    marketRate,
    lastSyncedAt,
    formatCost,
    toDisplayValue,
    currencySymbol,
  };
}
