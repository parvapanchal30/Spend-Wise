import type { PropsWithChildren, ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

interface ScreenProps extends PropsWithChildren {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  testID?: string;
}

export function Screen({
  title,
  eyebrow,
  description,
  action,
  refreshing = false,
  onRefresh,
  children,
  testID,
}: ScreenProps) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea} testID={testID}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            {description ? (
              <Text style={styles.description}>{description}</Text>
            ) : null}
          </View>
          {action}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 112,
    gap: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: { flex: 1, gap: spacing.xs },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', lineHeight: 36 },
  description: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
});
