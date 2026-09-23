import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Screen } from '@/components/Screen';
import { StateNotice } from '@/components/StateNotice';
import { TransactionRow } from '@/components/TransactionRow';
import { useSpendWise } from '@/state/AppProvider';
import { colors, radii, spacing } from '@/theme';
import { searchTransactions } from '@/utils/transactions';
import { isValidIsoDate } from '@/utils/dates';

export default function TransactionsScreen() {
  const { transactions, isLoading, error, refresh } = useSpendWise();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [currency, setCurrency] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filters, setFilters] = useState(false);
  const [sort, setSort] = useState<'newest' | 'oldest' | 'highest'>('newest');
  const categories = ['All', ...new Set(transactions.map((item) => item.category))];
  const currencies = ['All', ...new Set(transactions.map((item) => item.currency))];
  const invalidDates = Boolean((fromDate && !isValidIsoDate(fromDate)) || (toDate && !isValidIsoDate(toDate)) || (fromDate && toDate && fromDate > toDate));
  const results = useMemo(() => {
    const matches = searchTransactions(transactions, query).filter((item) =>
      (category === 'All' || category === item.category) && (currency === 'All' || currency === item.currency) &&
      (!fromDate || !isValidIsoDate(fromDate) || item.purchaseDate >= fromDate) && (!toDate || !isValidIsoDate(toDate) || item.purchaseDate <= toDate));
    return matches.sort((a, b) => sort === 'highest' ? a.currency.localeCompare(b.currency) || b.total - a.total : sort === 'oldest' ? a.purchaseDate.localeCompare(b.purchaseDate) : b.purchaseDate.localeCompare(a.purchaseDate));
  }, [transactions, query, category, currency, fromDate, toDate, sort]);
  const filtered = query || category !== 'All' || currency !== 'All' || fromDate || toDate;
  function clear() { setQuery(''); setCategory('All'); setCurrency('All'); setFromDate(''); setToDate(''); }
  return (
    <Screen description="Search merchants, line items, notes, and receipt text." onRefresh={() => void refresh()} refreshing={isLoading} title="Transactions">
      <View style={styles.searchBox}><Ionicons color={colors.textMuted} name="search-outline" size={20} /><TextInput accessibilityLabel="Search transactions" autoCapitalize="none" onChangeText={setQuery} placeholder="Search your purchases…" placeholderTextColor={colors.textMuted} returnKeyType="search" style={styles.searchInput} value={query} />{query ? <Pressable accessibilityLabel="Clear search" accessibilityRole="button" onPress={() => setQuery('')} style={styles.clearButton}><Ionicons color={colors.textMuted} name="close-circle" size={21} /></Pressable> : null}</View>
      <View style={styles.tools}><Button label={filters ? 'Hide filters' : 'Filter & sort'} icon="options-outline" fullWidth={false} variant="secondary" onPress={() => setFilters(!filters)} /><Button label="Add purchase" icon="add" fullWidth={false} onPress={() => router.push({ pathname: '/review', params: { mode: 'manual' } })} /></View>
      {filters ? <View style={styles.filterCard}>
        <Text style={styles.label}>Category</Text><View style={styles.chips}>{categories.map((name) => <Pressable accessibilityRole="button" accessibilityState={{ selected: category === name }} key={name} onPress={() => setCategory(name)} style={[styles.chip, category === name && styles.selected]}><Text style={styles.chipText}>{name}</Text></Pressable>)}</View>
        <Text style={styles.label}>Currency</Text><View style={styles.chips}>{currencies.map((code) => <Pressable accessibilityRole="button" accessibilityState={{ selected: currency === code }} key={code} onPress={() => setCurrency(code)} style={[styles.chip, currency === code && styles.selected]}><Text style={styles.chipText}>{code}</Text></Pressable>)}</View>
        <View style={styles.dates}><View style={styles.dateField}><FormField label="From date" hint="YYYY-MM-DD" value={fromDate} onChangeText={setFromDate} /></View><View style={styles.dateField}><FormField label="To date" hint="YYYY-MM-DD" value={toDate} onChangeText={setToDate} /></View></View>
        {invalidDates ? <Text style={styles.error}>Enter valid dates with the start on or before the end.</Text> : null}
        <View style={styles.chips}>{([{ id: 'newest', label: 'Newest' }, { id: 'oldest', label: 'Oldest' }, { id: 'highest', label: 'Highest / currency' }] as const).map((option) => <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: sort === option.id }} onPress={() => setSort(option.id)} style={[styles.chip, sort === option.id && styles.selected]}><Text style={styles.chipText}>{option.label}</Text></Pressable>)}</View>
        {filtered ? <Button label="Clear filters" variant="ghost" onPress={clear} /> : null}
      </View> : null}
      <Text accessibilityLiveRegion="polite" style={styles.resultCount}>{results.length} of {transactions.length} purchases</Text>
      {error ? <StateNotice actionLabel="Try again" message={error} onAction={() => void refresh()} title="Could not refresh transactions" tone="error" /> : null}
      {results.length > 0 ? <View style={styles.listSurface}>{results.map((transaction) => <TransactionRow key={transaction.id} onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: transaction.id } })} transaction={transaction} />)}</View> : filtered ? <StateNotice actionLabel="Clear filters" message="Try another search or widen the selected dates and categories." onAction={clear} title="No matching transactions" /> : <StateNotice actionLabel="Add your first purchase" message="Import a receipt, enter a purchase, or bring in a CSV statement from Settings." onAction={() => router.push('/import')} title="No transactions yet" />}
    </Screen>
  );
}
const styles = StyleSheet.create({
  searchBox: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border }, searchInput: { flex: 1, color: colors.text, fontSize: 16, minHeight: 50 }, clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, listSurface: { paddingHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tools: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'space-between' }, filterCard: { padding: spacing.lg, gap: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }, chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border }, selected: { backgroundColor: colors.accentSoft, borderColor: colors.accent }, chipText: { color: colors.accent, fontSize: 12, fontWeight: '700' }, label: { color: colors.text, fontWeight: '700' }, dates: { flexDirection: 'row', gap: spacing.md }, dateField: { flex: 1 }, resultCount: { color: colors.textMuted, fontSize: 13 }, error: { color: colors.danger, fontSize: 13 },
});
