import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { StateNotice } from '@/components/StateNotice';
import { useSpendWise } from '@/state/AppProvider';
import { colors, radii, spacing } from '@/theme';
import { findRecurringExpenses, getMonthlyTrend, shiftMonth, summarizeMonth } from '@/utils/analytics';
import { formatCurrency } from '@/utils/currency';
import { monthKey } from '@/utils/dates';

export default function InsightsScreen() {
  const { transactions, settings } = useSpendWise();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const currency = selectedCurrency ?? settings.defaultCurrency;
  const currencies = [...new Set([settings.defaultCurrency, ...transactions.map((item) => item.currency)])];
  const summary = useMemo(() => summarizeMonth(transactions, month, currency), [transactions, month, currency]);
  const trend = getMonthlyTrend(transactions, month, currency);
  const recurring = findRecurringExpenses(transactions, currency);
  const highest = Math.max(...trend.map((item) => item.total), 1);
  const budget = currency === settings.defaultCurrency ? settings.monthlyBudget : 0;
  const budgetRatio = budget > 0 ? summary.total / budget : 0;
  return (
    <Screen title="Insights" eyebrow="Make your spending visible" description="Explore your own purchase history. Each currency is calculated separately.">
      <View style={styles.period}>
        <Button accessibilityLabel="Previous month" icon="chevron-back" label="" fullWidth={false} variant="secondary" onPress={() => setMonth(shiftMonth(month, -1))} />
        <Text style={styles.month}>{new Date(`${month}-15T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
        <Button accessibilityLabel="Next month" icon="chevron-forward" label="" fullWidth={false} variant="secondary" disabled={month >= monthKey(new Date())} onPress={() => setMonth(shiftMonth(month, 1))} />
      </View>
      <View style={styles.chips}>{currencies.map((code) => <Pressable key={code} accessibilityRole="button" accessibilityState={{ selected: code === currency }} onPress={() => setSelectedCurrency(code)} style={[styles.chip, code === currency && styles.selected]}><Text style={styles.chipText}>{code}</Text></Pressable>)}</View>
      <View style={styles.card}>
        <Text style={styles.muted}>Recorded spending · {summary.items.length} purchases</Text>
        <Text style={styles.amount}>{formatCurrency(summary.total, currency)}</Text>
        <Text style={styles.muted}>{summary.change === null ? 'Add previous-month purchases to compare spending.' : `${Math.abs(summary.change).toFixed(1)}% ${summary.change >= 0 ? 'more' : 'less'} than the previous month`}</Text>
      </View>
      <View style={styles.card}>
        <SectionHeader title="Monthly budget" detail={budget > 0 ? formatCurrency(budget, currency) : 'Not set'} />
        {budget > 0 ? <>
          <View accessibilityRole="progressbar" accessibilityValue={{ now: Math.round(budgetRatio * 100), min: 0, max: 100 }} style={styles.track}><View style={[styles.fill, { width: `${Math.min(budgetRatio * 100, 100)}%`, backgroundColor: budgetRatio >= 1 ? colors.danger : colors.accent }]} /></View>
          <Text style={styles.muted}>{formatCurrency(Math.abs(budget - summary.total), currency)} {budget >= summary.total ? 'remaining' : 'over budget'} · {Math.round(budgetRatio * 100)}% used</Text>
        </> : <><Text style={styles.muted}>Set a monthly budget for your default currency to see how much is left.</Text><Button label="Set budget" variant="secondary" onPress={() => router.push('/settings')} /></>}
      </View>
      <View style={styles.card}>
        <SectionHeader title="Six-month trend" />
        <View style={styles.chart}>{trend.map((item) => <View key={item.month} style={styles.column}><Text numberOfLines={1} style={styles.barValue}>{formatCurrency(item.total, currency)}</Text><View style={styles.barTrack}><View style={[styles.bar, { height: `${Math.max(item.total / highest * 100, item.total ? 3 : 0)}%` }]} /></View><Text style={styles.barLabel}>{new Date(`${item.month}-15T12:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</Text></View>)}</View>
      </View>
      <View style={styles.card}><SectionHeader title="Spending by category" />{summary.categories.length ? summary.categories.map((item) => <View key={item.name} style={styles.category}><View style={styles.row}><Text style={styles.label}>{item.name}</Text><Text style={styles.label}>{formatCurrency(item.total, currency)}</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${item.total / summary.total * 100}%` }]} /></View></View>) : <Text style={styles.muted}>No purchases in this month and currency.</Text>}</View>
      {summary.merchants.length ? <View style={styles.card}><SectionHeader title="Top merchants" />{summary.merchants.slice(0, 5).map((item) => <View key={item.name} style={styles.row}><Text style={styles.label}>{item.name}</Text><Text style={styles.label}>{formatCurrency(item.total, currency)}</Text></View>)}</View> : null}
      <View style={styles.card}><SectionHeader title="Recurring spending" />{recurring.length ? recurring.map((item) => <View key={item.merchant} style={styles.category}><View style={styles.row}><Text style={styles.label}>{item.merchant}</Text><Text style={styles.label}>{formatCurrency(item.total, currency)}</Text></View><Text style={styles.muted}>{item.confirmed ? 'Marked recurring by you' : 'Possible recurring expense · similar amounts in at least 3 months'} · latest {item.latestDate}</Text></View>) : <StateNotice title="Track regular expenses" message="Mark a purchase as recurring in its details. Similar purchases across three months will also appear here as suggestions." />}</View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  card: { padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  period: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }, month: { color: colors.text, fontSize: 18, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, chip: { paddingVertical: 10, paddingHorizontal: 18, borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, backgroundColor: colors.surface }, selected: { borderColor: colors.accent, backgroundColor: colors.accentSoft }, chipText: { color: colors.accent, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 20 }, amount: { color: colors.text, fontSize: 32, fontWeight: '800' }, label: { color: colors.text, fontWeight: '700', fontSize: 14, flexShrink: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }, category: { gap: spacing.sm },
  track: { height: 8, backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: colors.accent, borderRadius: radii.pill },
  chart: { flexDirection: 'row', gap: spacing.sm }, column: { flex: 1, gap: 6, alignItems: 'center' }, barTrack: { height: 110, width: '70%', backgroundColor: colors.surfaceMuted, borderRadius: 5, justifyContent: 'flex-end', overflow: 'hidden' }, bar: { backgroundColor: colors.accent, borderRadius: 5 }, barValue: { fontSize: 10, color: colors.textMuted }, barLabel: { fontSize: 11, color: colors.textMuted },
});
