import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { MealDifficulty } from '@/data/curatedMeals';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { AppText } from './AppText';

const LEVEL: Record<MealDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

const LABEL: Record<MealDifficulty, string> = {
  easy: 'Easy',
  medium: 'Med',
  hard: 'Hard',
};

export interface DifficultyBarProps {
  difficulty: MealDifficulty;
  /** Compact for meal cards; default shows label for detail pages. */
  compact?: boolean;
}

/** Three-segment difficulty meter used on meal cards and detail. */
export function DifficultyBar({ difficulty, compact = false }: DifficultyBarProps) {
  const { colors } = useTheme();
  const filled = LEVEL[difficulty];
  const barH = compact ? 8 : 12;
  const barW = compact ? 4 : 6;

  return (
    <View
      style={styles.row}
      accessibilityRole="text"
      accessibilityLabel={`Difficulty ${LABEL[difficulty]}`}
    >
      <View style={styles.bars}>
        {[1, 2, 3].map((n) => (
          <View
            key={n}
            style={{
              width: barW,
              height: barH + (n - 1) * (compact ? 2 : 3),
              borderRadius: 2,
              backgroundColor: n <= filled ? colors.accent : colors.track,
              alignSelf: 'flex-end',
            }}
          />
        ))}
      </View>
      {compact ? null : (
        <AppText variant="caption" tone="muted" weight="700">
          {LABEL[difficulty]}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
});
