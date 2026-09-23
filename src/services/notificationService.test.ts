import type { Transaction } from '@/domain/models';
import { buildReminderSchedule, exportReminderCalendar } from '@/services/notificationService';

const record: Transaction = {
  id: 'purchase-1', merchant: 'Private store', purchaseDate: '2026-09-20', total: 99, currency: 'INR', category: 'Shopping',
  lineItems: [], source: 'manual', createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z',
  returnDeadline: { date: '2026-09-26', certainty: 'confirmed' }, warrantyExpiry: { date: '2026-10-20', certainty: 'estimated' },
};

describe('deadline reminders', () => {
  it('schedules confirmed, unresolved deadlines at 9 AM local time', () => {
    const reminders = buildReminderSchedule([record], 3, new Date(2026, 8, 22, 10));
    expect(reminders).toHaveLength(1);
    expect(reminders[0]).toMatchObject({ transactionId: 'purchase-1', kind: 'return', date: '2026-09-26' });
    expect(reminders[0]?.trigger).toEqual(new Date(2026, 8, 23, 9));
    expect(buildReminderSchedule([{ ...record, guardianStatus: { return: 'resolved' } }], 3, new Date(2026, 8, 22))).toEqual([]);
  });

  it('uses the deadline day if the lead time passed and omits past deadlines', () => {
    expect(buildReminderSchedule([record], 3, new Date(2026, 8, 24, 12))[0]?.trigger).toEqual(new Date(2026, 8, 26, 9));
    expect(buildReminderSchedule([record], 3, new Date(2026, 8, 27))).toEqual([]);
  });

  it('exports a private calendar event with the chosen alarm', () => {
    const calendar = exportReminderCalendar([record], 3, new Date(2026, 8, 22));
    expect(calendar).toContain('BEGIN:VCALENDAR\r\n');
    expect(calendar).toContain('UID:purchase-1-return@spendwise.local');
    expect(calendar).toContain('TRIGGER:-P3D');
    expect(calendar).not.toContain('Private store');
    expect(calendar).not.toContain('99');
    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
});
