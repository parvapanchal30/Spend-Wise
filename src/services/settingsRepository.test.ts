import AsyncStorage from '@react-native-async-storage/async-storage';

import { defaultSettings, getSettings, saveSettings, validateSettings } from '@/services/settingsRepository';

describe('settings persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('starts with usable preferences and persists changes', async () => {
    expect(await getSettings()).toEqual(defaultSettings);
    const updated = { ...defaultSettings, defaultCurrency: 'USD', monthlyBudget: 1200.5, notificationsEnabled: true, reminderDays: 0 };
    await saveSettings(updated);
    expect(await getSettings()).toEqual(updated);
  });

  it('rejects malformed preferences without replacing saved values', async () => {
    await saveSettings(defaultSettings);
    expect(() => validateSettings({ ...defaultSettings, defaultCurrency: 'usd' })).toThrow('three-letter');
    expect(() => validateSettings({ ...defaultSettings, monthlyBudget: Number.POSITIVE_INFINITY })).toThrow('Monthly budget');
    expect(() => validateSettings({ ...defaultSettings, reminderDays: 31 })).toThrow('0 to 30');
    await expect(saveSettings({ ...defaultSettings, monthlyBudget: -1 })).rejects.toThrow('Monthly budget');
    expect(await getSettings()).toEqual(defaultSettings);
  });

  it('reports damaged settings without deleting them', async () => {
    await AsyncStorage.setItem('@spendwise/settings/v1', '{broken');
    await expect(getSettings()).rejects.toThrow('Saved preferences could not be read');
    expect(await AsyncStorage.getItem('@spendwise/settings/v1')).toBe('{broken');
  });
});
