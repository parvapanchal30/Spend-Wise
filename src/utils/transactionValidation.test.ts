import type { Transaction } from '@/domain/models';
import { validateTransaction } from '@/utils/transactionValidation';

const transaction: Transaction = { id: 'a', merchant: 'Shop', purchaseDate: '2026-09-20', total: 10, currency: 'INR', category: 'Other', lineItems: [], source: 'manual', createdAt: '2026-09-20T12:00:00.000Z', updatedAt: '2026-09-20T12:00:00.000Z' };

describe('transaction boundary validation', () => {
  it.each([
    { total: Number.NaN }, { total: Infinity }, { total: -1 }, { currency: 'inr' }, { purchaseDate: '2026-02-30' },
    { lineItems: null }, { tags: [7] }, { source: ['manual'] }, { recurring: 'yes' }, { guardianStatus: { return: 'deleted' } },
    { returnDeadline: { date: '2026-08-01', certainty: 'confirmed' } }, { createdAt: 'not-a-timestamp' },
    { receiptDocument: { id: 'a', uri: 'javascript:alert(1)', importedAt: transaction.createdAt } },
  ])('rejects malformed input %j', (changes) => {
    expect(() => validateTransaction({ ...transaction, ...changes })).toThrow();
  });

  it('copies nested fields to prevent external mutation', () => {
    const original = { ...transaction, tags: ['work'], guardianStatus: { return: 'active' as const } };
    const copy = validateTransaction(original);
    original.tags.push('changed');
    expect(copy.tags).toEqual(['work']);
    expect(copy.guardianStatus).not.toBe(original.guardianStatus);
  });
});
