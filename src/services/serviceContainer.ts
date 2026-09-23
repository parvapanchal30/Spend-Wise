import { LocalReminderService } from '@/services/localReminderService';
import { LocalTransactionRepository } from '@/services/localTransactionRepository';
import { RevenueCatEntitlementService } from '@/services/entitlementService';
import { ReceiptExtractorService } from '@/services/receiptExtractor';

export const services = {
  transactions: new LocalTransactionRepository(),
  extractor: new ReceiptExtractorService(),
  entitlements: new RevenueCatEntitlementService(),
  reminders: new LocalReminderService(),
};
