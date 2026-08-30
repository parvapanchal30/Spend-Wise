import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { UsageMeter } from '@/components/UsageMeter';
import { useSpendWise } from '@/state/AppProvider';
import { colors, radii, spacing } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function PlaceholderRow({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View accessibilityState={{ disabled: true }} style={styles.placeholderRow}>
      <View style={styles.placeholderIcon}>
        <Ionicons color={colors.textMuted} name={icon} size={20} />
      </View>
      <View style={styles.placeholderCopy}>
        <Text style={styles.placeholderLabel}>{label}</Text>
        <Text style={styles.placeholderStatus}>Not available in this local prototype</Text>
      </View>
      <Ionicons color={colors.border} name="lock-closed-outline" size={18} />
    </View>
  );
}

export default function SettingsScreen() {
  const { plan, usage, resetDemoData, isLoading } = useSpendWise();
  const [message, setMessage] = useState<string | null>(null);

  function confirmReset() {
    Alert.alert(
      'Reset demo data?',
      'This removes locally saved prototype transactions and restores the original examples.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void resetDemoData()
              .then(() => setMessage('Demo data restored.'))
              .catch(() => setMessage('Demo data could not be restored.'));
          },
        },
      ],
    );
  }

  return (
    <Screen
      description="Prototype controls and transparent service status."
      title="Settings"
    >
      <View style={styles.planCard}>
        <View style={styles.planHeader}>
          <View>
            <Text style={styles.cardLabel}>Current plan</Text>
            <Text style={styles.planName}>{plan.name}</Text>
          </View>
          <View style={styles.mockBadge}>
            <Text style={styles.mockBadgeText}>MOCK PLAN</Text>
          </View>
        </View>
        <UsageMeter usage={usage} />
        <Text style={styles.planNote}>
          RevenueCat is not connected. Limits are enforced by a replaceable local entitlement service.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Prototype data</Text>
        <View style={styles.surface}>
          <Text style={styles.resetCopy}>
            Restore the Indian sample transactions and remove receipts you saved during testing.
          </Text>
          <Button
            accessibilityLabel="Reset local demo data"
            label="Reset demo data"
            loading={isLoading}
            onPress={confirmReset}
            variant="danger"
          />
          {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Planned controls</Text>
        <View style={styles.surfaceFlush}>
          <PlaceholderRow icon="shield-outline" label="Privacy controls" />
          <PlaceholderRow icon="download-outline" label="Export my data" />
          <PlaceholderRow icon="card-outline" label="Manage subscription" />
        </View>
      </View>

      <View style={styles.localNotice}>
        <Ionicons color={colors.accent} name="checkmark-circle-outline" size={20} />
        <Text style={styles.localNoticeText}>
          No Supabase, AI, billing, email, bank, or remote notification service is active.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  planCard: { padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.xl },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  cardLabel: { color: colors.textMuted, fontSize: 13 },
  planName: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: spacing.xs },
  mockBadge: { paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: colors.warningSoft },
  mockBadgeText: { color: colors.warning, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  planNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  section: { gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  surface: { padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.lg },
  surfaceFlush: { paddingHorizontal: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  resetCopy: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  message: { color: colors.accent, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  placeholderRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, opacity: 0.72 },
  placeholderIcon: { width: 38, height: 38, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  placeholderCopy: { flex: 1, gap: 3 },
  placeholderLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  placeholderStatus: { color: colors.textMuted, fontSize: 12 },
  localNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.accentSoft },
  localNoticeText: { flex: 1, color: colors.accent, fontSize: 13, lineHeight: 19, fontWeight: '600' },
});
