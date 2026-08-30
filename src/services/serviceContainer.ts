import { LocalReminderService } from '@/services/localReminderService';
import { LocalTransactionRepository } from '@/services/localTransactionRepository';
import { MockEntitlementService } from '@/services/mockEntitlementService';
import { MockReceiptExtractor } from '@/services/mockReceiptExtractor';

export const services = {
  transactions: new LocalTransactionRepository(),
  extractor: new MockReceiptExtractor(),
  entitlements: new MockEntitlementService(),
  reminders: new LocalReminderService(),
};
