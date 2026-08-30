import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { StateNotice } from '@/components/StateNotice';
import { useSpendWise } from '@/state/AppProvider';
import { colors, radii, spacing } from '@/theme';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/dates';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function TransactionDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const { transactions, isLoading } = useSpendWise();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const transaction = transactions.find((candidate) => candidate.id === id);

  if (!transaction) {
    return (
      <Screen title="Transaction details">
        <StateNotice
          message={
            isLoading
              ? 'SpendWise is still loading local data.'
              : 'This transaction may have been removed when demo data was reset.'
          }
          title={isLoading ? 'Loading transaction' : 'Transaction not found'}
        />
      </Screen>
    );
  }

  return (
    <Screen
      description={formatDate(transaction.purchaseDate)}
      eyebrow={transaction.category}
      title={transaction.merchant}
    >
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Purchase total</Text>
        <Text style={styles.totalValue}>
          {formatCurrency(transaction.total, transaction.currency)}
        </Text>
        <View style={styles.sourceBadge}>
          <Ionicons color={colors.textMuted} name="phone-portrait-outline" size={13} />
          <Text style={styles.sourceText}>
            {transaction.source === 'receipt' ? 'Saved from local receipt review' : 'Demonstration data'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Purchase details</Text>
        <View style={styles.surface}>
          <DetailRow label="Product" value={transaction.lineItems[0]?.name ?? 'Purchase'} />
          <DetailRow label="Category" value={transaction.category} />
          <DetailRow label="Purchase date" value={formatDate(transaction.purchaseDate)} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Guardian dates</Text>
        <View style={styles.surface}>
          <DetailRow
            label="Return deadline"
            value={
              transaction.returnDeadline
                ? `${formatDate(transaction.returnDeadline.date)} · ${transaction.returnDeadline.certainty}`
                : 'Not recorded'
            }
          />
          <DetailRow
            label="Warranty expiry"
            value={
              transaction.warrantyExpiry
                ? `${formatDate(transaction.warrantyExpiry.date)} · ${transaction.warrantyExpiry.certainty}`
                : 'Not recorded'
            }
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Original receipt</Text>
        {transaction.receiptDocument ? (
          <View style={styles.receiptCard}>
            <Image
              accessibilityLabel="Original receipt preview"
              resizeMode="contain"
              source={{ uri: transaction.receiptDocument.uri }}
              style={styles.receiptImage}
            />
            <Text numberOfLines={1} style={styles.receiptMeta}>
              {transaction.receiptDocument.fileName || 'Imported device image'}
            </Text>
          </View>
        ) : (
          <StateNotice
            message="Demonstration transactions do not include personal receipt images."
            title="No receipt attached"
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  totalCard: { padding: spacing.xl, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  totalLabel: { color: colors.textMuted, fontSize: 13 },
  totalValue: { color: colors.text, fontSize: 34, fontWeight: '800' },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted },
  sourceText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  section: { gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  surface: { paddingHorizontal: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  detailRow: { minHeight: 64, paddingVertical: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  detailLabel: { flex: 1, color: colors.textMuted, fontSize: 13 },
  detailValue: { flex: 1.5, color: colors.text, fontSize: 14, fontWeight: '700', textAlign: 'right', textTransform: 'capitalize' },
  receiptCard: { overflow: 'hidden', borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  receiptImage: { width: '100%', height: 360, backgroundColor: colors.surfaceMuted },
  receiptMeta: { color: colors.textMuted, fontSize: 12, padding: spacing.md },
});
