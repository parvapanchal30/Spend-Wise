import type {
  MonthlyUsage,
  SubscriptionPlan,
  Transaction,
} from '@/domain/models';
import { monthKey } from '@/utils/dates';

export function calculateMonthlyUsage(
  transactions: Transaction[],
  plan: SubscriptionPlan,
  now = new Date(),
): MonthlyUsage {
  const period = monthKey(now);
  const transactionsUsed = transactions.filter((transaction) =>
    transaction.createdAt.startsWith(period),
  ).length;
  const remaining =
    plan.monthlyTransactionLimit === null
      ? null
      : Math.max(plan.monthlyTransactionLimit - transactionsUsed, 0);

  return {
    period,
    transactionsUsed,
    limit: plan.monthlyTransactionLimit,
    remaining,
    isLimitReached:
      plan.monthlyTransactionLimit !== null &&
      transactionsUsed >= plan.monthlyTransactionLimit,
  };
}
