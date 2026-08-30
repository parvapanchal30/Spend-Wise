import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from 'react-native';

import { colors, radii, spacing } from '@/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  icon?: IoniconName;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  label,
  icon,
  variant = 'primary',
  loading = false,
  fullWidth = true,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const foreground =
    variant === 'primary'
      ? colors.white
      : variant === 'danger'
        ? colors.danger
        : colors.accent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons color={foreground} name={icon} size={20} /> : null}
          <Text style={[styles.label, { color: foreground }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
  },
  fullWidth: { width: '100%' },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  secondary: { backgroundColor: colors.surface, borderColor: colors.border },
  danger: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.45 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: { fontSize: 16, fontWeight: '700' },
});
