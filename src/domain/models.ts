export type DeadlineKind = 'return' | 'warranty';
export type DeadlineCertainty = 'confirmed' | 'estimated';
export type DeadlineUrgency = 'overdue' | 'urgent' | 'soon' | 'upcoming';
export type SubscriptionPlanId = 'free' | 'pro' | 'premium';

export interface LineItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptDocument {
  id: string;
  uri: string;
  fileName?: string;
  mimeType?: string;
  importedAt: string;
}

export interface TransactionDeadline {
  date: string;
  certainty: DeadlineCertainty;
}

export interface Transaction {
  id: string;
  merchant: string;
  purchaseDate: string;
  total: number;
  currency: string;
  category: string;
  lineItems: LineItem[];
  receiptDocument?: ReceiptDocument;
  returnDeadline?: TransactionDeadline;
  warrantyExpiry?: TransactionDeadline;
  source: 'demo' | 'receipt' | 'manual' | 'csv';
  notes?: string;
  tags?: string[];
  rawText?: string;
  recurring?: boolean;
  guardianStatus?: { return?: 'active' | 'resolved'; warranty?: 'active' | 'resolved' };
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionConfidence {
  merchant: number;
  purchaseDate: number;
  total: number;
  currency: number;
  category: number;
  productName: number;
  returnDeadline: number;
  warrantyExpiry: number;
}

export interface ExtractedReceipt {
  document?: ReceiptDocument;
  rawText?: string;
  notes?: string;
  lineItems?: LineItem[];
  source?: 'receipt' | 'manual' | 'csv';
  extractionMethod?: 'ocr' | 'manual' | 'text';
  merchant: string;
  purchaseDate: string;
  total: number;
  currency: string;
  category: string;
  productName: string;
  returnDeadline: TransactionDeadline;
  warrantyExpiry: TransactionDeadline;
  confidence: ExtractionConfidence;
}

export interface GuardianDeadline {
  id: string;
  transactionId: string;
  kind: DeadlineKind;
  date: string;
  certainty: DeadlineCertainty;
  urgency: DeadlineUrgency;
  merchant: string;
  productName: string;
}

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  monthlyTransactionLimit: number | null;
  isMock: boolean;
}

export interface MonthlyUsage {
  period: string;
  transactionsUsed: number;
  limit: number | null;
  remaining: number | null;
  isLimitReached: boolean;
}
