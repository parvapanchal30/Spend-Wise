import type { Transaction } from '@/domain/models';
import { monthKey } from '@/utils/dates';

export function shiftMonth(month: string, amount: number): string {
  const [year, number] = month.split('-').map(Number);
  return monthKey(new Date(year!, number! - 1 + amount, 1, 12));
}

export function summarizeMonth(transactions: Transaction[], month: string, currency: string) {
  const items = transactions.filter((item) => item.currency === currency && item.purchaseDate.startsWith(month));
  const round = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
  const total = round(items.reduce((sum, item) => sum + item.total, 0));
  const categoryTotals = new Map<string, number>();
  const merchantTotals = new Map<string, number>();
  items.forEach((item) => {
    categoryTotals.set(item.category, (categoryTotals.get(item.category) ?? 0) + item.total);
    merchantTotals.set(item.merchant, (merchantTotals.get(item.merchant) ?? 0) + item.total);
  });
  const sorted = (map: Map<string, number>) => Array.from(map, ([name, amount]) => ({ name, total: round(amount) })).sort((a, b) => b.total - a.total);
  const previousMonth = shiftMonth(month, -1);
  const previous = round(transactions.filter((item) => item.currency === currency && item.purchaseDate.startsWith(previousMonth)).reduce((sum, item) => sum + item.total, 0));
  return { items, total, previous, change: previous > 0 ? ((total - previous) / previous) * 100 : null, categories: sorted(categoryTotals), merchants: sorted(merchantTotals) };
}

export function getMonthlyTrend(transactions: Transaction[], month: string, currency: string) {
  return Array.from({ length: 6 }, (_, index) => {
    const period = shiftMonth(month, index - 5);
    return { month: period, total: summarizeMonth(transactions, period, currency).total };
  });
}

export function findRecurringExpenses(transactions: Transaction[], currency: string) {
  const groups = new Map<string, Transaction[]>();
  transactions.filter((item) => item.currency === currency).forEach((item) => {
    const key = item.merchant.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  return [...groups.values()].flatMap((items) => {
    const ordered = [...items].sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
    const latest = ordered[0]!;
    const distinctMonths = new Set(items.map((item) => item.purchaseDate.slice(0, 7)));
    const mean = items.reduce((sum, item) => sum + item.total, 0) / items.length;
    const stable = items.every((item) => Math.abs(item.total - mean) <= mean * 0.1);
    if (!latest.recurring && !(distinctMonths.size >= 3 && stable)) return [];
    return [{ merchant: latest.merchant, total: latest.total, confirmed: latest.recurring === true, occurrences: items.length, latestDate: latest.purchaseDate }];
  }).sort((a, b) => b.total - a.total);
}
