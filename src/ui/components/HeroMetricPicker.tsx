import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HERO_METRICS, type HeroMetricId, type HeroMetricKind } from '@/data/heroMetrics';
import { usePushWhileOpen } from '@/ui/motion/SlidePush';
import { SLIDE_DURATION_MS, SLIDE_EASING } from '@/ui/motion/SlideScreen';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';
import { AppText } from './AppText';

type ModuleSlot = 'left' | 'right';
const DRAWER_EDGE_GAP = 45;

const KIND_LABEL: Record<HeroMetricKind, string> = {
  ring: 'Goal ring',
  macro: 'Macro bar',
  steps: 'Stride meter',
  water: 'Cup grid',
  burned: 'Burn card',
  fasting: 'Live timer',
};

export function HeroMetricPicker({
  slot,
  left,
  right,
  onClose,
  onSelect,
}: {
  slot: ModuleSlot | null;
  left: HeroMetricId;
  right: HeroMetricId;
  onClose: () => void;
  onSelect: (metric: HeroMetricId) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const visible = slot !== null;
  const panelWidth = Math.max((width || 390) - DRAWER_EDGE_GAP, 0);
  const [activeSlot, setActiveSlot] = useState<ModuleSlot>(slot ?? 'left');
  const [mounted, setMounted] = useState(visible);
  const [previousSlot, setPreviousSlot] = useState(slot);
  const [webOpen, setWebOpen] = useState(false);
  const progress = useSharedValue(0);

  if (slot !== previousSlot) {
    setPreviousSlot(slot);
    setWebOpen(false);
    if (slot) {
      setActiveSlot(slot);
      setMounted(true);
    }
  }

  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || !mounted || !visible) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setWebOpen(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [mounted, visible]);

  useEffect(() => {
    if (visible) {
      progress.value = withTiming(1, {
        duration: SLIDE_DURATION_MS,
        easing: SLIDE_EASING,
      });
      return;
    }
    if (!mounted) return;
    progress.value = withTiming(0, {
      duration: SLIDE_DURATION_MS,
      easing: SLIDE_EASING,
    });
    const id = setTimeout(() => setMounted(false), SLIDE_DURATION_MS);
    return () => clearTimeout(id);
  }, [mounted, progress, visible]);

  const side = slot ?? activeSlot;
  const direction = side === 'left' ? -1 : 1;
  const open = Platform.OS === 'web' ? webOpen : visible;
  const selected = side === 'left' ? left : right;
  const other = side === 'left' ? right : left;
  const otherSlot = side === 'left' ? 'right' : 'left';

  usePushWhileOpen(open, { x: side === 'left' ? panelWidth : -panelWidth });

  const overlayStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.value) * direction * panelWidth }],
  }));

  if (!mounted) return null;

  const webRoot =
    Platform.OS === 'web' ? { dataSet: { modulepicker: open ? 'open' : 'shut' } } : null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root} pointerEvents="box-none" {...webRoot}>
        <Animated.View
          {...(Platform.OS === 'web' ? { dataSet: { modulescrim: '' } } : null)}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.overlay },
            Platform.OS === 'web' ? null : overlayStyle,
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close module picker"
          />
        </Animated.View>

        <Animated.View
          {...(Platform.OS === 'web' ? { dataSet: { moduledrawer: side } } : null)}
          style={[
            styles.drawer,
            side === 'left' ? styles.drawerLeft : styles.drawerRight,
            {
              width: panelWidth,
              paddingTop: insets.top + spacing.sm,
              paddingBottom: insets.bottom + spacing.lg,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
            Platform.OS === 'web'
              ? { transform: [{ translateX: open ? 0 : direction * panelWidth }] }
              : drawerStyle,
          ]}
        >
          <View style={styles.heading}>
            <View style={styles.headingCopy}>
              <AppText variant="micro" weight="700" style={{ color: colors.accent }}>
                {side.toUpperCase()} MODULE
              </AppText>
              <AppText variant="heading" weight="600">
                Customize {side} module
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close module picker"
              onPress={onClose}
              hitSlop={8}
              style={styles.close}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <View
              style={[
                styles.intro,
                { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
              ]}
            >
              <View style={[styles.introIcon, { backgroundColor: `${colors.accent}1A` }]}>
                <Ionicons name="options-outline" size={22} color={colors.accent} />
              </View>
              <View style={styles.introCopy}>
                <AppText variant="body" weight="600">
                  Choose what you want to track
                </AppText>
                <AppText variant="micro" tone="secondary">
                  Tap a metric to update this module instantly.
                </AppText>
              </View>
            </View>

            <View style={styles.grid} accessibilityRole="radiogroup">
              {HERO_METRICS.map((metric) => {
                const isSelected = metric.id === selected;
                const usedElsewhere = metric.id === other;
                const detail = metric.subtitle.replace(/^.*? — /, '');

                return (
                  <Pressable
                    key={metric.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`${metric.label}, ${detail}${usedElsewhere ? `, shown on ${otherSlot} module` : ''}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      onSelect(metric.id);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: isSelected ? `${colors.accent}14` : colors.surfaceRaised,
                        borderColor: isSelected ? colors.accent : colors.border,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.optionTop}>
                      <View
                        style={[
                          styles.metricIcon,
                          { backgroundColor: isSelected ? `${colors.accent}20` : colors.track },
                        ]}
                      >
                        <Ionicons
                          name={metric.icon}
                          size={23}
                          color={isSelected ? colors.accent : colors.textSecondary}
                        />
                      </View>
                      <View
                        style={[
                          styles.selection,
                          {
                            borderColor: isSelected ? colors.accent : colors.borderStrong,
                            backgroundColor: isSelected ? colors.accent : 'transparent',
                          },
                        ]}
                      >
                        {isSelected ? (
                          <Ionicons name="checkmark" size={14} color={colors.onAccent} />
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.metricCopy}>
                      <View style={styles.metricTitleRow}>
                        <AppText
                          variant="body"
                          weight="600"
                          numberOfLines={1}
                          style={styles.metricTitle}
                        >
                          {metric.label}
                        </AppText>
                        {usedElsewhere && !isSelected ? (
                          <View style={[styles.otherBadge, { backgroundColor: colors.track }]}>
                            <AppText variant="micro" tone="secondary" weight="600">
                              {otherSlot.toUpperCase()}
                            </AppText>
                          </View>
                        ) : null}
                      </View>
                      <AppText
                        variant="micro"
                        weight="600"
                        style={{ color: isSelected ? colors.accent : colors.textMuted }}
                      >
                        {KIND_LABEL[metric.kind]}
                      </AppText>
                      <AppText variant="micro" tone="secondary" numberOfLines={2}>
                        {detail}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const drawerShadow = Platform.select({
  web: { boxShadow: '0 0 34px rgba(0,0,0,0.24)' } as object,
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 18,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  drawer: {
    flex: 1,
    maxWidth: '100%',
    paddingHorizontal: spacing.lg,
    ...drawerShadow,
  },
  drawerLeft: {
    alignSelf: 'flex-start',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  drawerRight: {
    alignSelf: 'flex-end',
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  heading: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headingCopy: {
    gap: 1,
  },
  close: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
  },
  introIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introCopy: {
    flex: 1,
    gap: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  option: {
    width: '48%',
    flexGrow: 1,
    minHeight: 120,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.985 }],
  },
  optionTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selection: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCopy: {
    gap: 1,
  },
  metricTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metricTitle: {
    flexShrink: 1,
  },
  otherBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
