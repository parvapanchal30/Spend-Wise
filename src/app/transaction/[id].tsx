import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { StateNotice } from '@/components/StateNotice';
import type { DeadlineKind } from '@/domain/models';
import { useSpendWise } from '@/state/AppProvider';
import { colors, radii, spacing } from '@/theme';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/dates';

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

export default function TransactionDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const { transactions, isLoading, saveTransaction, deleteTransaction } = useSpendWise();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const transaction = transactions.find((candidate) => candidate.id === id);
  if (!transaction) return <Screen title="Transaction details"><StateNotice message={isLoading ? 'Loading your saved purchase.' : 'This purchase has been removed or is no longer available.'} title={isLoading ? 'Loading transaction' : 'Transaction not found'} actionLabel="View transactions" onAction={() => router.replace('/transactions')} /></Screen>;

  async function act(operation: () => Promise<void>) {
    setBusy(true); setMessage(null);
    try { await operation(); } catch (error) { setMessage(error instanceof Error ? error.message : 'The purchase could not be updated.'); } finally { setBusy(false); }
  }
  const record = transaction;
  function changeStatus(kind: DeadlineKind) {
    return act(() => saveTransaction({ ...record, updatedAt: new Date().toISOString(), guardianStatus: { ...record.guardianStatus, [kind]: record.guardianStatus?.[kind] === 'resolved' ? 'active' : 'resolved' } }));
  }
  const source = { receipt: 'Receipt capture', manual: 'Manual entry', csv: 'Statement import', demo: 'Migrated purchase' }[transaction.source];
  return (
    <Screen description={formatDate(transaction.purchaseDate)} eyebrow={transaction.category} title={transaction.merchant}>
      {message ? <StateNotice title="Could not update purchase" message={message} tone="error" /> : null}
      <View style={styles.totalCard}><Text style={styles.totalLabel}>Purchase total</Text><Text style={styles.totalValue}>{formatCurrency(transaction.total, transaction.currency)}</Text><View style={styles.sourceBadge}><Ionicons color={colors.textMuted} name="phone-portrait-outline" size={13} /><Text style={styles.sourceText}>{source} · Saved on this device</Text></View></View>
      <Button icon="create-outline" label="Edit purchase" onPress={() => router.push({ pathname: '/edit/[id]', params: { id: transaction.id } })} />
      <View style={styles.section}><Text style={styles.sectionTitle}>Purchase details</Text><View style={styles.surface}><DetailRow label="Category" value={transaction.category} /><DetailRow label="Purchase date" value={formatDate(transaction.purchaseDate)} />{transaction.lineItems.map((item) => <DetailRow key={item.id} label={`${item.name} × ${item.quantity}`} value={formatCurrency(item.total, transaction.currency)} />)}</View>{transaction.notes ? <View style={styles.note}><Text style={styles.sectionTitle}>Notes</Text><Text selectable style={styles.noteText}>{transaction.notes}</Text></View> : null}{transaction.tags?.length ? <Text style={styles.noteText}>{transaction.tags.map((tag) => `#${tag}`).join('  ')}</Text> : null}</View>
      <View style={styles.section}><Text style={styles.sectionTitle}>Guardian dates</Text>
        {(['return', 'warranty'] as const).map((kind) => {
          const deadline = kind === 'return' ? transaction.returnDeadline : transaction.warrantyExpiry;
          const resolved = transaction.guardianStatus?.[kind] === 'resolved';
          return <View key={kind} style={styles.note}><DetailRow label={kind === 'return' ? 'Return deadline' : 'Warranty expiry'} value={deadline ? `${formatDate(deadline.date)} · ${resolved ? 'Resolved' : deadline.certainty}` : 'Not recorded'} />{deadline ? <>
            {deadline.certainty === 'estimated' ? <Button label="Confirm this date" variant="secondary" disabled={busy} onPress={() => void act(() => saveTransaction({ ...record, updatedAt: new Date().toISOString(), [kind === 'return' ? 'returnDeadline' : 'warrantyExpiry']: { ...deadline, certainty: 'confirmed' } }))} /> : null}
            <Button label={resolved ? 'Reopen reminder' : 'Mark as resolved'} variant="secondary" disabled={busy} onPress={() => void changeStatus(kind)} />
          </> : null}</View>;
        })}
      </View>
      <View style={styles.note}><Text style={styles.sectionTitle}>Recurring expense</Text><Text style={styles.noteText}>Flag regular purchases so you can find subscriptions and repeat expenses in Insights.</Text><Button label={transaction.recurring ? 'Remove recurring flag' : 'Mark as recurring'} variant="secondary" disabled={busy} onPress={() => void act(() => saveTransaction({ ...record, recurring: !record.recurring, updatedAt: new Date().toISOString() }))} /></View>
      <View style={styles.section}><Text style={styles.sectionTitle}>Original receipt</Text>{transaction.receiptDocument && transaction.receiptDocument.mimeType !== 'text/plain' ? <View style={styles.receiptCard}><Image accessibilityLabel="Original receipt preview" resizeMode="contain" source={{ uri: transaction.receiptDocument.uri }} style={styles.receiptImage} /><Text numberOfLines={1} style={styles.receiptMeta}>{transaction.receiptDocument.fileName || 'Imported receipt'}</Text></View> : <StateNotice message="You can keep purchase records without attaching an image." title="No receipt image attached" />}{transaction.rawText ? <><Button label={showText ? 'Hide receipt text' : 'Show extracted receipt text'} variant="secondary" onPress={() => setShowText(!showText)} />{showText ? <View style={styles.note}><Text selectable style={styles.noteText}>{transaction.rawText}</Text></View> : null}</> : null}</View>
      {confirmDelete ? <View style={styles.note}><Text style={styles.sectionTitle}>Delete this purchase?</Text><Text style={styles.noteText}>Its attached receipt and Guardian reminders will also be removed. This cannot be undone.</Text><Button label="Delete purchase permanently" variant="danger" loading={busy} onPress={() => void act(async () => { await deleteTransaction(record.id); router.replace('/transactions'); })} /><Button label="Keep purchase" variant="ghost" disabled={busy} onPress={() => setConfirmDelete(false)} /></View> : <Button label="Delete purchase" icon="trash-outline" variant="danger" disabled={busy} onPress={() => setConfirmDelete(true)} />}
    </Screen>
  );
}
const styles = StyleSheet.create({
  totalCard: { padding: spacing.xl, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.sm }, totalLabel: { color: colors.textMuted, fontSize: 13 }, totalValue: { color: colors.text, fontSize: 34, fontWeight: '800' }, sourceBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted }, sourceText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  section: { gap: spacing.md }, sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' }, surface: { paddingHorizontal: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, detailRow: { minHeight: 60, paddingVertical: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, detailLabel: { flex: 1, color: colors.textMuted, fontSize: 13 }, detailValue: { flex: 1.5, color: colors.text, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  receiptCard: { overflow: 'hidden', borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, receiptImage: { width: '100%', height: 360, backgroundColor: colors.surfaceMuted }, receiptMeta: { color: colors.textMuted, fontSize: 12, padding: spacing.md }, note: { padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.md }, noteText: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
});
