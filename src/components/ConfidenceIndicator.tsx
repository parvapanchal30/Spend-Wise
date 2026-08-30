import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/theme';

export function ConfidenceIndicator({ value }: { value: number }) {
  const percentage = Math.round(value * 100);
  const tone = value >= 0.9 ? colors.accent : value >= 0.75 ? colors.warning : colors.danger;
  return (
    <View
      accessibilityLabel={`${percentage}% mock extraction confidence`}
      style={styles.container}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { backgroundColor: tone, width: `${percentage}%` }]} />
      </View>
      <Text style={[styles.label, { color: tone }]}>{percentage}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  track: { width: 34, height: 4, borderRadius: radii.pill, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.pill },
  label: { fontSize: 11, fontWeight: '800' },
});
