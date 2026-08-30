import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  ExtractedReceipt,
  GuardianDeadline,
  MonthlyUsage,
  SubscriptionPlan,
  Transaction,
} from '@/domain/models';
import { services } from '../services/serviceContainer';

const fallbackPlan: SubscriptionPlan = {
  id: 'free',
  name: 'Free',
  monthlyTransactionLimit: 50,
  isMock: true,
};

const fallbackUsage: MonthlyUsage = {
  period: '',
  transactionsUsed: 0,
  limit: 50,
  remaining: 50,
  isLimitReached: false,
};

interface AppContextValue {
  transactions: Transaction[];
  deadlines: GuardianDeadline[];
  plan: SubscriptionPlan;
  usage: MonthlyUsage;
  pendingExtraction: ExtractedReceipt | null;
  isLoading: boolean;
  error: string | null;
  refresh(): Promise<void>;
  saveTransaction(transaction: Transaction): Promise<void>;
  resetDemoData(): Promise<void>;
  setPendingExtraction(extraction: ExtractedReceipt | null): void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [plan, setPlan] = useState<SubscriptionPlan>(fallbackPlan);
  const [usage, setUsage] = useState<MonthlyUsage>(fallbackUsage);
  const [pendingExtraction, setPendingExtraction] =
    useState<ExtractedReceipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateDerivedState = useCallback(
    (nextTransactions: Transaction[], nextPlan: SubscriptionPlan) => {
      setTransactions(nextTransactions);
      setPlan(nextPlan);
      setUsage(
        services.entitlements.getMonthlyUsage(nextTransactions, nextPlan),
      );
    },
    [],
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextTransactions, nextPlan] = await Promise.all([
        services.transactions.list(),
        services.entitlements.getCurrentPlan(),
      ]);
      updateDerivedState(nextTransactions, nextPlan);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'SpendWise could not load local data.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [updateDerivedState]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void refresh();
    }, 0);

    return () => clearTimeout(timeout);
  }, [refresh]);

  const saveTransaction = useCallback(
    async (transaction: Transaction) => {
      if (!services.entitlements.canSaveTransaction(usage)) {
        throw new Error('The mock Free plan monthly limit has been reached.');
      }
      await services.transactions.save(transaction);
      const nextTransactions = await services.transactions.list();
      updateDerivedState(nextTransactions, plan);
      setPendingExtraction(null);
    },
    [plan, updateDerivedState, usage],
  );

  const resetDemoData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextTransactions = await services.transactions.resetDemoData();
      updateDerivedState(nextTransactions, plan);
      setPendingExtraction(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Demo data could not be reset.',
      );
      throw caughtError;
    } finally {
      setIsLoading(false);
    }
  }, [plan, updateDerivedState]);

  const deadlines = useMemo(
    () => services.reminders.getDeadlines(transactions),
    [transactions],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      transactions,
      deadlines,
      plan,
      usage,
      pendingExtraction,
      isLoading,
      error,
      refresh,
      saveTransaction,
      resetDemoData,
      setPendingExtraction,
    }),
    [
      deadlines,
      error,
      isLoading,
      pendingExtraction,
      plan,
      refresh,
      resetDemoData,
      saveTransaction,
      transactions,
      usage,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useSpendWise(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useSpendWise must be used inside AppProvider.');
  }
  return context;
}
