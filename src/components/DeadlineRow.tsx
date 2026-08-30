import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { GuardianDeadline } from '@/domain/models';
import { colors, radii, spacing } from '@/theme';
import { daysUntil } from '@/utils/deadlines';
import { formatDate } from '@/utils/dates';

const urgencyCopy = {
  overdue: 'Overdue',
  urgent: 'Due very soon',
  soon: 'Due soon',
  upcoming: 'Upcoming',
} as const;

export function DeadlineRow({
  deadline,
  onPress,
}: {
  deadline: GuardianDeadline;
  onPress(): void;
}) {
  const days = daysUntil(deadline.date);
  const isHighPriority = deadline.urgency === 'urgent' || deadline.urgency === 'overdue';
  const relative = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `In ${days}d`;

  return (
    <Pressable
      accessibilityLabel={`Open ${deadline.kind} deadline for ${deadline.productName}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={[styles.iconWrap, isHighPriority && styles.iconWrapUrgent]}>
        <Ionicons
          color={isHighPriority ? colors.danger : colors.warning}
          name={deadline.kind === 'return' ? 'return-up-back-outline' : 'shield-checkmark-outline'}
          size={20}
        />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.title}>
            {deadline.productName}
          </Text>
          <View style={[styles.badge, isHighPriority && styles.badgeUrgent]}>
            <Text style={[styles.badgeText, isHighPriority && styles.badgeTextUrgent]}>
              {relative}
            </Text>
          </View>
        </View>
        <Text style={styles.meta}>
          {deadline.kind === 'return' ? 'Return' : 'Warranty'} · {formatDate(deadline.date)}
        </Text>
        <Text style={styles.certainty}>
          {urgencyCopy[deadline.urgency]} · {deadline.certainty}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { opacity: 0.65 },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.warningSoft,
  },
  iconWrapUrgent: { backgroundColor: colors.dangerSoft },
  copy: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  certainty: { color: colors.textMuted, fontSize: 12, textTransform: 'capitalize' },
  badge: { borderRadius: radii.pill, backgroundColor: colors.warningSoft, paddingHorizontal: 8, paddingVertical: 4 },
  badgeUrgent: { backgroundColor: colors.dangerSoft },
  badgeText: { color: colors.warning, fontSize: 11, fontWeight: '800' },
  badgeTextUrgent: { color: colors.danger },
});
