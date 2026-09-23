import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { ExtractedReceipt, GuardianDeadline, MonthlyUsage, SubscriptionPlan, Transaction } from '@/domain/models';
import { clearDocuments, persistDocument, removeDocument } from '@/services/documentStorage';
import { cancelReminders, syncReminders } from '@/services/notificationService';
import { getSettings, saveSettings, type Settings } from '@/services/settingsRepository';
import { services } from '@/services/serviceContainer';
import { deduplicateTransactions } from '@/utils/importExport';

const fallbackPlan: SubscriptionPlan = { id: 'free', name: 'Local', monthlyTransactionLimit: null, isMock: false };
const initialSettings: Settings = { defaultCurrency: 'INR', monthlyBudget: 0, notificationsEnabled: false, reminderDays: 3 };

interface AppContextValue {
  transactions: Transaction[];
  deadlines: GuardianDeadline[];
  settings: Settings;
  plan: SubscriptionPlan;
  usage: MonthlyUsage;
  pendingExtraction: ExtractedReceipt | null;
  isLoading: boolean;
  error: string | null;
  notificationMessage: string | null;
  refresh(): Promise<void>;
  saveTransaction(transaction: Transaction): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  importTransactions(transactions: Transaction[]): Promise<{ added: number; skipped: number }>;
  clearData(): Promise<void>;
  updateSettings(settings: Partial<Settings>): Promise<void>;
  setPendingExtraction(extraction: ExtractedReceipt | null): void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [plan, setPlan] = useState<SubscriptionPlan>(fallbackPlan);
  const [pendingExtraction, setPendingExtraction] = useState<ExtractedReceipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [today, setToday] = useState(() => new Date());
  const mutationQueue = useRef<Promise<unknown>>(Promise.resolve());
  const planRef = useRef(plan);
  const settingsRef = useRef(settings);
  useEffect(() => { planRef.current = plan; settingsRef.current = settings; }, [plan, settings]);

  // All reads that update UI and all mutations share a queue, including batch imports.
  const enqueue = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const next = mutationQueue.current.then(operation, operation);
    mutationQueue.current = next.catch(() => undefined);
    return next;
  }, []);

  const synchronizeReminders = useCallback(async (items: Transaction[], preferences: Settings) => {
    try { setNotificationMessage(await syncReminders(items, preferences)); }
    catch { setNotificationMessage('Your records are saved. Reminders could not be updated; check notification permissions in Settings.'); }
  }, []);

  const refresh = useCallback(() => enqueue(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await services.transactions.list();
      setTransactions(items);
      let preferences = settingsRef.current;
      try { preferences = await getSettings(); }
      catch { setError('Saved preferences could not be read. Your purchases are available; save your preferences again in Settings.'); }
      setSettings(preferences);
      settingsRef.current = preferences;
      setToday(new Date());
      // An unavailable store must not hide locally saved records.
      try {
        const nextPlan = await services.entitlements.getCurrentPlan();
        setPlan(nextPlan);
        planRef.current = nextPlan;
      } catch { setError('Purchases could not be refreshed. Your saved records are available.'); }
      await synchronizeReminders(items, preferences);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your saved data could not be loaded.');
    } finally { setIsLoading(false); }
  }), [enqueue, synchronizeReminders]);

  useEffect(() => {
    void refresh();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    const timer = setInterval(() => setToday(new Date()), 60000);
    return () => { listener.remove(); clearInterval(timer); };
  }, [refresh]);

  const saveTransaction = useCallback((transaction: Transaction) => enqueue(async () => {
    const current = await services.transactions.list();
    const previous = current.find((item) => item.id === transaction.id);
    const nextUsage = services.entitlements.getMonthlyUsage(current, planRef.current);
    if (!previous && !services.entitlements.canSaveTransaction(nextUsage)) throw new Error('Your monthly plan allowance has been reached. You can still edit and export existing records.');
    let saved = transaction;
    if (transaction.receiptDocument) saved = { ...transaction, receiptDocument: await persistDocument(transaction.receiptDocument) };
    try { await services.transactions.save(saved); }
    catch (caught) {
      if (saved.receiptDocument && saved.receiptDocument.uri !== transaction.receiptDocument?.uri) await removeDocument(saved.receiptDocument).catch(() => undefined);
      throw caught;
    }
    const items = await services.transactions.list();
    setTransactions(items);
    setPendingExtraction(null);
    setError(null);
    if (previous?.receiptDocument && previous.receiptDocument.uri !== saved.receiptDocument?.uri) await removeDocument(previous.receiptDocument).catch(() => undefined);
    await synchronizeReminders(items, settingsRef.current);
  }), [enqueue, synchronizeReminders]);

  const deleteTransaction = useCallback((id: string) => enqueue(async () => {
    const record = await services.transactions.getById(id);
    await services.transactions.delete(id);
    const items = await services.transactions.list();
    setTransactions(items);
    if (record?.receiptDocument && !items.some((item) => item.receiptDocument?.uri === record.receiptDocument?.uri)) await removeDocument(record.receiptDocument).catch(() => undefined);
    await synchronizeReminders(items, settingsRef.current);
  }), [enqueue, synchronizeReminders]);

  const importTransactions = useCallback((incoming: Transaction[]) => enqueue(async () => {
    const current = await services.transactions.list();
    const unique = deduplicateTransactions(incoming, current);
    const available = services.entitlements.getMonthlyUsage(current, planRef.current);
    if (available.remaining !== null && unique.transactions.length > available.remaining) throw new Error(`This import exceeds the remaining monthly allowance of ${available.remaining} records. No records were imported.`);
    await services.transactions.saveMany(unique.transactions);
    const items = await services.transactions.list();
    setTransactions(items);
    setError(null);
    await synchronizeReminders(items, settingsRef.current);
    return { added: unique.transactions.length, skipped: incoming.length - unique.transactions.length };
  }), [enqueue, synchronizeReminders]);

  const updateSettings = useCallback((patch: Partial<Settings>) => enqueue(async () => {
    const preferences = { ...settingsRef.current, ...patch };
    await saveSettings(preferences);
    settingsRef.current = preferences;
    setSettings(preferences);
    const items = await services.transactions.list();
    await synchronizeReminders(items, preferences);
  }), [enqueue, synchronizeReminders]);

  const clearData = useCallback(() => enqueue(async () => {
    const current = await services.transactions.list().catch(() => [] as Transaction[]);
    await services.transactions.clear();
    setTransactions([]);
    setPendingExtraction(null);
    for (const record of current) if (record.receiptDocument) await removeDocument(record.receiptDocument).catch(() => undefined);
    await cancelReminders().catch(() => setNotificationMessage('Records removed. Disable notifications in device settings if an old reminder remains.'));
    try { await clearDocuments(); }
    catch { throw new Error('Purchase records were removed, but some saved receipt files could not be deleted. Try this action again.'); }
    setError(null);
  }), [enqueue]);

  const deadlines = useMemo(() => services.reminders.getDeadlines(transactions, today), [transactions, today]);
  const usage = useMemo(() => services.entitlements.getMonthlyUsage(transactions, plan, today), [transactions, plan, today]);
  const value: AppContextValue = { transactions, deadlines, settings, plan, usage, pendingExtraction, isLoading, error, notificationMessage, refresh, saveTransaction, deleteTransaction, importTransactions, clearData, updateSettings, setPendingExtraction };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useSpendWise(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useSpendWise must be used inside AppProvider.');
  return context;
}
