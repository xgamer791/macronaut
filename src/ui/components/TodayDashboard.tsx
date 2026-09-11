import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, ChevronLeft, ChevronRight, User } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { fonts, lightColors, palette } from '@/ui/theme/tokens';
import { AppText } from './AppText';

/** Diary canvas uses the app accent; cards keep the reference neutrals. */
export const TODAY = {
  canvas: palette.accent,
  fade: lightColors.background,
  onCanvas: palette.onAccent,
  onCanvasMuted: 'rgba(255, 255, 255, 0.72)',
  ring: palette.onAccent,
  ringTrack: 'rgba(255, 255, 255, 0.32)',
  logo: palette.onAccent,
  card: '#FFFFFF',
  cardInk: '#111111',
  cardMuted: '#8D8D8D',
  carbsBar: '#DCDCF5',
  proteinBar: '#F0DCE6',
  fatBar: '#E8E4F5',
} as const;

export interface TodayMacro {
  label: string;
  consumed: number;
  target: number;
  bar: string;
}

export interface TodayDashboardProps {
  dateLabel: string;
  consumed: number;
  burned: number;
  remaining: number;
  goal: number;
  macros: TodayMacro[];
  notificationDot?: boolean;
  /** When set, skip the device safe-area (preview frames paint their own chrome). */
  topInset?: number;
  /** Fill the first viewport so meals stay below the fold. */
  minHeight?: number;
  onLogoPress?: () => void;
  onProfilePress?: () => void;
  onNotifyPress?: () => void;
  onPrevDate?: () => void;
  onNextDate?: () => void;
  onDatePress?: () => void;
  onRingPress?: () => void;
  onMacroPress?: (label: string) => void;
}

function formatAmount(n: number): string {
  return String(Math.round(Math.max(0, n)));
}

/**
 * Diary dashboard cloned from the reference, painted in the app accent
 * instead of the source lime gradient.
 */
