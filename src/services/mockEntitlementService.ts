import type {
  MonthlyUsage,
  SubscriptionPlan,
  Transaction,
} from '@/domain/models';
import type { EntitlementService } from '@/services/contracts';
import { calculateMonthlyUsage } from '@/utils/usage';

const FREE_PLAN: SubscriptionPlan = {
  id: 'free',
  name: 'Free',
  monthlyTransactionLimit: 50,
  isMock: true,
};

export class MockEntitlementService implements EntitlementService {
  async getCurrentPlan(): Promise<SubscriptionPlan> {
    return FREE_PLAN;
  }

  getMonthlyUsage(
    transactions: Transaction[],
    plan: SubscriptionPlan,
    now = new Date(),
  ): MonthlyUsage {
    return calculateMonthlyUsage(transactions, plan, now);
  }

  canSaveTransaction(usage: MonthlyUsage): boolean {
    return !usage.isLimitReached;
  }
}
