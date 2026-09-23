import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Settings {
  defaultCurrency: string;
  monthlyBudget: number;
  notificationsEnabled: boolean;
  reminderDays: number;
}

export const defaultSettings: Settings = {
  defaultCurrency: 'INR',
  monthlyBudget: 0,
  notificationsEnabled: false,
  reminderDays: 3,
};

const STORAGE_KEY = '@spendwise/settings/v1';

export function validateSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Settings must be an object.');
  }
  const settings = { ...defaultSettings, ...value } as Settings;
  if (typeof settings.defaultCurrency !== 'string' || !/^[A-Z]{3}$/.test(settings.defaultCurrency)) {
    throw new Error('Enter a three-letter currency code, such as INR or USD.');
  }
  if (typeof settings.monthlyBudget !== 'number' || !Number.isFinite(settings.monthlyBudget) || settings.monthlyBudget < 0 || settings.monthlyBudget > 1e12) {
    throw new Error('Monthly budget must be a positive amount, or 0 to turn it off.');
  }
  if (typeof settings.notificationsEnabled !== 'boolean') {
    throw new Error('Notification preference must be on or off.');
  }
  if (!Number.isInteger(settings.reminderDays) || settings.reminderDays < 0 || settings.reminderDays > 30) {
    throw new Error('Reminder lead time must be a whole number from 0 to 30 days.');
  }
  return {
    defaultCurrency: settings.defaultCurrency,
    monthlyBudget: settings.monthlyBudget,
    notificationsEnabled: settings.notificationsEnabled,
    reminderDays: settings.reminderDays,
  };
}

export async function getSettings(): Promise<Settings> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return { ...defaultSettings };
  try {
    return validateSettings(JSON.parse(stored));
  } catch {
    throw new Error('Saved preferences could not be read. Your transactions are safe.');
  }
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const validated = validateSettings(settings);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
  return validated;
}
