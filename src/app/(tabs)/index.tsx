import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { DeadlineRow } from '@/components/DeadlineRow';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { StateNotice } from '@/components/StateNotice';
import { TransactionRow } from '@/components/TransactionRow';
import { UsageMeter } from '@/components/UsageMeter';
import { useSpendWise } from '@/state/AppProvider';
import { colors, radii, spacing } from '@/theme';
import { formatCurrency } from '@/utils/currency';
import { daysUntil } from '@/utils/deadlines';
import { calculateMonthlySpending } from '@/utils/transactions';

export default function HomeScreen() {
  const { transactions, deadlines, usage, isLoading, error, refresh } = useSpendWise();
  const monthlySpending = calculateMonthlySpending(transactions);
  const recentTransactions = transactions.slice(0, 3);
  const nextDeadline = deadlines.find((deadline) => daysUntil(deadline.date) >= 0);

  if (isLoading && transactions.length === 0) {
    return (
      <Screen description="Loading your local financial memory…" title="SpendWise">
        <ActivityIndicator color={colors.accent} size="large" />
      </Screen>
    );
  }

  return (
    <Screen
      description="Receipts, purchases, and important deadlines in one calm place."
      eyebrow="Your financial memory"
      onRefresh={() => void refresh()}
      refreshing={isLoading}
      title="SpendWise"
    >
      {error ? (
        <StateNotice
          actionLabel="Try again"
          message={error}
          onAction={() => void refresh()}
          title="Local data unavailable"
          tone="error"
        />
      ) : null}

      <View style={styles.summary}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryLabel}>Spent this month</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(monthlySpending)}</Text>
          </View>
          <View style={styles.privateBadge}>
            <Ionicons color={colors.accent} name="phone-portrait-outline" size={14} />
            <Text style={styles.privateBadgeText}>On device</Text>
          </View>
        </View>
        <UsageMeter usage={usage} />
      </View>

      <View style={styles.importArea}>
        <Button
          accessibilityLabel="Scan or import receipt"
          icon="scan-outline"
          label="Scan or import receipt"
          onPress={() => router.push('/import')}
        />
        <Text style={styles.importHint}>Uses a deterministic local demo extractor in this milestone.</Text>
      </View>

      <View style={styles.section}>
        <SectionHeader detail={`${transactions.length} saved`} title="Recent transactions" />
        {recentTransactions.length > 0 ? (
          <View style={styles.listSurface}>
            {recentTransactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                onPress={() =>
                  router.push({ pathname: '/transaction/[id]', params: { id: transaction.id } })
                }
                transaction={transaction}
              />
            ))}
          </View>
        ) : (
          <StateNotice
            actionLabel="Import a receipt"
            message="Your saved purchases will appear here."
            onAction={() => router.push('/import')}
            title="No transactions yet"
          />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Next Guardian deadline" />
        {nextDeadline ? (
          <View style={styles.listSurface}>
            <DeadlineRow
              deadline={nextDeadline}
              onPress={() =>
                router.push({ pathname: '/transaction/[id]', params: { id: nextDeadline.transactionId } })
              }
            />
          </View>
        ) : (
          <StateNotice
            message="Return and warranty reminders will appear after a saved purchase includes a deadline."
            title="No upcoming deadlines"
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.xl, borderWidth: 1, borderColor: colors.border },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  summaryLabel: { color: colors.textMuted, fontSize: 14, marginBottom: spacing.xs },
  summaryAmount: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  privateBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.accentSoft },
  privateBadgeText: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  importArea: { gap: spacing.sm },
  importHint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  section: { gap: spacing.md },
  listSurface: { paddingHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
});
