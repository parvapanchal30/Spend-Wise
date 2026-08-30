import { calculateDeadlineUrgency, daysUntil } from '@/utils/deadlines';

const now = new Date(2026, 7, 30, 16, 0, 0);

describe('deadline urgency', () => {
  it('calculates whole calendar days independent of the current time', () => {
    expect(daysUntil('2026-09-01', now)).toBe(2);
  });

  it.each([
    ['2026-08-29', 'overdue'],
    ['2026-08-30', 'urgent'],
    ['2026-09-02', 'urgent'],
    ['2026-09-10', 'soon'],
    ['2026-10-01', 'upcoming'],
  ] as const)('marks %s as %s', (date, urgency) => {
    expect(calculateDeadlineUrgency(date, now)).toBe(urgency);
  });
});
