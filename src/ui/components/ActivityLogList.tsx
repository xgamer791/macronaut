import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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

const TILE_IMAGES: Record<ActivityType, ImageSource> = {
  cardio: require('../../../assets/images/activity/activity-cardio.jpg'),
  strength: require('../../../assets/images/activity/activity-strength.jpg'),
  sports: require('../../../assets/images/activity/activity-sports.jpg'),
  mobility: require('../../../assets/images/activity/activity-mobility.jpg'),
  other: require('../../../assets/images/activity/activity-cardio.jpg'),
};

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
          image={TILE_IMAGES.strength}
          accent={colors.accent}
          onPress={() => onLog('strength')}
          onLog={() => onLog('strength')}
          subtitleLines={2}
        />
        <SquareTile
          name={cardio.name}
          icon={cardio.icon}
          blurb={BLURBS.cardio}
          kcal={Math.round(burnedByType.get('cardio') ?? 0)}
          image={TILE_IMAGES.cardio}
          accent={colors.accent}
          onPress={() => onLog('cardio')}
          onLog={() => onLog('cardio')}
          subtitleLines={2}
        />
      </View>
      <View style={styles.row}>
        <SquareTile
          name={sports.name}
          icon={sports.icon}
          blurb={BLURBS.sports}
          kcal={Math.round(burnedByType.get('sports') ?? 0)}
          image={TILE_IMAGES.sports}
          accent={colors.accent}
          onPress={() => onLog('sports')}
          onLog={() => onLog('sports')}
          subtitleLines={2}
        />
        <SquareTile
          name={mobility.name}
          icon={mobility.icon}
          blurb={BLURBS.mobility}
          kcal={Math.round(burnedByType.get('mobility') ?? 0)}
          image={TILE_IMAGES.mobility}
          accent={colors.accent}
          onPress={() => (onOpenType ?? onLog)('mobility')}
          onLog={() => onLog('mobility')}
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
  image,
  accent,
  onPress,
  onLog,
  subtitleLines,
}: {
  name: string;
  icon: (typeof ACTIVITY_CATEGORIES)[number]['icon'];
  blurb: string;
  kcal: number;
  image: ImageSource;
  accent: string;
  onPress: () => void;
  onLog: () => void;
  subtitleLines: 1 | 2;
}) {
  const subtitle = kcal > 0 ? `${kcal} kcal burned` : blurb;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${subtitle}. Log activity`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.92 : 1 }]}
    >
      <Image
        source={image}
        style={[StyleSheet.absoluteFill, styles.photo]}
        contentFit="cover"
        accessible={false}
      />
      <View style={[StyleSheet.absoluteFill, styles.greyWash]} />
      <LinearGradient
        colors={['rgba(18,22,26,0.55)', 'rgba(18,22,26,0.35)', 'rgba(18,22,26,0.72)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.15, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.tileBody}>
        <Ionicons name={icon} size={36} color={accent} style={styles.icon} />

        <View style={styles.copy}>
          <AppText variant="body" weight="700" numberOfLines={1} style={styles.title}>
            {name}
          </AppText>
          <AppText variant="micro" numberOfLines={subtitleLines} style={styles.subtitle}>
            {subtitle}
          </AppText>

          {/* View (not Pressable) — nested <button> is invalid on web. Whole tile logs. */}
          <View style={styles.logLink} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
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
    overflow: 'hidden',
    backgroundColor: '#1A1F24',
    minHeight: touchTarget,
  },
  photo: {
    opacity: 0.55,
  },
  greyWash: {
    backgroundColor: 'rgba(160, 168, 176, 0.22)',
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
  // ~6% under the prior 19/26 header size.
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 24,
  },
  subtitle: {
    color: 'rgba(230,234,238,0.88)',
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
