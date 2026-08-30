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
): number {
  const currentMonth = monthKey(now);
  return transactions
    .filter((transaction) => transaction.purchaseDate.startsWith(currentMonth))
    .reduce((total, transaction) => total + transaction.total, 0);
}

export function sortTransactionsNewestFirst(
  transactions: Transaction[],
): Transaction[] {
  return [...transactions].sort((left, right) =>
    right.purchaseDate.localeCompare(left.purchaseDate),
  );
}
