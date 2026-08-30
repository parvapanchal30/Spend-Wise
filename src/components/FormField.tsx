import type { ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { ConfidenceIndicator } from '@/components/ConfidenceIndicator';
import { colors, radii, spacing } from '@/theme';

interface FormFieldProps extends ComponentProps<typeof TextInput> {
  label: string;
  error?: string;
  confidence?: number;
  hint?: string;
}

export function FormField({
  label,
  error,
  confidence,
  hint,
  style,
  ...props
}: FormFieldProps) {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {confidence !== undefined ? <ConfidenceIndicator value={confidence} /> : null}
      </View>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error && styles.inputError, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  input: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 12, lineHeight: 17 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
});
