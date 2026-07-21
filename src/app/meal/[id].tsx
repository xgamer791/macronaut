import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCuratedMeal } from '@/data/curatedMeals';
import { useRepos } from '@/state/AppProvider';
import { useAddDiaryEntry, useMealCategories } from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import { goBackOrHome } from '@/utils/navigation';
import { AppText, Button, ErrorState, Sheet } from '@/ui/components';
import { DifficultyBar } from '@/ui/components/DifficultyBar';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { fonts, radius, spacing } from '@/ui/theme/tokens';

type DetailTab = 'ingredients' | 'directions';

/**
 * Meal detail — Plan-style recipe view with Ingredients / Directions tabs
 * and a bottom Log action into the diary.
 */
export default function MealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const meal = useMemo(() => (id ? getCuratedMeal(id) : undefined), [id]);

  const [tab, setTab] = useState<DetailTab>('ingredients');
  const [logOpen, setLogOpen] = useState(false);
  const [logging, setLogging] = useState(false);

  const addEntry = useAddDiaryEntry();
  const categories = useMealCategories();
  const date = useUiStore((s) => s.selectedDate);
  const targetMeal = useUiStore((s) => s.targetMeal);
  const setTargetMeal = useUiStore((s) => s.setTargetMeal);
  const { diary } = useRepos();

  if (!meal) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ErrorState
          title="Meal not found"
          message="This curated meal is unavailable."
          retryTitle="Back"
          onRetry={() => goBackOrHome(router)}
        />
      </View>
    );
  }

  const heroHeight = Math.min(Math.round(width * 0.62), 280);
  const totalMin = meal.prepMinutes + meal.cookMinutes;

  async function logMeal(mealId: string) {
    if (!meal) return;
    setLogging(true);
    try {
      await addEntry.mutateAsync({
        entry: {
          date,
          meal: mealId,
          name: meal.name,
          sourceType: 'recipe',
          sourceId: meal.id,
          quantity: 1,
          unit: 'serving',
          servingDesc: '1 serving',
          nutrition: meal.nutrition,
        },
        foodKey: `curated:${meal.id}`,
      });
      void diary.entriesForDate(date);
      setLogOpen(false);
      goBackOrHome(router);
    } finally {
      setLogging(false);
    }
  }

  const macros = [
    { label: 'Cal', value: `${Math.round(meal.nutrition.calories)}`, unit: 'kcal' },
    { label: 'Protein', value: `${Math.round(meal.nutrition.protein ?? 0)}`, unit: 'g' },
    { label: 'Carbs', value: `${Math.round(meal.nutrition.carbs ?? 0)}`, unit: 'g' },
    { label: 'Fat', value: `${Math.round(meal.nutrition.fat ?? 0)}`, unit: 'g' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
      >
        <View>
          <Image source={meal.image} style={{ width, height: heroHeight }} contentFit="cover" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => goBackOrHome(router)}
            style={[
              styles.backBtn,
              {
                top: insets.top + 8,
                backgroundColor: 'rgba(255,255,255,0.92)',
              },
            ]}
          >
            <Ionicons name="chevron-back" size={22} color="#14181D" />
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.metaRow}>
            <AppText variant="micro" tone="muted" weight="600" style={{ flex: 1 }}>
              {meal.slot} · {totalMin} min · Curated by Macronaut
            </AppText>
            <DifficultyBar difficulty={meal.difficulty} />
          </View>
          <AppText
            variant="title"
            weight="700"
            display
            style={{ fontFamily: fonts.display, marginTop: 4 }}
          >
            {meal.name}
          </AppText>
          <AppText variant="body" tone="secondary" style={{ marginTop: 6 }}>
            {meal.withLine}
          </AppText>

          <View
            style={[
              styles.macroRow,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {macros.map((m, idx) => (
              <React.Fragment key={m.label}>
                {idx > 0 ? (
                  <View style={[styles.macroDivider, { backgroundColor: colors.border }]} />
                ) : null}
                <View style={styles.macroCell}>
                  <AppText variant="micro" tone="muted">
                    {m.label}
                  </AppText>
                  <AppText variant="heading" weight="700" display>
                    {m.value}
                  </AppText>
                  <AppText variant="micro" tone="muted">
                    {m.unit}
                  </AppText>
                </View>
              </React.Fragment>
            ))}
          </View>

          <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
            {(
              [
                { key: 'ingredients', label: 'Ingredients' },
                { key: 'directions', label: 'Directions' },
              ] as const
            ).map((t) => {
              const active = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setTab(t.key)}
                  style={styles.tabBtn}
                >
                  <AppText
                    variant="body"
                    weight={active ? '700' : '500'}
                    tone={active ? 'primary' : 'muted'}
                  >
                    {t.label}
                  </AppText>
                  <View
                    style={[
                      styles.tabUnderline,
                      { backgroundColor: active ? colors.textPrimary : 'transparent' },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>

          {tab === 'ingredients' ? (
            <View style={styles.pillList}>
              {meal.ingredients.map((ing, idx) => (
                <View
                  key={`${ing.name}-${idx}`}
                  style={[
                    styles.pillRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <AppText variant="body" style={{ flex: 1 }}>
                    {ing.name}
                  </AppText>
                  <AppText variant="body" tone="secondary">
                    {ing.amount}
                  </AppText>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.stepsBlock}>
              <AppText variant="caption" tone="secondary" style={{ marginBottom: spacing.sm }}>
                Prep {meal.prepMinutes} min · Cook {meal.cookMinutes} min
              </AppText>
              {meal.directions.map((step, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.stepRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={[styles.stepBadge, { backgroundColor: colors.accent }]}>
                    <AppText variant="caption" weight="700" tone="onAccent">
                      {idx + 1}
                    </AppText>
                  </View>
                  <AppText variant="body" style={{ flex: 1, lineHeight: 22 }}>
                    {step}
                  </AppText>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, spacing.md),
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}
      >
        <Button
          title="Log"
          onPress={() => setLogOpen(true)}
          style={{ flex: 1, borderRadius: radius.full, minHeight: 48 }}
        />
      </View>

      <Sheet visible={logOpen} onClose={() => setLogOpen(false)} title="Log meal">
        <AppText variant="caption" tone="secondary" style={{ marginBottom: spacing.md }}>
          Add 1 serving of {meal.name} to {date}.
        </AppText>
        <AppText variant="caption" tone="secondary" style={{ marginBottom: spacing.sm }}>
          Meal
        </AppText>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
            marginBottom: spacing.lg,
          }}
        >
          {(categories.data ?? []).map((cat) => (
            <Button
              key={cat.id}
              title={cat.name}
              compact
              variant={targetMeal === cat.id ? 'primary' : 'secondary'}
              onPress={() => setTargetMeal(cat.id)}
            />
          ))}
        </View>
        <Button title="Log to diary" loading={logging} onPress={() => logMeal(targetMeal)} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backBtn: {
    position: 'absolute',
    left: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  macroRow: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  macroCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  macroDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  tabs: {
    marginTop: spacing.md,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'flex-end',
    paddingBottom: spacing.sm,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 3,
    borderRadius: 2,
  },
  pillList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  stepsBlock: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
