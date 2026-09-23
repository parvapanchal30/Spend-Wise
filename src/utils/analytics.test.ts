import type { Transaction } from '@/domain/models';
import { findRecurringExpenses, getMonthlyTrend, shiftMonth, summarizeMonth } from '@/utils/analytics';
const make = (overrides: Partial<Transaction> = {}): Transaction => ({ id: 'one', merchant: 'Store', purchaseDate: '2026-09-10', total: 100, currency: 'INR', category: 'Food', lineItems: [], source: 'manual', createdAt: '2026-09-10T00:00:00Z', updatedAt: '2026-09-10T00:00:00Z', ...overrides });
test('analytics keep currencies and months separate', () => {
  const summary = summarizeMonth([make(), make({currency:'USD',total:999}), make({purchaseDate:'2026-08-10', total:50})], '2026-09', 'INR');
  expect(summary.total).toBe(100); expect(summary.previous).toBe(50); expect(summary.change).toBe(100);
  expect(summary.categories).toEqual([{name:'Food',total:100}]);
});
test('month navigation and trend cross year boundaries', () => {
  expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  expect(getMonthlyTrend([], '2026-02', 'INR').map((item) => item.month)).toEqual(['2025-09','2025-10','2025-11','2025-12','2026-01','2026-02']);
});
test('repeat visits in one month do not imply a subscription', () => {
  expect(findRecurringExpenses([make(),make({id:'two'})], 'INR')).toEqual([]);
  expect(findRecurringExpenses([make(),make({purchaseDate:'2026-08-10'}),make({purchaseDate:'2026-07-10'})], 'INR')[0]?.confirmed).toBe(false);
  expect(findRecurringExpenses([make({recurring:true})], 'INR')[0]?.confirmed).toBe(true);
});
