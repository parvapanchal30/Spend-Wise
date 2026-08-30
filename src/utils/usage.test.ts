import type { SubscriptionPlan, Transaction } from '@/domain/models';
import { calculateMonthlyUsage } from '@/utils/usage';

const freePlan: SubscriptionPlan = {
  id: 'free',
  name: 'Free',
  monthlyTransactionLimit: 2,
  isMock: true,
};

function transaction(id: string, createdAt: string): Transaction {
  return {
    id,
    merchant: 'Demo',
    purchaseDate: createdAt.slice(0, 10),
    total: 100,
    currency: 'INR',
    category: 'Other',
    lineItems: [],
    source: 'demo',
    createdAt,
    updatedAt: createdAt,
  };
}

describe('free-plan usage', () => {
  it('counts saves in the current month and reports the limit state', () => {
    const usage = calculateMonthlyUsage(
      [
        transaction('one', '2026-08-01T00:00:00.000Z'),
        transaction('two', '2026-08-10T00:00:00.000Z'),
        transaction('old', '2026-07-31T00:00:00.000Z'),
      ],
      freePlan,
      new Date(2026, 7, 30),
    );

    expect(usage.transactionsUsed).toBe(2);
    expect(usage.remaining).toBe(0);
    expect(usage.isLimitReached).toBe(true);
  });
});
