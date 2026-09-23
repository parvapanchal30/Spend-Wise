import type {
  ExtractedReceipt,
  GuardianDeadline,
  MonthlyUsage,
  ReceiptDocument,
  SubscriptionPlan,
  Transaction,
} from '@/domain/models';

export interface TransactionRepository {
  list(): Promise<Transaction[]>;
  getById(id: string): Promise<Transaction | null>;
  save(transaction: Transaction): Promise<void>;
  saveMany(transactions: Transaction[]): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

export interface ReceiptExtractor {
  extract(document: ReceiptDocument): Promise<ExtractedReceipt>;
}

export interface EntitlementService {
  getCurrentPlan(): Promise<SubscriptionPlan>;
  getMonthlyUsage(
    transactions: Transaction[],
    plan: SubscriptionPlan,
    now?: Date,
  ): MonthlyUsage;
  canSaveTransaction(usage: MonthlyUsage): boolean;
}

export interface ReminderService {
  getDeadlines(transactions: Transaction[], now?: Date): GuardianDeadline[];
}
