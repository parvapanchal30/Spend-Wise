import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

export function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  detail: { color: colors.textMuted, fontSize: 13 },
});
