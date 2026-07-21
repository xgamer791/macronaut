import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  mealSlotForHour,
  mealsBySlot,
  orderedMealSlots,
  searchCuratedMeals,
  slotSectionTitle,
  type CuratedMeal,
  type MealSlot,
} from '@/data/curatedMeals';
import { AppText, Screen } from '@/ui/components';
import { DifficultyBar } from '@/ui/components/DifficultyBar';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { fonts, radius, spacing, touchTarget } from '@/ui/theme/tokens';

/**
 * Meals tab — Macronaut-curated library as horizontal carousels
 * (Breakfast / Lunch / Dinner / Snacks). Current time-of-day meal
 * period is promoted to the top; Snacks always stay last.
 */
export default function MealsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => searchCuratedMeals(query), [query]);
  const hour = new Date().getHours();
  const currentSlot = mealSlotForHour(hour);
  const slots = useMemo(() => orderedMealSlots(hour), [hour]);

  const pad = spacing.lg;
  const cardWidth = Math.min(168, Math.round(width * 0.42));

  return (
    <Screen tabBarSpace padded={false} style={{ gap: 0 }}>
      <View style={[styles.header, { paddingHorizontal: pad }]}>
        <AppText
          variant="title"
          weight="700"
          display
          style={{ fontFamily: fonts.display, fontSize: 34, lineHeight: 40 }}
        >
          Meals
        </AppText>
        <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
          Curated by Macronaut
        </AppText>

        <View
          style={[
            styles.search,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search meals, ingredients…"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Search meals"
            style={[styles.searchInput, { color: colors.textPrimary }]}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery('')}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {filtered.length === 0 ? (
        <View style={{ paddingHorizontal: pad, paddingTop: spacing.xl, alignItems: 'center' }}>
          <AppText variant="body" tone="secondary" align="center">
            No meals match “{query.trim()}”.
          </AppText>
        </View>
      ) : (
        slots.map((slot) => {
          const list = mealsBySlot(slot, filtered);
          if (list.length === 0) return null;
          const isNow = slot === currentSlot;
          return (
            <MealCarousel
              key={slot}
              slot={slot}
              meals={list}
              cardWidth={cardWidth}
              highlight={isNow}
              onPressMeal={(id) => router.push({ pathname: '/meal/[id]', params: { id } })}
            />
          );
        })
      )}

      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

function MealCarousel({
  slot,
  meals,
  cardWidth,
  highlight,
  onPressMeal,
}: {
  slot: MealSlot;
  meals: CuratedMeal[];
  cardWidth: number;
  highlight: boolean;
  onPressMeal: (id: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText variant="heading" weight="700" display>
          {slotSectionTitle(slot)}
        </AppText>
        {highlight ? (
          <View style={[styles.nowPill, { backgroundColor: colors.accent + '22' }]}>
            <AppText variant="micro" weight="700" tone="accent">
              Now
            </AppText>
          </View>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
        decelerationRate="fast"
        snapToInterval={cardWidth + spacing.md}
        snapToAlignment="start"
      >
        {meals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            width={cardWidth}
            onPress={() => onPressMeal(meal.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function MealCard({
  meal,
  width,
  onPress,
}: {
  meal: CuratedMeal;
  width: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const imageHeight = Math.round(width * 0.85);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meal.name}, ${meal.nutrition.calories} calories, ${meal.difficulty} difficulty`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          width,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <Image source={meal.image} style={{ width: '100%', height: imageHeight }} contentFit="cover" />
      <View style={styles.cardBody}>
        <AppText variant="micro" tone="muted" weight="600">
          {meal.slot}
        </AppText>
        <AppText variant="caption" weight="700" numberOfLines={2} style={styles.cardTitle}>
          {meal.name}
        </AppText>
        <AppText variant="micro" tone="secondary" numberOfLines={2} style={styles.withLine}>
          {meal.withLine}
        </AppText>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.cardFooter}>
          <AppText variant="micro" tone="secondary">
            {Math.round(meal.nutrition.calories)} cal
          </AppText>
          <DifficultyBar difficulty={meal.difficulty} compact />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.sm,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  search: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  section: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nowPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  carousel: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardBody: {
    paddingHorizontal: spacing.sm + 2,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm + 2,
    gap: 2,
  },
  cardTitle: {
    lineHeight: 17,
  },
  withLine: {
    lineHeight: 14,
    minHeight: 28,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 2,
    marginBottom: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 16,
  },
});
