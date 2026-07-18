import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MealCategory } from '@/repositories/types';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';
import { AppText } from './AppText';

const MEAL_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'cafe-outline',
  lunch: 'fast-food-outline',
  dinner: 'restaurant-outline',
  snacks: 'ice-cream-outline',
  snack: 'ice-cream-outline',
};

export interface MealLogListProps {
  categories: MealCategory[];
  /** meal id → kcal total for the day */
  mealTotals: Map<string, number>;
  onLog: (mealId: string) => void;
  onOpenMeal?: (mealId: string) => void;
}

/**
 * Diary-style meal rows: icon · title · ··· · Log
 * Used on the Today screen Meals/Diary section.
 */
export function MealLogList({ categories, mealTotals, onLog, onOpenMeal }: MealLogListProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.list}>
      {categories.map((cat) => {
        const icon = MEAL_ICONS[cat.id] ?? 'restaurant-outline';
        const kcal = Math.round(mealTotals.get(cat.id) ?? 0);
        return (
          <Pressable
            key={cat.id}
            accessibilityRole="button"
            accessibilityLabel={`${cat.name}, ${kcal} kcal. Log food`}
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
              <Ionicons name={icon} size={22} color={colors.accent} />
            </View>

            <View style={styles.copy}>
              <AppText variant="body" weight="600" numberOfLines={1}>
                {cat.name}
              </AppText>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${cat.name} options`}
              hitSlop={8}
              onPress={(e) => {
                e.stopPropagation?.();
                (onOpenMeal ?? onLog)(cat.id);
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
