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

const BLURBS: Record<ActivityType, string> = {
  cardio: 'Get your heart pumping',
  strength: 'Build muscle and power',
  sports: 'Play. Compete. Stay active.',
  mobility: 'Improve flexibility and move better',
  other: 'Move your way',
};

/** 2×2 square grid: Strength | Cardio / Sports | Mobility */
export function ActivityLogList({ burnedByType, onLog, onOpenType }: ActivityLogListProps) {
  const { colors } = useTheme();
  const byId = Object.fromEntries(ACTIVITY_CATEGORIES.map((c) => [c.id, c])) as Record<
    ActivityType,
    (typeof ACTIVITY_CATEGORIES)[number]
  >;

  const strength = byId.strength;
  const cardio = byId.cardio;
  const sports = byId.sports;
  const mobility = byId.mobility;

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <SquareTile
          name={strength.name}
          icon={strength.icon}
          blurb={BLURBS.strength}
          kcal={Math.round(burnedByType.get('strength') ?? 0)}
          accent={colors.accent}
          surface={colors.surface}
          border={colors.borderStrong}
          titleColor={colors.textPrimary}
          subtitleColor={colors.textSecondary}
          onPress={() => onLog('strength')}
          subtitleLines={2}
        />
        <SquareTile
          name={cardio.name}
          icon={cardio.icon}
          blurb={BLURBS.cardio}
          kcal={Math.round(burnedByType.get('cardio') ?? 0)}
          accent={colors.accent}
          surface={colors.surface}
          border={colors.borderStrong}
          titleColor={colors.textPrimary}
          subtitleColor={colors.textSecondary}
          onPress={() => onLog('cardio')}
          subtitleLines={2}
        />
      </View>
      <View style={styles.row}>
        <SquareTile
          name={sports.name}
          icon={sports.icon}
          blurb={BLURBS.sports}
          kcal={Math.round(burnedByType.get('sports') ?? 0)}
          accent={colors.accent}
          surface={colors.surface}
          border={colors.borderStrong}
          titleColor={colors.textPrimary}
          subtitleColor={colors.textSecondary}
          onPress={() => onLog('sports')}
          subtitleLines={2}
        />
        <SquareTile
          name={mobility.name}
          icon={mobility.icon}
          blurb={BLURBS.mobility}
          kcal={Math.round(burnedByType.get('mobility') ?? 0)}
          accent={colors.accent}
          surface={colors.surface}
          border={colors.borderStrong}
          titleColor={colors.textPrimary}
          subtitleColor={colors.textSecondary}
          onPress={() => (onOpenType ?? onLog)('mobility')}
          subtitleLines={2}
        />
      </View>
    </View>
  );
}

function SquareTile({
  name,
  icon,
  blurb,
  kcal,
  accent,
  surface,
  border,
  titleColor,
  subtitleColor,
  onPress,
  subtitleLines,
}: {
  name: string;
  icon: (typeof ACTIVITY_CATEGORIES)[number]['icon'];
  blurb: string;
  kcal: number;
  accent: string;
  surface: string;
  border: string;
  titleColor: string;
  subtitleColor: string;
  onPress: () => void;
  subtitleLines: 1 | 2;
}) {
  const subtitle = kcal > 0 ? `${kcal} kcal burned` : blurb;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${subtitle}. Log activity`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: surface, borderColor: border, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.tileBody}>
        <Ionicons name={icon} size={36} color={accent} style={styles.icon} />

        <View style={styles.copy}>
          <AppText variant="body" weight="700" numberOfLines={1} style={[styles.title, { color: titleColor }]}>
            {name}
          </AppText>
          <AppText
            variant="micro"
            numberOfLines={subtitleLines}
            style={[styles.subtitle, { color: subtitleColor }]}
          >
            {subtitle}
          </AppText>

          {/* View (not Pressable) — nested <button> is invalid on web. Whole tile logs. */}
          <View
            style={styles.logLink}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <AppText variant="caption" weight="700" style={[styles.logLabel, { color: accent }]}>
              Log
            </AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: touchTarget,
  },
  tileBody: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 10,
  },
  icon: {
    marginBottom: 0,
  },
  copy: {
    gap: 4,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
  },
  logLabel: {
    fontSize: 17,
    lineHeight: 23,
  },
  logLink: {
    alignSelf: 'flex-start',
    marginTop: 8,
    minHeight: 28,
    justifyContent: 'center',
  },
});
