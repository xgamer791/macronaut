import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCuratedMeal, type CuratedMeal } from '@/data/curatedMeals';
import { useRepos } from '@/state/AppProvider';
import { useAddDiaryEntry, useMealCategories } from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import { goBackOrHome } from '@/utils/navigation';
import { AppText, Button, ErrorState, Sheet } from '@/ui/components';
import { DifficultyBar } from '@/ui/components/DifficultyBar';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { fonts, radius, spacing, touchTarget } from '@/ui/theme/tokens';

type DetailTab = 'ingredients' | 'directions';

function mealShareUrl(mealId: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.href) {
    return window.location.href;
  }
  return Linking.createURL(`/meal/${mealId}`);
}

function mealShareMessage(meal: CuratedMeal, url: string): string {
  return `${meal.name} — ${meal.withLine}\n${Math.round(meal.nutrition.calories)} cal · via Macronaut\n${url}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  return false;
}

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

  const recipe = meal;
  const heroHeight = Math.min(Math.round(width * 0.62), 280);
  const totalMin = recipe.prepMinutes + recipe.cookMinutes;

  async function shareMeal() {
    const url = mealShareUrl(recipe.id);
    const message = mealShareMessage(recipe, url);
    try {
      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function'
      ) {
        await navigator.share({ title: recipe.name, text: message, url });
        return;
      }
      if (Platform.OS !== 'web') {
        await Share.share({ message, title: recipe.name, url });
        return;
      }
      const copied = await copyText(message);
      Alert.alert(
        copied ? 'Copied' : 'Share unavailable',
        copied
          ? 'Meal details were copied to your clipboard.'
          : 'Sharing is not available in this browser.',
      );
    } catch {
      // User cancelled or share unavailable — ignore.
    }
  }

  async function copyMealLink() {
    const url = mealShareUrl(recipe.id);
    try {
      const copied = await copyText(url);
      if (copied) {
        Alert.alert('Link copied', 'Meal link copied to clipboard.');
        return;
      }
      await Share.share({ message: url, title: recipe.name, url });
    } catch {
      // User cancelled — ignore.
    }
  }

  async function logMeal(mealId: string) {
    setLogging(true);
    try {
      await addEntry.mutateAsync({
        entry: {
          date,
          meal: mealId,
          name: recipe.name,
          sourceType: 'recipe',
          sourceId: recipe.id,
          quantity: 1,
          unit: 'serving',
          servingDesc: '1 serving',
          nutrition: recipe.nutrition,
        },
        foodKey: `curated:${recipe.id}`,
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
          <Image source={recipe.image} style={{ width, height: heroHeight }} contentFit="cover" />
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
          <View style={styles.headerSection}>
            <View style={styles.metaRow}>
              <AppText variant="caption" tone="muted" weight="600" style={styles.metaText}>
                {recipe.slot} · {totalMin} min · Curated by Macronaut
              </AppText>
              <View style={styles.shareRow}>
                <ShareIconButton
                  icon="share-outline"
                  label="Share meal"
                  color={colors.textSecondary}
                  background={colors.surface}
                  border={colors.border}
                  onPress={() => void shareMeal()}
                />
                <ShareIconButton
                  icon="link-outline"
                  label="Copy meal link"
                  color={colors.textSecondary}
                  background={colors.surface}
                  border={colors.border}
                  onPress={() => void copyMealLink()}
                />
              </View>
            </View>

            <AppText
              variant="title"
              weight="700"
              display
              style={[styles.mealTitle, { fontFamily: fonts.display }]}
            >
              {recipe.name}
            </AppText>
            <AppText variant="body" tone="secondary" style={styles.mealSubtitle}>
              {recipe.withLine}
            </AppText>

            <View style={styles.headerFooter}>
              <DifficultyBar difficulty={recipe.difficulty} />
            </View>
          </View>

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
                  <AppText variant="caption" tone="muted" weight="600">
                    {m.label}
                  </AppText>
                  <AppText
                    variant="heading"
                    weight="700"
                    display
                    style={styles.macroValue}
                  >
                    {m.value}
                  </AppText>
                  <AppText variant="caption" tone="muted">
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
                    variant="heading"
                    weight={active ? '700' : '500'}
                    tone={active ? 'primary' : 'muted'}
                    style={styles.tabLabel}
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
              {recipe.ingredients.map((ing, idx) => (
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
                  <AppText variant="body" style={[styles.contentText, { flex: 1 }]}>
                    {ing.name}
                  </AppText>
                  <AppText variant="body" tone="secondary" style={styles.contentText}>
                    {ing.amount}
                  </AppText>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.stepsBlock}>
              <AppText variant="body" tone="secondary" style={{ marginBottom: spacing.sm }}>
                Prep {recipe.prepMinutes} min · Cook {recipe.cookMinutes} min
              </AppText>
              {recipe.directions.map((step, idx) => (
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
                    <AppText variant="body" weight="700" tone="onAccent">
                      {idx + 1}
                    </AppText>
                  </View>
                  <AppText variant="body" style={[styles.stepText, { flex: 1 }]}>
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
        <AppText variant="body" tone="secondary" style={{ marginBottom: spacing.md }}>
          Add 1 serving of {recipe.name} to {date}.
        </AppText>
        <AppText variant="body" tone="secondary" style={{ marginBottom: spacing.sm }}>
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

function ShareIconButton({
  icon,
  label,
  color,
  background,
  border,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  background: string;
  border: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.shareBtn,
        {
          backgroundColor: background,
          borderColor: border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={color} />
    </Pressable>
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
  headerSection: {
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  metaText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  shareBtn: {
    width: touchTarget - 8,
    height: touchTarget - 8,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealTitle: {
    marginTop: 2,
    fontSize: 30,
    lineHeight: 36,
  },
  mealSubtitle: {
    fontSize: 17,
    lineHeight: 24,
  },
  headerFooter: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 22,
  },
  macroRow: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  macroCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  macroValue: {
    fontSize: 22,
    lineHeight: 28,
  },
  macroDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  tabs: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    minHeight: 46,
    justifyContent: 'flex-end',
    paddingBottom: spacing.sm,
  },
  tabLabel: {
    fontSize: 17,
    lineHeight: 22,
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
    paddingHorizontal: spacing.md + 2,
    paddingVertical: 12,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 22,
  },
  stepsBlock: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  stepBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepText: {
    fontSize: 16,
    lineHeight: 24,
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