export function TodayDashboard({
  dateLabel,
  consumed,
  burned,
  remaining,
  goal,
  macros,
  notificationDot,
  topInset,
  minHeight,
  onLogoPress,
  onProfilePress,
  onNotifyPress,
  onPrevDate,
  onNextDate,
  onDatePress,
  onRingPress,
  onMacroPress,
}: TodayDashboardProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const padTop = topInset !== undefined ? topInset : insets.top;
  const ringSize = Math.min(248, Math.max(200, width * 0.62));
  const fill = goal > 0 ? Math.min(Math.max(remaining / goal, 0), 1) : 0;

  return (
    <View style={[styles.root, minHeight != null && { minHeight }]}>
      <LinearGradient
        colors={[TODAY.canvas, TODAY.canvas, TODAY.fade]}
        locations={[0, 0.78, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: padTop + 6 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          onPress={onLogoPress}
          hitSlop={8}
          style={styles.logoHit}
        >
          <SproutLogo size={28} color={TODAY.logo} />
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open your profile"
            onPress={onProfilePress}
            hitSlop={8}
            style={styles.iconHit}
          >
            <User size={22} color={TODAY.onCanvas} strokeWidth={1.7} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={notificationDot ? 'Unread notifications' : 'Notifications'}
            onPress={onNotifyPress}
            hitSlop={8}
            style={styles.iconHit}
          >
            <Bell size={22} color={TODAY.onCanvas} strokeWidth={1.7} />
            {notificationDot ? <View style={styles.notifyDot} /> : null}
          </Pressable>
        </View>
      </View>

      <View style={styles.dateRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          onPress={onPrevDate}
          hitSlop={10}
          style={styles.chevronHit}
        >
          <ChevronLeft size={22} color={TODAY.onCanvas} strokeWidth={1.8} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dateLabel}
          onPress={onDatePress}
          style={styles.dateCenter}
        >
          <Ionicons name="calendar-outline" size={15} color={TODAY.onCanvas} />
          <AppText style={styles.dateLabel}>{dateLabel}</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next day"
          onPress={onNextDate}
          hitSlop={10}
          style={styles.chevronHit}
        >
          <ChevronRight size={22} color={TODAY.onCanvas} strokeWidth={1.8} />
        </Pressable>
      </View>

      <View style={styles.ringBlock}>
        <View style={styles.sideStat}>
          <AppText style={styles.sideLabel}>Consumed</AppText>
          <AppText style={styles.sideValue}>{formatAmount(consumed)}</AppText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remaining ${formatAmount(remaining)} of ${formatAmount(goal)} kcal`}
          onPress={onRingPress}
          style={{ width: ringSize, height: ringSize }}
        >
          <RemainingRing size={ringSize} progress={fill} />
          <View style={styles.ringCopy} pointerEvents="none">
            <AppText style={styles.remainingLabel}>Remaining</AppText>
            <AppText style={styles.remainingValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatAmount(remaining)}
            </AppText>
            <AppText style={styles.goalLabel}>
              Goal {formatAmount(goal)} kcal
            </AppText>
          </View>
        </Pressable>

        <View style={[styles.sideStat, styles.sideStatEnd]}>
          <AppText style={styles.sideLabel}>Burned</AppText>
          <AppText style={styles.sideValue}>{formatAmount(burned)}</AppText>
        </View>
      </View>

      <View style={styles.macroRow}>
        {macros.map((macro) => {
          const pct = macro.target > 0 ? Math.min(macro.consumed / macro.target, 1) : 0;
          return (
            <Pressable
              key={macro.label}
              accessibilityRole="button"
              accessibilityLabel={`${macro.label} ${formatAmount(macro.consumed)} of ${formatAmount(macro.target)} grams`}
              onPress={() => onMacroPress?.(macro.label)}
              style={styles.macroCard}
            >
              <AppText style={styles.macroName}>{macro.label}</AppText>
              <AppText style={styles.macroValue}>
                {formatAmount(macro.consumed)}/{formatAmount(macro.target)}g
              </AppText>
              <View style={[styles.macroTrack, { backgroundColor: macro.bar }]}>
                <View
                  style={[
                    styles.macroFill,
                    { width: `${Math.max(pct * 100, pct > 0 ? 4 : 0)}%`, backgroundColor: macro.bar },
                  ]}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Two-leaf sprout mark from the reference header. */
export function SproutLogo({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityLabel="Macronaut">
      <Path
        fill={color}
        d="M5.2 20.6c-.3-7.4 5.2-14.6 13.4-13.6-4.2 4-8.2 9.2-9.6 15.2-1.8.1-3.5-.6-3.8-1.6z"
      />
      <Path
        fill={color}
        d="M17.8 5.4c6.2-3.2 13.2 1.2 11.2 8.6-5.6-1.4-9.4-4.2-11.2-8.6z"
      />
    </Svg>
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number) {
  const clamped = Math.max(0.001, Math.min(sweepDeg, 359.999));
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, startDeg + clamped);
  const large = clamped > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

/** 270° horseshoe, gap at the bottom, rounded caps. */
export function RemainingRing({ size, progress }: { size: number; progress: number }) {
  const stroke = Math.max(9, Math.round(size * 0.042));
  const r = (size - stroke) / 2 - 1;
  const cx = size / 2;
  const cy = size / 2;
  const start = 135;
  const sweep = 270;
  const filled = sweep * Math.min(Math.max(progress, 0), 1);

  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Path
        d={arcPath(cx, cy, r, start, sweep)}
        stroke={TODAY.ringTrack}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
      />
      {filled > 0.5 ? (
        <Path
          d={arcPath(cx, cy, r, start, filled)}
          stroke={TODAY.ring}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
        />
      ) : null}
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  logoHit: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconHit: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyDot: {
    position: 'absolute',
    top: 10,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#D64545',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    minHeight: 40,
  },
  chevronHit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.7,
    color: TODAY.onCanvas,
  },
  ringBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    minHeight: 260,
  },
  sideStat: {
    width: 78,
    gap: 4,
  },
  sideStatEnd: {
    alignItems: 'flex-end',
  },
  sideLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 18,
    color: TODAY.onCanvas,
  },
  sideValue: {
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.6,
    color: TODAY.onCanvas,
  },
  ringCopy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
  },
  remainingLabel: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 20,
    color: TODAY.onCanvas,
    marginBottom: 2,
  },
  remainingValue: {
    fontFamily: fonts.bold,
    fontSize: 52,
    lineHeight: 56,
    letterSpacing: -1.6,
    color: TODAY.onCanvas,
  },
  goalLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: TODAY.onCanvasMuted,
    marginTop: 4,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  macroCard: {
    flex: 1,
    backgroundColor: TODAY.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  macroName: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 20,
    color: TODAY.cardInk,
  },
  macroValue: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 17,
    color: TODAY.cardMuted,
  },
  macroTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  macroFill: {
    height: '100%',
    borderRadius: 2,
  },
});
