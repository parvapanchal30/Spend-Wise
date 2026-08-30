import type {
  DeadlineUrgency,
  GuardianDeadline,
  Transaction,
} from '@/domain/models';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function atLocalMidnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function isoDateToTimestamp(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, month! - 1, day).getTime();
}

export function daysUntil(date: string, now = new Date()): number {
  return Math.ceil(
    (isoDateToTimestamp(date) - atLocalMidnight(now)) / MILLISECONDS_PER_DAY,
  );
}

export function calculateDeadlineUrgency(
  date: string,
  now = new Date(),
): DeadlineUrgency {
  const days = daysUntil(date, now);
  if (days < 0) {
    return 'overdue';
  }
  if (days <= 3) {
    return 'urgent';
  }
  if (days <= 14) {
    return 'soon';
  }
  return 'upcoming';
}

export function buildGuardianDeadlines(
  transactions: Transaction[],
  now = new Date(),
): GuardianDeadline[] {
  const deadlines = transactions.flatMap<GuardianDeadline>((transaction) => {
    const productName = transaction.lineItems[0]?.name ?? 'Purchase';
    const entries: GuardianDeadline[] = [];

    if (transaction.returnDeadline) {
      entries.push({
        id: `${transaction.id}-return`,
        transactionId: transaction.id,
        kind: 'return',
        date: transaction.returnDeadline.date,
        certainty: transaction.returnDeadline.certainty,
        urgency: calculateDeadlineUrgency(transaction.returnDeadline.date, now),
        merchant: transaction.merchant,
        productName,
      });
    }

    if (transaction.warrantyExpiry) {
      entries.push({
        id: `${transaction.id}-warranty`,
        transactionId: transaction.id,
        kind: 'warranty',
        date: transaction.warrantyExpiry.date,
        certainty: transaction.warrantyExpiry.certainty,
        urgency: calculateDeadlineUrgency(transaction.warrantyExpiry.date, now),
        merchant: transaction.merchant,
        productName,
      });
    }

    return entries;
  });

  return deadlines.sort((left, right) => left.date.localeCompare(right.date));
}
