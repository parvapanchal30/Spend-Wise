import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { DeadlineRow } from '@/components/DeadlineRow';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { StateNotice } from '@/components/StateNotice';
import { useSpendWise } from '@/state/AppProvider';
import { colors, radii, spacing } from '@/theme';

export default function GuardianScreen() {
  const { deadlines, isLoading, refresh } = useSpendWise();
  const returns = deadlines.filter((deadline) => deadline.kind === 'return');
  const warranties = deadlines.filter((deadline) => deadline.kind === 'warranty');

  function openTransaction(transactionId: string) {
    router.push({ pathname: '/transaction/[id]', params: { id: transactionId } });
  }

  return (
    <Screen
      description="Stay ahead of return windows and warranty expirations. Confirm estimated dates before relying on them."
      eyebrow="Return & Warranty Guardian"
      onRefresh={() => void refresh()}
      refreshing={isLoading}
      title="Guardian"
    >
      {deadlines.length === 0 ? (
        <StateNotice
          actionLabel="Import a receipt"
          message="Deadlines appear after you save return or warranty dates on a transaction."
          onAction={() => router.push('/import')}
          title="Nothing to watch yet"
        />
      ) : (
        <>
          <View style={styles.legend}>
            <Text style={styles.legendTitle}>Date confidence</Text>
            <Text style={styles.legendCopy}>
              Confirmed dates were reviewed by you. Estimated dates came from the local demo and need verification.
            </Text>
          </View>

          <View style={styles.section}>
            <SectionHeader detail={`${returns.length}`} title="Return deadlines" />
            {returns.length > 0 ? (
              <View style={styles.listSurface}>
                {returns.map((deadline) => (
                  <DeadlineRow key={deadline.id} deadline={deadline} onPress={() => openTransaction(deadline.transactionId)} />
                ))}
              </View>
            ) : (
              <StateNotice message="No saved purchases currently include a return deadline." title="No return deadlines" />
            )}
          </View>

          <View style={styles.section}>
            <SectionHeader detail={`${warranties.length}`} title="Warranty expirations" />
            {warranties.length > 0 ? (
              <View style={styles.listSurface}>
                {warranties.map((deadline) => (
                  <DeadlineRow key={deadline.id} deadline={deadline} onPress={() => openTransaction(deadline.transactionId)} />
                ))}
              </View>
            ) : (
              <StateNotice message="No saved purchases currently include warranty information." title="No warranties" />
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  legend: { padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.infoSoft, gap: spacing.xs },
  legendTitle: { color: colors.info, fontSize: 14, fontWeight: '800' },
  legendCopy: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  section: { gap: spacing.md },
  listSurface: { paddingHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
});
