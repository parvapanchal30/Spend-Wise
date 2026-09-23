import type { Transaction } from '@/domain/models';
import { monthKey } from '@/utils/dates';

export function searchTransactions(
  transactions: Transaction[],
  query: string,
): Transaction[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('en-IN');
  if (!normalizedQuery) {
    return transactions;
  }

  return transactions.filter((transaction) => {
    const searchableValues = [
      transaction.merchant,
      transaction.category,
      transaction.notes ?? '',
      ...(transaction.tags ?? []),
      ...transaction.lineItems.map((item) => item.name),
    ];

    return searchableValues.some((value) =>
      value.toLocaleLowerCase('en-IN').includes(normalizedQuery),
    );
  });
}

export function calculateMonthlySpending(
  transactions: Transaction[],
  now = new Date(),
  currency = 'INR',
): number {
  const currentMonth = monthKey(now);
  return transactions
    .filter((transaction) => transaction.purchaseDate.startsWith(currentMonth) && transaction.currency === currency)
    .reduce((total, transaction) => total + transaction.total, 0);
}

/** Possible duplicates are an aid to review, not proof of a duplicate purchase. */
export function transactionFingerprint(transaction: Pick<Transaction, 'merchant' | 'purchaseDate' | 'total' | 'currency'>): string {
  const merchant = transaction.merchant.trim().normalize('NFKC').toLocaleLowerCase('en-IN').replace(/\s+/g, ' ');
  return JSON.stringify([transaction.purchaseDate, merchant, transaction.total, transaction.currency.toUpperCase()]);
}

export function findDuplicateTransactions(candidate: Transaction, transactions: Transaction[]): Transaction[] {
  const fingerprint = transactionFingerprint(candidate);
  return transactions.filter((transaction) => transaction.id !== candidate.id && transactionFingerprint(transaction) === fingerprint);
}

export function deduplicateTransactions(candidates: Transaction[], existing: Transaction[] = []): { transactions: Transaction[]; duplicates: Transaction[] } {
  const ids = new Set(existing.map((transaction) => transaction.id));
  const fingerprints = new Set(existing.map(transactionFingerprint));
  const transactions: Transaction[] = [];
  const duplicates: Transaction[] = [];
  for (const candidate of candidates) {
    const fingerprint = transactionFingerprint(candidate);
    if (ids.has(candidate.id) || fingerprints.has(fingerprint)) {
      duplicates.push(candidate);
    } else {
      transactions.push(candidate);
      ids.add(candidate.id);
      fingerprints.add(fingerprint);
    }
  }
  return { transactions, duplicates };
}

export function sortTransactionsNewestFirst(
  transactions: Transaction[],
): Transaction[] {
  return [...transactions].sort((left, right) =>
    right.purchaseDate.localeCompare(left.purchaseDate),
  );
}
