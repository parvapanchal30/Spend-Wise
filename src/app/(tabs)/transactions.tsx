import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useMemo, useState } from 'react';

import { Screen } from '@/components/Screen';
import { StateNotice } from '@/components/StateNotice';
import { TransactionRow } from '@/components/TransactionRow';
import { useSpendWise } from '@/state/AppProvider';
import { colors, radii, spacing } from '@/theme';
import { searchTransactions } from '@/utils/transactions';

export default function TransactionsScreen() {
  const { transactions, isLoading, error, refresh } = useSpendWise();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchTransactions(transactions, query), [query, transactions]);

  return (
    <Screen
      description="Search merchants, products, and categories stored on this device."
      onRefresh={() => void refresh()}
      refreshing={isLoading}
      title="Transactions"
    >
      <View style={styles.searchBox}>
        <Ionicons color={colors.textMuted} name="search-outline" size={20} />
        <TextInput
          accessibilityLabel="Search transactions"
          autoCapitalize="none"
          onChangeText={setQuery}
          placeholder="Search Amazon, headphones…"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
        {query ? (
          <Pressable
            accessibilityLabel="Clear search"
            accessibilityRole="button"
            onPress={() => setQuery('')}
            style={styles.clearButton}
          >
            <Ionicons color={colors.textMuted} name="close-circle" size={21} />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <StateNotice actionLabel="Try again" message={error} onAction={() => void refresh()} title="Could not load transactions" tone="error" />
      ) : results.length > 0 ? (
        <View style={styles.listSurface}>
          {results.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              onPress={() =>
                router.push({ pathname: '/transaction/[id]', params: { id: transaction.id } })
              }
              transaction={transaction}
            />
          ))}
        </View>
      ) : query ? (
        <StateNotice
          actionLabel="Clear search"
          message={`No merchant, product, or category matches “${query}”.`}
          onAction={() => setQuery('')}
          title="No matching transactions"
        />
      ) : (
        <StateNotice
          actionLabel="Import a receipt"
          message="Save a reviewed receipt to build your searchable purchase history."
          onAction={() => router.push('/import')}
          title="No transactions yet"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBox: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: 16, minHeight: 50 },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  listSurface: { paddingHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
});
