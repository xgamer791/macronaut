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
 * Layout: tall Cardio | Strength + Sports stacked | full-width Mobility.
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
  type,
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
      <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
      <LinearGradient
        colors={
          variant === 'wide'
            ? ['rgba(8,10,12,0.92)', 'rgba(8,10,12,0.55)', 'rgba(8,10,12,0.25)']
            : ['rgba(8,10,12,0.88)', 'rgba(8,10,12,0.45)', 'rgba(8,10,12,0.2)']
        }
        start={{ x: 0, y: 0 }}
        end={variant === 'wide' ? { x: 1, y: 0 } : { x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.tileBody, variant === 'wide' && styles.tileBodyWide]}>
        <View style={[styles.iconBadge, { backgroundColor: accent + '33' }]}>
          <Ionicons name={icon} size={variant === 'half' ? 18 : 22} color={accent} />
        </View>

        <View style={[styles.copy, variant === 'wide' && styles.copyWide]}>
          <AppText variant="body" weight="700" numberOfLines={1} style={{ color: '#FFFFFF' }}>
            {name}
          </AppText>
          <AppText
            variant="micro"
            numberOfLines={variant === 'half' ? 1 : 2}
            style={{ color: 'rgba(255,255,255,0.72)' }}
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
              <AppText variant="caption" weight="700" style={{ color: accent }}>
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

const ROW_HEIGHT = 196;

const styles = StyleSheet.create({
  mosaic: {
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    height: ROW_HEIGHT,
  },
  stack: {
    flex: 1,
    gap: spacing.sm,
  },
  tile: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#12161A',
    minHeight: touchTarget,
  },
  tileTall: {
    flex: 1,
    height: ROW_HEIGHT,
  },
  tileHalf: {
    flex: 1,
  },
  tileWide: {
    width: '100%',
    minHeight: 88,
  },
  tileBody: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  tileBodyWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    justifyContent: 'flex-start',
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    gap: 3,
  },
  copyWide: {
    flex: 1,
    minWidth: 0,
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
  },
});
