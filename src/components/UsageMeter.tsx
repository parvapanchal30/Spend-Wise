import { StyleSheet, Text, View } from 'react-native';

import type { MonthlyUsage } from '@/domain/models';
import { colors, radii, spacing } from '@/theme';

export function UsageMeter({ usage }: { usage: MonthlyUsage }) {
  const ratio = usage.limit ? Math.min(usage.transactionsUsed / usage.limit, 1) : 0;
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Added this month</Text>
        <Text style={styles.value}>
          {usage.limit === null ? `${usage.transactionsUsed} purchases · Unlimited` : `${usage.transactionsUsed} of ${usage.limit} purchases`}
        </Text>
      </View>
      {usage.limit !== null ? <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: usage.limit, now: usage.transactionsUsed }} style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  value: { color: colors.textMuted, fontSize: 13 },
  track: { height: 7, borderRadius: radii.pill, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.accent },
});
