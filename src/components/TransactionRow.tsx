import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Transaction } from '@/domain/models';
import { colors, radii, spacing } from '@/theme';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/dates';

interface TransactionRowProps {
  transaction: Transaction;
  onPress(): void;
}

export function TransactionRow({ transaction, onPress }: TransactionRowProps) {
  return (
    <Pressable
      accessibilityLabel={`Open ${transaction.merchant} transaction`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Ionicons color={colors.accent} name="receipt-outline" size={20} />
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.merchant}>
          {transaction.merchant}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {transaction.lineItems[0]?.name ?? transaction.category} ·{' '}
          {formatDate(transaction.purchaseDate)}
        </Text>
      </View>
      <View style={styles.amountWrap}>
        <Text style={styles.amount}>
          {formatCurrency(transaction.total, transaction.currency)}
        </Text>
        <Ionicons color={colors.textMuted} name="chevron-forward" size={16} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { opacity: 0.65 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 3 },
  merchant: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  amountWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  amount: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
