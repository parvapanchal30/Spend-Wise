import type { GuardianDeadline, Transaction } from '@/domain/models';
import type { ReminderService } from '@/services/contracts';
import { buildGuardianDeadlines } from '@/utils/deadlines';

export class LocalReminderService implements ReminderService {
  getDeadlines(
    transactions: Transaction[],
    now = new Date(),
  ): GuardianDeadline[] {
    return buildGuardianDeadlines(transactions, now);
  }
}
