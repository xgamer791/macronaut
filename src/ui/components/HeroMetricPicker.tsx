import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { HERO_METRICS, type HeroMetricId, type HeroMetricKind } from '@/data/heroMetrics';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { Sheet } from './Sheet';

type ModuleSlot = 'left' | 'right';

const KIND_LABEL: Record<HeroMetricKind, string> = {
  ring: 'Goal ring',
  macro: 'Macro bar',
  steps: 'Stride meter',
  water: 'Cup grid',
  burned: 'Burn card',
};

export function HeroMetricPicker({
  slot,
  selected,
  other,
  onClose,
  onSelect,
}: {
  slot: ModuleSlot | null;
  selected: HeroMetricId;
  other: HeroMetricId;
  onClose: () => void;
  onSelect: (metric: HeroMetricId) => void;
}) {
  const { colors } = useTheme();
  const otherSlot = slot === 'left' ? 'right' : 'left';

  return (
    <Sheet
      visible={slot !== null}
      onClose={onClose}
      title={slot ? `Customize ${slot} module` : 'Customize module'}
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
                  <AppText variant="body" weight="600" numberOfLines={1} style={styles.metricTitle}>
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
    </Sheet>
  );
}

const styles = StyleSheet.create({
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
