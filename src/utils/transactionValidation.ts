import type { Transaction, TransactionDeadline } from '@/domain/models';
import { isValidIsoDate } from '@/utils/dates';

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as JsonObject;
}

function text(value: unknown, label: string, maxLength = 500, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.length > maxLength) {
    throw new Error(`${label} must be ${allowEmpty ? '' : 'nonempty '}text, up to ${maxLength} characters.`);
  }
  return value;
}

function number(value: unknown, label: string, allowZero = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER || (allowZero ? value < 0 : value <= 0)) {
    throw new Error(`${label} must be a finite ${allowZero ? 'nonnegative' : 'positive'} number.`);
  }
  return value;
}

function date(value: unknown, label: string): string {
  if (typeof value !== 'string' || !isValidIsoDate(value)) {
    throw new Error(`${label} must be a valid date in YYYY-MM-DD format.`);
  }
  return value;
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !isValidIsoDate(value.slice(0, 10)) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be an ISO timestamp including a timezone.`);
  }
  return value;
}

function deadline(value: unknown, label: string, purchaseDate: string): TransactionDeadline | undefined {
  if (value === undefined) return undefined;
  const input = object(value, label);
  const parsedDate = date(input.date, `${label} date`);
  if (parsedDate < purchaseDate) throw new Error(`${label} cannot be before the purchase date.`);
  if (input.certainty !== 'confirmed' && input.certainty !== 'estimated') {
    throw new Error(`${label} certainty must be confirmed or estimated.`);
  }
  return { date: parsedDate, certainty: input.certainty };
}

/** Validate and copy data at every persistence or import boundary. */
export function validateTransaction(value: unknown, label = 'Transaction'): Transaction {
  const input = object(value, label);
  const purchaseDate = date(input.purchaseDate, `${label} purchase date`);
  const currency = text(input.currency, `${label} currency`, 3);
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error(`${label} currency must be a three-letter uppercase currency code.`);
  if (typeof input.source !== 'string' || !['demo', 'receipt', 'manual', 'csv'].includes(input.source)) {
    throw new Error(`${label} has an unsupported source.`);
  }
  if (!Array.isArray(input.lineItems) || input.lineItems.length > 10000) {
    throw new Error(`${label} line items must be an array with at most 10,000 entries.`);
  }
  const lineItemIds = new Set<string>();
  const lineItems = input.lineItems.map((item, index) => {
    const itemLabel = `${label} item ${index + 1}`;
    const entry = object(item, itemLabel);
    const id = text(entry.id, `${itemLabel} ID`, 200);
    if (lineItemIds.has(id)) throw new Error(`${label} contains duplicate line-item IDs.`);
    lineItemIds.add(id);
    return {
      id,
      name: text(entry.name, `${itemLabel} name`, 1000),
      quantity: number(entry.quantity, `${itemLabel} quantity`),
      unitPrice: number(entry.unitPrice, `${itemLabel} price`, true),
      total: number(entry.total, `${itemLabel} total`, true),
    };
  });
  const result: Transaction = {
    id: text(input.id, `${label} ID`, 200),
    merchant: text(input.merchant, `${label} merchant`),
    purchaseDate,
    total: number(input.total, `${label} total`),
    currency,
    category: text(input.category, `${label} category`, 100),
    lineItems,
    source: input.source as Transaction['source'],
    createdAt: timestamp(input.createdAt, `${label} creation time`),
    updatedAt: timestamp(input.updatedAt, `${label} update time`),
  };
  const returnDeadline = deadline(input.returnDeadline, `${label} return deadline`, purchaseDate);
  const warrantyExpiry = deadline(input.warrantyExpiry, `${label} warranty expiry`, purchaseDate);
  if (returnDeadline) result.returnDeadline = returnDeadline;
  if (warrantyExpiry) result.warrantyExpiry = warrantyExpiry;
  if (input.receiptDocument !== undefined) {
    const document = object(input.receiptDocument, `${label} receipt`);
    const uri = text(document.uri, `${label} receipt location`, 15_000_000);
    if (!/^(?:file:|content:|blob:|https?:\/\/|data:image\/(?:png|jpeg|jpg|webp|heic);base64,)/i.test(uri)) {
      throw new Error(`${label} receipt location must use a supported file or image URL.`);
    }
    result.receiptDocument = {
      id: text(document.id, `${label} receipt ID`, 200),
      uri,
      importedAt: timestamp(document.importedAt, `${label} receipt import time`),
    };
    if (document.fileName !== undefined) result.receiptDocument.fileName = text(document.fileName, `${label} receipt filename`, 1000);
    if (document.mimeType !== undefined) result.receiptDocument.mimeType = text(document.mimeType, `${label} receipt type`, 100);
  }
  if (input.notes !== undefined) result.notes = text(input.notes, `${label} notes`, 20000, true);
  if (input.rawText !== undefined) result.rawText = text(input.rawText, `${label} receipt text`, 200000, true);
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags) || input.tags.length > 50) throw new Error(`${label} tags must be an array with at most 50 entries.`);
    result.tags = input.tags.map((tag) => text(tag, `${label} tag`, 100));
  }
  if (input.recurring !== undefined) {
    if (typeof input.recurring !== 'boolean') throw new Error(`${label} recurring flag must be true or false.`);
    result.recurring = input.recurring;
  }
  if (input.guardianStatus !== undefined) {
    const status = object(input.guardianStatus, `${label} guardian status`);
    result.guardianStatus = {};
    for (const kind of ['return', 'warranty'] as const) {
      if (status[kind] !== undefined) {
        if (status[kind] !== 'active' && status[kind] !== 'resolved') throw new Error(`${label} ${kind} status must be active or resolved.`);
        result.guardianStatus[kind] = status[kind];
      }
    }
  }
  return result;
}

export function validateTransactions(value: unknown): Transaction[] {
  if (!Array.isArray(value) || value.length > 100000) {
    throw new Error('Transactions must be an array with at most 100,000 entries.');
  }
  const ids = new Set<string>();
  return value.map((entry, index) => {
    const transaction = validateTransaction(entry, `Transaction ${index + 1}`);
    if (ids.has(transaction.id)) throw new Error(`Duplicate transaction ID: ${transaction.id}.`);
    ids.add(transaction.id);
    return transaction;
  });
}
