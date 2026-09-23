import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Transaction } from '@/domain/models';
import { AppProvider, useSpendWise } from '@/state/AppProvider';
import { services } from '@/services/serviceContainer';

jest.mock('@/services/documentStorage', () => ({ persistDocument: jest.fn(async (document) => document), removeDocument: jest.fn(async () => undefined), clearDocuments: jest.fn(async () => undefined) }));
jest.mock('@/services/notificationService', () => ({ syncReminders: jest.fn(async () => null), cancelReminders: jest.fn(async () => undefined) }));
jest.mock('@/services/settingsRepository', () => ({
  getSettings: jest.fn(async () => ({ defaultCurrency: 'INR', monthlyBudget: 0, notificationsEnabled: false, reminderDays: 3 })),
  saveSettings: jest.fn(async () => undefined),
}));
jest.mock('@/services/serviceContainer', () => ({ services: {
  transactions: { list: jest.fn(), getById: jest.fn(), save: jest.fn(), saveMany: jest.fn(), delete: jest.fn(), clear: jest.fn() },
  entitlements: { getCurrentPlan: jest.fn(), getMonthlyUsage: jest.fn(), canSaveTransaction: jest.fn() },
  reminders: { getDeadlines: jest.fn(() => []) },
} }));
const record: Transaction = { id: 'test-purchase', merchant: 'Shop', purchaseDate: '2026-09-01', total: 200, currency: 'INR', category: 'Food', lineItems: [], source: 'manual', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' };
const repository = jest.mocked(services.transactions);
const entitlement = jest.mocked(services.entitlements);
let records: Transaction[];
beforeEach(() => {
  jest.clearAllMocks(); records = [];
  repository.list.mockImplementation(async () => [...records]);
  repository.save.mockImplementation(async (item) => { records = [...records.filter((entry) => entry.id !== item.id), item]; });
  repository.saveMany.mockImplementation(async (items) => { records.push(...items); });
  repository.clear.mockImplementation(async () => { records = []; });
  entitlement.getCurrentPlan.mockResolvedValue({ id: 'free', name: 'Local', monthlyTransactionLimit: null, isMock: false });
  entitlement.getMonthlyUsage.mockImplementation((items) => ({ period: '2026-09', transactionsUsed: items.length, limit: null, remaining: null, isLimitReached: false }));
  entitlement.canSaveTransaction.mockReturnValue(true);
});
async function setup() {
  const hook = renderHook(() => useSpendWise(), { wrapper: AppProvider });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}
test('saves update current records; failed storage does not create a phantom purchase', async () => {
  const { result } = await setup();
  repository.save.mockRejectedValueOnce(new Error('Storage full'));
  await act(async () => { await expect(result.current.saveTransaction(record)).rejects.toThrow('Storage full'); });
  expect(result.current.transactions).toEqual([]);
  await act(async () => { await result.current.saveTransaction(record); });
  expect(result.current.transactions).toHaveLength(1);
});
test('existing purchases remain editable when a monthly allowance is exhausted', async () => {
  records = [record]; entitlement.canSaveTransaction.mockReturnValue(false);
  const { result } = await setup();
  await act(async () => { await result.current.saveTransaction({ ...record, merchant: 'Corrected' }); });
  expect(result.current.transactions[0]?.merchant).toBe('Corrected');
  await act(async () => { await expect(result.current.saveTransaction({ ...record, id: 'new' })).rejects.toThrow('allowance'); });
});
test('overlapping imports deduplicate against fresh data after the first operation', async () => {
  const { result } = await setup();
  let responses: { added: number; skipped: number }[] = [];
  await act(async () => { responses = await Promise.all([result.current.importTransactions([record]), result.current.importTransactions([record])]); });
  expect(responses).toEqual([{ added: 1, skipped: 0 }, { added: 0, skipped: 1 }]);
  expect(result.current.transactions).toHaveLength(1);
});
test('a billing outage never hides locally saved transactions', async () => {
  records = [record]; entitlement.getCurrentPlan.mockRejectedValueOnce(new Error('Offline'));
  const { result } = await setup();
  expect(result.current.transactions).toHaveLength(1);
  expect(result.current.error).toContain('Purchases could not be refreshed');
});
test('explicit clearing works even if saved data cannot be parsed', async () => {
  repository.list.mockRejectedValue(new Error('Corrupt data'));
  const { result } = await setup();
  await act(async () => { await result.current.clearData(); });
  expect(repository.clear).toHaveBeenCalled();
  expect(result.current.transactions).toEqual([]);
});
