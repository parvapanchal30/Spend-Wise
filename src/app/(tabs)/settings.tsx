import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Screen } from '@/components/Screen';
import { UsageMeter } from '@/components/UsageMeter';
import type { Transaction } from '@/domain/models';
import { entitlementService, getBillingStatus } from '@/services/entitlementService';
import { pickTextFile, shareTextFile } from '@/services/fileTransfer';
import { exportReminderCalendar, requestReminderPermission } from '@/services/notificationService';
import { useSpendWise } from '@/state/AppProvider';
import { colors, radii, spacing } from '@/theme';
import { formatCurrency } from '@/utils/currency';
import { deduplicateTransactions, exportBackup, exportTransactionsCsv, parseBackup, parseTransactionsCsv } from '@/utils/importExport';

interface ImportPreview { name: string; transactions: Transaction[]; errors: string[] }

export default function SettingsScreen() {
  const { plan, usage, settings, transactions, updateSettings, importTransactions, clearData, refresh, notificationMessage, isLoading, error } = useSpendWise();
  const [draft, setDraft] = useState<{ currency?: string; budget?: string; days?: string }>({});
  const currency = draft.currency ?? settings.defaultCurrency;
  const budget = draft.budget ?? String(settings.monthlyBudget);
  const days = draft.days ?? String(settings.reminderDays);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [paste, setPaste] = useState('');
  const [deleteText, setDeleteText] = useState('');
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const billing = getBillingStatus();
  const uniquePreview = useMemo(() => preview ? deduplicateTransactions(preview.transactions, transactions) : null, [preview, transactions]);
  const exceedsPlan = usage.remaining !== null && (uniquePreview?.transactions.length ?? 0) > usage.remaining;
  const disabled = Boolean(busy) || isLoading;

  async function run(key: string, operation: () => Promise<string | void>) {
    if (busy) return;
    setBusy(key); setMessage(null); setFailed(false);
    try {
      const result = await operation();
      if (result) setMessage(result);
    } catch (caught) {
      if (caught && typeof caught === 'object' && 'userCancelled' in caught && caught.userCancelled) {
        setMessage('Purchase cancelled. Your plan has not changed.');
      } else {
        setFailed(true);
        setMessage(caught instanceof Error ? caught.message : 'This action could not be completed. Please try again.');
      }
    } finally { setBusy(null); }
  }

  function inspect(text: string, name: string) {
    if (text.length > 10 * 1024 * 1024) throw new Error('Use a file or pasted text smaller than 10 MB.');
    const result = name.toLowerCase().endsWith('.json') || text.trimStart().startsWith('{')
      ? { transactions: parseBackup(text), errors: [] }
      : parseTransactionsCsv(text, settings.defaultCurrency);
    setPreview({ name, ...result });
  }

  return (
    <Screen title="Settings" description="Your preferences, reminders, and portable purchase records.">
      {message || error ? <View style={[styles.notice, (failed || error) && styles.errorNotice]}><Text accessibilityLiveRegion="polite" style={failed || error ? styles.errorText : styles.noticeText}>{message ?? error}</Text></View> : null}

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Spending preferences</Text>
        <View style={styles.surface}>
          <FormField label="Default currency" value={currency} onChangeText={(value) => setDraft((current) => ({ ...current, currency: value.toUpperCase() }))} maxLength={3} autoCapitalize="characters" placeholder="INR" hint="A three-letter currency code. Reports keep currencies separate; no exchange rates are applied." />
          <FormField label="Monthly budget" value={budget} onChangeText={(value) => setDraft((current) => ({ ...current, budget: value }))} keyboardType="decimal-pad" hint={`Budget for ${currency || 'your default currency'} purchases only. Set 0 for no budget.`} />
          <FormField label="Remind me this many days before" value={days} onChangeText={(value) => setDraft((current) => ({ ...current, days: value }))} keyboardType="number-pad" hint="0 to 30 days. Only confirmed, unresolved deadlines receive reminders." />
          <Button label="Save preferences" disabled={disabled} loading={busy === 'preferences'} onPress={() => void run('preferences', async () => {
            if (!budget.trim() || !days.trim()) throw new Error('Enter a budget and reminder lead time. Use 0 when appropriate.');
            await updateSettings({ defaultCurrency: currency.trim().toUpperCase(), monthlyBudget: Number(budget), reminderDays: Number(days) });
            setDraft({});
            return 'Preferences saved.';
          })} />
        </View>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Deadline reminders</Text>
        <View style={styles.surface}>
          <View style={styles.row}><Ionicons name="notifications-outline" color={colors.accent} size={24} /><Text style={styles.rowTitle}>Device reminders {settings.notificationsEnabled ? 'on' : 'off'}</Text></View>
          <Text style={styles.copy}>Reminders use private notification text without merchant names or amounts. They are scheduled on this device for 9 AM local time. If a lead date has passed, the next available reminder is on the deadline day.</Text>
          {notificationMessage ? <Text style={styles.hint}>{notificationMessage}</Text> : null}
          <Button label={settings.notificationsEnabled ? 'Turn off device reminders' : 'Enable device reminders'} variant="secondary" disabled={disabled} loading={busy === 'notifications'} onPress={() => void run('notifications', async () => {
            if (!settings.notificationsEnabled && !(await requestReminderPermission())) throw new Error(Platform.OS === 'web' ? 'Device notifications are not available on the web. Export a calendar file below.' : 'Notification permission was not granted or this build does not support notifications. Use device settings or export a calendar file.');
            await updateSettings({ notificationsEnabled: !settings.notificationsEnabled });
            return settings.notificationsEnabled ? 'Device reminders disabled.' : 'Device reminders enabled.';
          })} />
          <Button label="Export deadlines to calendar" icon="calendar-outline" variant="secondary" disabled={disabled || !transactions.length} onPress={() => void run('calendar', async () => {
            await shareTextFile('spendwise-deadlines.ics', exportReminderCalendar(transactions, settings.reminderDays), 'text/calendar');
            return 'Calendar file prepared. Open it in your calendar app to add confirmed deadlines. Exported events must be updated or removed in that app when purchases change.';
          })} />
        </View>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Import purchases</Text>
        <View style={styles.surface}>
          <Text style={styles.copy}>Import a bank CSV or a SpendWise JSON backup. CSV needs Date, Merchant or Description, and Amount or Debit columns. Currency defaults to your saved {settings.defaultCurrency} preference when absent; include a Currency column for other currencies. Use YYYY-MM-DD dates (day-first dates are also accepted). Credits and refunds are reported as skipped rows.</Text>
          <Button label="Choose CSV or JSON file" icon="document-text-outline" variant="secondary" disabled={disabled} loading={busy === 'choose'} onPress={() => void run('choose', async () => {
            const file = await pickTextFile();
            if (file) { setPreview(null); inspect(file.text, file.name); }
          })} />
          <FormField label="Or paste CSV or backup text" value={paste} onChangeText={(value) => { setPaste(value); setPreview(null); }} multiline numberOfLines={4} style={styles.textArea} maxLength={10 * 1024 * 1024} placeholder="Date,Merchant,Amount,Currency" />
          <Button label="Preview pasted data" variant="secondary" disabled={disabled || !paste.trim()} onPress={() => void run('preview', async () => { setPreview(null); inspect(paste, 'Pasted data'); })} />
          <Button label="Download CSV template" variant="ghost" disabled={disabled} onPress={() => void run('template', async () => { await shareTextFile('spendwise-template.csv', 'Date,Merchant,Amount,Currency,Category,Notes,Return deadline,Warranty expiry\r\n', 'text/csv'); return 'CSV template prepared. Fill in your purchases, then import it here.'; })} />
          {preview ? <View style={styles.preview}>
            <Text style={styles.rowTitle}>{preview.name}</Text>
            <Text style={styles.copy}>{preview.transactions.length} valid records · {uniquePreview?.transactions.length ?? 0} new · {preview.transactions.length - (uniquePreview?.transactions.length ?? 0)} duplicates skipped · {preview.errors.length} row errors</Text>
            <Text style={styles.hint}>Review before importing. Existing records remain unchanged. Matching purchase dates, merchants, amounts and currencies are treated as duplicates.</Text>
            {exceedsPlan ? <Text style={styles.errorText}>This import has more new records than the {usage.remaining} remaining on your current monthly plan. Choose a smaller file or change plans before importing.</Text> : null}
            {preview.transactions.slice(0, 5).map((item, index) => <View key={`${item.id}-${index}`} style={styles.previewRow}><Text style={styles.copy}>{item.merchant}</Text><Text style={styles.hint}>{item.purchaseDate} · {formatCurrency(item.total, item.currency)}</Text></View>)}
            {preview.transactions.length > 5 ? <Text style={styles.hint}>Showing the first 5 of {preview.transactions.length} valid records.</Text> : null}
            {preview.errors.slice(0, 30).map((issue, index) => <Text key={index} style={styles.errorText}>{issue}</Text>)}
            {preview.errors.length > 30 ? <Text style={styles.errorText}>Showing the first 30 errors. Download the error report for all {preview.errors.length} rows.</Text> : null}
            {preview.errors.length ? <Button label="Download row error report" variant="secondary" disabled={disabled} onPress={() => void run('errors', async () => shareTextFile('spendwise-import-errors.txt', preview.errors.join('\n'), 'text/plain'))} /> : null}
            <Button label={`Import ${uniquePreview?.transactions.length ?? 0} valid new records`} disabled={disabled || exceedsPlan || !uniquePreview?.transactions.length} loading={busy === 'import'} onPress={() => void run('import', async () => {
              const result = await importTransactions(preview.transactions);
              const errors = preview.errors.length;
              setPreview(null); setPaste('');
              return `${result.added} purchases imported. ${result.skipped} duplicates skipped.${errors ? ` ${errors} invalid rows were not imported.` : ''}`;
            })} />
            <Button label="Discard preview" variant="ghost" disabled={disabled} onPress={() => setPreview(null)} />
          </View> : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Export & privacy</Text>
        <View style={styles.surface}>
          <Text style={styles.copy}>Your {transactions.length} purchase records are stored on this device or browser. There is no account or cloud sync, and local storage is not encrypted by SpendWise. Browser storage can be cleared by the browser; keep backups somewhere you trust.</Text>
          <Text style={styles.copy}>Exports contain purchase details, notes, extracted text, and deadlines. Original receipt images are not included; keep those separately. JSON is the recommended format for restoring records. Preferences are stored separately and are not in transaction backups.</Text>
          <Text style={styles.hint}>Receipt images are sent only to the configured reading service when you choose automatic reading. Configured billing uses RevenueCat and your app store. SpendWise does not connect to your bank or email account.</Text>
          <Button label="Export purchases as CSV" icon="download-outline" variant="secondary" disabled={disabled} onPress={() => void run('csv', async () => { await shareTextFile('spendwise-purchases.csv', exportTransactionsCsv(transactions), 'text/csv'); return 'CSV export prepared.'; })} />
          <Button label="Export JSON backup" icon="save-outline" variant="secondary" disabled={disabled} onPress={() => void run('backup', async () => { await shareTextFile('spendwise-backup.json', exportBackup(transactions), 'application/json'); return 'JSON backup prepared. Store it securely with your original receipt images.'; })} />
        </View>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Subscription</Text>
        <View style={styles.surface}>
          <Text style={styles.planName}>{plan.name}</Text>
          <UsageMeter usage={usage} />
          <Text style={styles.copy}>{billing.message}</Text>
          {billing.available ? <>
            <Button label="View available plans" variant="secondary" disabled={disabled} loading={busy === 'plans'} onPress={() => void run('plans', async () => {
              const available = await entitlementService.getOfferings(); setPackages(available);
              return available.length ? 'Choose a plan below. Your app store will show the final price and terms before confirmation.' : 'No subscription plans are available from the store for this build.';
            })} />
            {packages.map((pack) => <View key={pack.identifier} style={styles.preview}>
              <Text style={styles.rowTitle}>{pack.product.title}</Text>
              <Text style={styles.copy}>{pack.product.description}</Text>
              <Button label={`Continue · ${pack.product.priceString}`} disabled={disabled} loading={busy === pack.identifier} onPress={() => void run(pack.identifier, async () => {
                const purchased = await entitlementService.purchase(pack); await refresh();
                return purchased.id === 'pro' ? 'Your Pro subscription is active.' : 'The store purchase completed, but Pro is not active. Restore purchases or contact the app publisher.';
              })} />
            </View>)}
            <Text style={styles.hint}>For recurring plans, your app store shows the billing period, renewal terms and cancellation options before you confirm. You can manage or cancel a subscription below.</Text>
            <Button label="Restore purchases" variant="secondary" disabled={disabled} onPress={() => void run('restore', async () => { const restored = await entitlementService.restore(); await refresh(); return restored.id === 'pro' ? 'Your Pro subscription was restored.' : 'No active Pro subscription was found for this store account.'; })} />
            <Button label="Manage store subscription" variant="ghost" disabled={disabled} onPress={() => void run('manage', () => entitlementService.manage())} />
          </> : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Delete local records</Text>
        <View style={[styles.surface, styles.dangerSurface]}>
          <Text style={styles.copy}>Permanently remove all purchase records, locally saved receipt images, and scheduled reminders from this device. Export a backup first if needed. This does not cancel a store subscription or remove calendar events you exported.</Text>
          <FormField label="Type DELETE to confirm" value={deleteText} onChangeText={setDeleteText} autoCapitalize="characters" autoCorrect={false} />
          <Button label="Delete all local records" variant="danger" disabled={disabled || deleteText !== 'DELETE'} loading={busy === 'clear'} onPress={() => void run('clear', async () => { await clearData(); setDeleteText(''); setPreview(null); setPaste(''); return 'Local purchase records and receipt images deleted.'; })} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  surface: { padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  copy: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  planName: { color: colors.text, fontSize: 26, fontWeight: '800' },
  preview: { backgroundColor: colors.surfaceMuted, padding: spacing.md, gap: spacing.md, borderRadius: radii.md },
  previewRow: { borderBottomWidth: 1, borderColor: colors.border, paddingBottom: spacing.sm, gap: spacing.xs },
  textArea: { minHeight: 110, paddingVertical: spacing.md, textAlignVertical: 'top' },
  notice: { padding: spacing.md, backgroundColor: colors.accentSoft, borderRadius: radii.md },
  noticeText: { color: colors.accent, fontSize: 14, lineHeight: 21 },
  errorNotice: { backgroundColor: colors.dangerSoft },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  dangerSurface: { borderColor: colors.dangerSoft },
});
