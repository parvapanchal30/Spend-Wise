import type { Transaction } from '@/domain/models';
import {
  calculateMonthlySpending,
  searchTransactions,
} from '@/utils/transactions';

const transactions: Transaction[] = [
  {
    id: 'amazon',
    merchant: 'Amazon',
    purchaseDate: '2026-08-10',
    total: 8999,
    currency: 'INR',
    category: 'Electronics',
    lineItems: [{ id: 'headphones', name: 'Sony headphones', quantity: 1, unitPrice: 8999, total: 8999 }],
    source: 'demo',
    createdAt: '2026-08-10T00:00:00.000Z',
    updatedAt: '2026-08-10T00:00:00.000Z',
  },
  {
    id: 'dmart',
    merchant: 'DMart',
    purchaseDate: '2026-07-30',
    total: 2450,
    currency: 'INR',
    category: 'Groceries',
    lineItems: [{ id: 'groceries', name: 'Monthly groceries', quantity: 1, unitPrice: 2450, total: 2450 }],
    source: 'demo',
    createdAt: '2026-07-30T00:00:00.000Z',
    updatedAt: '2026-07-30T00:00:00.000Z',
  },
];

describe('transaction utilities', () => {
  it.each(['amazon', 'headphones', 'electronics'])(
    'searches merchant, product, and category for %s',
    (query) => {
      expect(searchTransactions(transactions, query).map(({ id }) => id)).toEqual(['amazon']);
    },
  );

  it('returns all transactions for a blank search', () => {
    expect(searchTransactions(transactions, '   ')).toHaveLength(2);
  });

  it('calculates spending only for the requested calendar month', () => {
    expect(calculateMonthlySpending(transactions, new Date(2026, 7, 20))).toBe(8999);
  });
});
