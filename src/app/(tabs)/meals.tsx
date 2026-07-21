import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { CURATED_MEALS, searchCuratedMeals, type CuratedMeal } from '@/data/curatedMeals';
import { AppText, Screen } from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { fonts, radius, spacing, touchTarget } from '@/ui/theme/tokens';

/**
 * Meals tab — Macronaut-curated meal library.
 * Layout adapted from MyFitnessPal Plan meal cards (photo + slot + title + with-line + cal),
 * with search and no user-upload path.
 */
export default function MealsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');

  const meals = useMemo(() => searchCuratedMeals(query), [query]);
  const pad = spacing.lg;
  const gap = spacing.md;
  // Slightly roomier horizontal inset so two columns read like Plan cards.
  const cardWidth = Math.floor((width - pad * 2 - gap) / 2);

  return (
    <Screen tabBarSpace padded={false} style={{ gap: 0 }}>
      <View style={[styles.header, { paddingHorizontal: pad, backgroundColor: colors.background }]}>
        <View style={styles.titleRow}>
          <AppText
            variant="title"
            weight="700"
            display
            style={{ fontFamily: fonts.display, fontSize: 34, lineHeight: 40 }}
          >
            Meals
          </AppText>
        </View>
        <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
          Curated by Macronaut
        </AppText>

        <View
          style={[
            styles.search,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
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

      <View style={[styles.grid, { paddingHorizontal: pad, paddingTop: spacing.md }]}>
        {meals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            width={cardWidth}
            onPress={() => router.push({ pathname: '/meal/[id]', params: { id: meal.id } })}
          />
        ))}
      </View>

      {meals.length === 0 ? (
        <View style={{ paddingHorizontal: pad, paddingTop: spacing.xl, alignItems: 'center' }}>
          <AppText variant="body" tone="secondary" align="center">
            No meals match “{query.trim()}”.
          </AppText>
        </View>
      ) : null}

      <View style={{ height: spacing.xl }} />
      {/* Keep CURATED_MEALS referenced for tree-shaking clarity in web builds. */}
      {CURATED_MEALS.length < 0 ? null : null}
    </Screen>
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
  // Keep photo dominant but leave room for two full rows above the tab bar.
  const imageHeight = Math.round(width * 0.78);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meal.name}, ${meal.nutrition.calories} calories`}
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
      <Image
        source={meal.image}
        style={{ width: '100%', height: imageHeight }}
        contentFit="cover"
      />
      <View style={styles.cardBody}>
        <AppText variant="micro" tone="muted" weight="600" style={styles.slot}>
          {meal.slot}
        </AppText>
        <AppText variant="caption" weight="700" numberOfLines={2} style={styles.cardTitle}>
          {meal.name}
        </AppText>
        <AppText variant="micro" tone="secondary" numberOfLines={2} style={styles.withLine}>
          {meal.withLine}
        </AppText>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <AppText variant="micro" tone="secondary">
          {Math.round(meal.nutrition.calories)} cal
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
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
  slot: {
    textTransform: 'none',
    letterSpacing: 0.2,
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
});
