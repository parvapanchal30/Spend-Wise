import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors, radii, spacing } from '@/theme';

interface StateNoticeProps {
  title: string;
  message: string;
  tone?: 'neutral' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

export function StateNotice({
  title,
  message,
  tone = 'neutral',
  actionLabel,
  onAction,
}: StateNoticeProps) {
  const isError = tone === 'error';
  return (
    <View style={[styles.container, isError && styles.errorContainer]}>
      <Ionicons
        color={isError ? colors.danger : colors.textMuted}
        name={isError ? 'alert-circle-outline' : 'file-tray-outline'}
        size={30}
      />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Button
          fullWidth={false}
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
  },
  errorContainer: { backgroundColor: colors.dangerSoft },
  title: { color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  message: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
