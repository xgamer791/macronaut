import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ACTIVITY_CATEGORIES } from '@/domain/activity';
import { ActivityType } from '@/repositories/types';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';
import { AppText } from './AppText';

export interface ActivityLogListProps {
  /** activity type → kcal burned today */
  burnedByType: Map<ActivityType, number>;
  onLog: (type: ActivityType) => void;
  onOpenType?: (type: ActivityType) => void;
}

/** Meal-style activity shortcuts on Today: icon · title · ··· · Log */
export function ActivityLogList({ burnedByType, onLog, onOpenType }: ActivityLogListProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.list}>
      {ACTIVITY_CATEGORIES.map((cat) => {
        const kcal = Math.round(burnedByType.get(cat.id) ?? 0);
        return (
          <Pressable
            key={cat.id}
            accessibilityRole="button"
            accessibilityLabel={`${cat.name}, ${kcal} kcal burned. Log activity`}
            onPress={() => onLog(cat.id)}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.accent + '18' }]}>
              <Ionicons name={cat.icon} size={22} color={colors.accent} />
            </View>

            <View style={styles.copy}>
              <AppText variant="body" weight="600" numberOfLines={1}>
                {cat.name}
              </AppText>
              <AppText variant="micro" tone="muted" numberOfLines={1}>
                {kcal > 0 ? `${kcal} kcal burned` : cat.blurb}
              </AppText>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${cat.name} details`}
              hitSlop={8}
              onPress={(e) => {
                e.stopPropagation?.();
                (onOpenType ?? onLog)(cat.id);
              }}
              style={styles.more}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Log ${cat.name}`}
              onPress={(e) => {
                e.stopPropagation?.();
                onLog(cat.id);
              }}
              style={[styles.logBtn, { backgroundColor: colors.track }]}
            >
              <AppText variant="caption" weight="600" tone="accent">
                Log
              </AppText>
            </Pressable>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: touchTarget + 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  more: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
