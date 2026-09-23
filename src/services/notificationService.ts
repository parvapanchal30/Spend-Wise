import { Platform } from 'react-native';

import type { Transaction } from '@/domain/models';
import type { Settings } from '@/services/settingsRepository';
import { isValidIsoDate, toIsoDate } from '@/utils/dates';

const CHANNEL_ID = 'spendwise-deadlines';
const PREFIX = 'spendwise-deadline-';
const MAX_SCHEDULED = 60;
let queue: Promise<unknown> = Promise.resolve();

interface Reminder {
  id: string;
  transactionId: string;
  date: string;
  kind: 'return' | 'warranty';
  trigger: Date;
}

export function buildReminderSchedule(transactions: Transaction[], reminderDays: number, now = new Date()): Reminder[] {
  const result: Reminder[] = [];
  for (const transaction of transactions) {
    for (const kind of ['return', 'warranty'] as const) {
      if (transaction.guardianStatus?.[kind] === 'resolved') continue;
      const deadline = kind === 'return' ? transaction.returnDeadline : transaction.warrantyExpiry;
      if (!deadline || deadline.certainty !== 'confirmed' || !isValidIsoDate(deadline.date) || deadline.date < toIsoDate(now)) continue;
      const [year, month, day] = deadline.date.split('-').map(Number);
      const trigger = new Date(year!, month! - 1, day!, 9, 0, 0, 0);
      trigger.setDate(trigger.getDate() - reminderDays);
      // When the lead date has passed, a deadline-day reminder is still useful.
      if (trigger <= now) trigger.setDate(trigger.getDate() + reminderDays);
      if (trigger <= now) continue;
      result.push({ id: `${PREFIX}${encodeURIComponent(transaction.id)}-${kind}`, transactionId: transaction.id, date: deadline.date, kind, trigger });
    }
  }
  return result.sort((a, b) => a.trigger.getTime() - b.trigger.getTime());
}

async function nativeNotifications() {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

export async function requestReminderPermission(): Promise<boolean> {
  const notifications = await nativeNotifications();
  if (!notifications) return false;
  try {
    if (Platform.OS === 'android') {
      await notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Purchase deadlines',
        importance: notifications.AndroidImportance.DEFAULT,
        lockscreenVisibility: notifications.AndroidNotificationVisibility.PRIVATE,
      });
    }
    const status = await notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    return status.granted || status.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

async function cancelOwnedReminders(): Promise<void> {
  const notifications = await nativeNotifications();
  if (!notifications) return;
  const existing = await notifications.getAllScheduledNotificationsAsync();
  await Promise.all(existing.filter((item) => item.identifier.startsWith(PREFIX)).map((item) => notifications.cancelScheduledNotificationAsync(item.identifier)));
}

export async function cancelReminders(): Promise<void> {
  const next = queue.then(cancelOwnedReminders);
  queue = next.catch(() => undefined);
  return next;
}

async function performSync(transactions: Transaction[], settings: Settings): Promise<string | null> {
  try {
    const notifications = await nativeNotifications();
    if (!notifications) return settings.notificationsEnabled ? 'Device reminders are unavailable here. Export deadlines to your calendar instead.' : null;
    if (!settings.notificationsEnabled) {
      await cancelOwnedReminders();
      return null;
    }
    // Permission prompts happen only after an explicit user action in Settings.
    const permission = await notifications.getPermissionsAsync();
    if (!permission.granted && permission.ios?.status !== notifications.IosAuthorizationStatus.PROVISIONAL) {
      await cancelOwnedReminders();
      return 'Notifications are blocked in device settings. Enable permission or export your deadlines to a calendar.';
    }
    notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
    });
    const all = buildReminderSchedule(transactions, settings.reminderDays);
    const desired = all.slice(0, MAX_SCHEDULED);
    const existing = (await notifications.getAllScheduledNotificationsAsync()).filter((item) => item.identifier.startsWith(PREFIX));
    for (const item of existing) {
      const reminder = desired.find((candidate) => candidate.id === item.identifier);
      if (!reminder || item.content.data?.scheduledAt !== reminder.trigger.toISOString() || item.content.data?.deadlineDate !== reminder.date) {
        await notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    }
    for (const reminder of desired) {
      if (existing.some((item) => item.identifier === reminder.id && item.content.data?.scheduledAt === reminder.trigger.toISOString() && item.content.data?.deadlineDate === reminder.date)) continue;
      await notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: {
          title: 'SpendWise deadline reminder',
          body: 'A confirmed purchase deadline is coming up. Open SpendWise to review it.',
          sound: 'default',
          data: { scheduledAt: reminder.trigger.toISOString(), deadlineDate: reminder.date, transactionId: reminder.transactionId },
        },
        trigger: { type: notifications.SchedulableTriggerInputTypes.DATE, date: reminder.trigger, channelId: CHANNEL_ID },
      });
    }
    return all.length > MAX_SCHEDULED
      ? `The next ${MAX_SCHEDULED} reminders are scheduled. Open SpendWise regularly to schedule later deadlines.`
      : `${desired.length} private reminder${desired.length === 1 ? '' : 's'} scheduled for 9 AM local time. Delivery depends on device notification settings.`;
  } catch {
    return 'Device reminders could not be updated. Check notification permissions or export your deadlines to a calendar.';
  }
}

export function syncReminders(transactions: Transaction[], settings: Settings): Promise<string | null> {
  const next = queue.then(() => performSync(transactions, settings));
  queue = next.catch(() => undefined);
  return next;
}

export function exportReminderCalendar(transactions: Transaction[], reminderDays: number, now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SpendWise//Purchase deadlines//EN', 'CALSCALE:GREGORIAN'];
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  for (const transaction of transactions) {
    for (const kind of ['return', 'warranty'] as const) {
      if (transaction.guardianStatus?.[kind] === 'resolved') continue;
      const deadline = kind === 'return' ? transaction.returnDeadline : transaction.warrantyExpiry;
      if (!deadline || deadline.certainty !== 'confirmed' || !isValidIsoDate(deadline.date) || deadline.date < toIsoDate(now)) continue;
      lines.push('BEGIN:VEVENT', `UID:${encodeURIComponent(transaction.id)}-${kind}@spendwise.local`, `DTSTAMP:${stamp}`, `DTSTART:${deadline.date.replace(/-/g, '')}T090000`, `SUMMARY:SpendWise ${kind} deadline`, 'DESCRIPTION:Open SpendWise to review this confirmed purchase deadline.', 'TRANSP:TRANSPARENT', 'BEGIN:VALARM', `TRIGGER:-P${reminderDays}D`, 'ACTION:DISPLAY', 'DESCRIPTION:Review your purchase deadline in SpendWise.', 'END:VALARM', 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map((line) => line.match(/.{1,73}/g)?.join('\r\n ') ?? '').join('\r\n') + '\r\n';
}
