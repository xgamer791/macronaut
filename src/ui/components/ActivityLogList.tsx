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

/**
 * Mosaic / bento Activity shortcuts on Today — photo tiles, not meal-style rows.
 * Layout: tall Cardio | Strength + Sports stacked (squares) | full-width Mobility.
 * Cardio height matches the Strength + Sports stack via row stretch.
 */
export function ActivityLogList({ burnedByType, onLog, onOpenType }: ActivityLogListProps) {
  const { colors } = useTheme();
  const byId = Object.fromEntries(ACTIVITY_CATEGORIES.map((c) => [c.id, c])) as Record<
    ActivityType,
    (typeof ACTIVITY_CATEGORIES)[number]
  >;

  const cardio = byId.cardio;
  const strength = byId.strength;
  const sports = byId.sports;
  const mobility = byId.mobility;

  return (
    <View style={styles.mosaic}>
      <View style={styles.topRow}>
        <MosaicTile
          type="cardio"
          name={cardio.name}
          icon={cardio.icon}
          blurb={BLURBS.cardio}
          kcal={Math.round(burnedByType.get('cardio') ?? 0)}
          image={TILE_IMAGES.cardio}
          variant="tall"
          accent={colors.accent}
          onAccent={colors.onAccent}
          onPress={() => onLog('cardio')}
          onLog={() => onLog('cardio')}
        />
        <View style={styles.stack}>
          <MosaicTile
            type="strength"
            name={strength.name}
            icon={strength.icon}
            blurb={BLURBS.strength}
            kcal={Math.round(burnedByType.get('strength') ?? 0)}
            image={TILE_IMAGES.strength}
            variant="half"
            accent={colors.accent}
            onAccent={colors.onAccent}
            onPress={() => onLog('strength')}
            onLog={() => onLog('strength')}
          />
          <MosaicTile
            type="sports"
            name={sports.name}
            icon={sports.icon}
            blurb={BLURBS.sports}
            kcal={Math.round(burnedByType.get('sports') ?? 0)}
            image={TILE_IMAGES.sports}
            variant="half"
            accent={colors.accent}
            onAccent={colors.onAccent}
            onPress={() => onLog('sports')}
            onLog={() => onLog('sports')}
          />
        </View>
      </View>

      <MosaicTile
        type="mobility"
        name={mobility.name}
        icon={mobility.icon}
        blurb={BLURBS.mobility}
        kcal={Math.round(burnedByType.get('mobility') ?? 0)}
        image={TILE_IMAGES.mobility}
        variant="wide"
        accent={colors.accent}
        onAccent={colors.onAccent}
        onPress={() => (onOpenType ?? onLog)('mobility')}
        onLog={() => onLog('mobility')}
        showChevron
      />
    </View>
  );
}

function MosaicTile({
  name,
  icon,
  blurb,
  kcal,
  image,
  variant,
  accent,
  onAccent,
  onPress,
  onLog,
  showChevron,
}: {
  type: ActivityType;
  name: string;
  icon: (typeof ACTIVITY_CATEGORIES)[number]['icon'];
  blurb: string;
  kcal: number;
  image: ImageSource;
  variant: 'tall' | 'half' | 'wide';
  accent: string;
  onAccent: string;
  onPress: () => void;
  onLog: () => void;
  showChevron?: boolean;
}) {
  const subtitle = kcal > 0 ? `${kcal} kcal burned` : blurb;
  // 30% larger than the previous 28 / 34 sizes.
  const iconSize = variant === 'half' ? 36 : 44;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${subtitle}. Log activity`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        variant === 'tall' && styles.tileTall,
        variant === 'half' && styles.tileHalf,
        variant === 'wide' && styles.tileWide,
        { opacity: pressed ? 0.92 : 1 },
      ]}
    >
      {/* Photo sits back; grey wash + gradient keep text readable like the mockup. */}
      <Image
        source={image}
        style={[StyleSheet.absoluteFill, styles.photo]}
        contentFit="cover"
        accessible={false}
      />
      <View style={[StyleSheet.absoluteFill, styles.greyWash]} />
      <LinearGradient
        colors={
          variant === 'wide'
            ? ['rgba(18,22,26,0.82)', 'rgba(18,22,26,0.45)', 'rgba(18,22,26,0.2)']
            : ['rgba(18,22,26,0.55)', 'rgba(18,22,26,0.35)', 'rgba(18,22,26,0.72)']
        }
        start={{ x: 0, y: 0 }}
        end={variant === 'wide' ? { x: 1, y: 0 } : { x: 0.15, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.tileBody, variant === 'wide' && styles.tileBodyWide]}>
        <Ionicons name={icon} size={iconSize} color={accent} style={styles.icon} />

        <View style={[styles.copy, variant === 'wide' && styles.copyWide]}>
          <AppText variant="body" weight="700" numberOfLines={1} style={styles.title}>
            {name}
          </AppText>
          <AppText
            variant="micro"
            numberOfLines={variant === 'half' ? 1 : 2}
            style={styles.subtitle}
          >
            {subtitle}
          </AppText>

          {!showChevron ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Log ${name}`}
              hitSlop={8}
              onPress={(e) => {
                e.stopPropagation?.();
                onLog();
              }}
              style={styles.logLink}
            >
              <AppText variant="caption" weight="700" style={[styles.logLabel, { color: accent }]}>
                Log
              </AppText>
            </Pressable>
          ) : null}
        </View>

        {showChevron ? (
          <View style={[styles.chevron, { backgroundColor: accent }]}>
            <Ionicons name="chevron-forward" size={16} color={onAccent} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mosaic: {
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    // Stretch Cardio to the height of the Strength + Sports stack.
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  stack: {
    flex: 1,
    gap: spacing.sm,
  },
  tile: {
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
  tileTall: {
    flex: 1,
  },
  tileHalf: {
    width: '100%',
    aspectRatio: 1,
  },
  tileWide: {
    width: '100%',
    minHeight: 96,
  },
  tileBody: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  tileBodyWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  icon: {
    marginBottom: 0,
  },
  copy: {
    gap: 5,
  },
  copyWide: {
    flex: 1,
    minWidth: 0,
  },
  // ~30% larger than body 15/21, micro 11/15, caption 13/18.
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 27,
  },
  subtitle: {
    color: 'rgba(230,234,238,0.88)',
    fontSize: 14,
    lineHeight: 20,
  },
  logLabel: {
    fontSize: 17,
    lineHeight: 23,
  },
  logLink: {
    alignSelf: 'flex-start',
    marginTop: 6,
    minHeight: 28,
    justifyContent: 'center',
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
});
