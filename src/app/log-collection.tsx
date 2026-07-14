import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { View } from 'react-native';
import { roundForDisplay, scaleNutrition } from '@/domain/nutrition';
import { useRepos } from '@/state/AppProvider';
import { useAddDiaryEntry, useInvalidateDiary, useMealCategories } from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import { formatDayKey } from '@/utils/date';
import { goBackOrHome } from '@/utils/navigation';
import {
  AppText,
  Button,
  Card,
  ErrorState,
  FoodImage,
  ListRow,
  NumberField,
  Screen,
  Sheet,
} from '@/ui/components';
import { spacing } from '@/ui/theme/tokens';

/** Log a saved meal or a recipe into the diary in one action. */
export default function LogCollectionScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: 'meal' | 'recipe'; id: string }>();
  const router = useRouter();
  const { savedMeals, recipes, diary, history } = useRepos();
  const categories = useMealCategories();
  const addEntry = useAddDiaryEntry();
  const invalidate = useInvalidateDiary();
  const date = useUiStore((s) => s.selectedDate);
  const meal = useUiStore((s) => s.targetMeal);
  const setTargetMeal = useUiStore((s) => s.setTargetMeal);

  const [servings, setServings] = useState<number | undefined>(1);
  const [mealPickerOpen, setMealPickerOpen] = useState(false);
  const [logging, setLogging] = useState(false);

  const isRecipe = kind === 'recipe';
  interface Normalized {
    name: string;
    imageUrl?: string;
    servings: number;
    items: { name: string; quantity: number; unit: string; nutrition: { calories: number } }[];
    perServing: ReturnType<typeof scaleNutrition>;
  }
  const query = useQuery({
    queryKey: ['collection', kind, id],
    queryFn: async (): Promise<Normalized | null> => {
      if (isRecipe) {
        const r = await recipes.get(id);
        if (!r) return null;
        return {
          name: r.name,
          imageUrl: r.imageUrl,
          servings: r.servings,
          items: r.ingredients,
          perServing: recipes.perServing(r),
        };
      }
      const m = await savedMeals.get(id);
      if (!m) return null;
      return {
        name: m.name,
        imageUrl: m.imageUrl,
        servings: m.servings,
        items: m.items,
        perServing: savedMeals.perServing(m),
      };
    },
  });

  const entity = query.data;
  if (query.isLoading) {
    return (
      <Screen>
        <AppText variant="caption" tone="muted" align="center">
          Loading…
        </AppText>
      </Screen>
    );
  }
  if (!entity) {
    return (
      <Screen>
        <ErrorState title="Not found" message="This item no longer exists." retryTitle="Back" onRetry={() => goBackOrHome(router)} />
      </Screen>
    );
  }

  const perServing = entity.perServing;
  const items = entity.items;
  const mealName = categories.data?.find((c) => c.id === meal)?.name ?? 'Breakfast';
  const scaled = servings !== undefined ? scaleNutrition(perServing, servings) : null;

  async function log() {
    if (!entity || servings === undefined || servings <= 0) return;
    setLogging(true);
    try {
      if (isRecipe) {
        await addEntry.mutateAsync({
          entry: {
            date,
            meal,
            name: entity.name,
            sourceType: 'recipe',
            sourceId: id,
            quantity: servings,
            unit: 'serving',
            servingDesc: `${servings} serving${servings === 1 ? '' : 's'} of recipe`,
            nutrition: scaleNutrition(perServing, servings),
          },
          foodKey: `recipe:${id}`,
        });
      } else {
        // Saved meal: one action logs every item (scaled by servings).
        for (const item of items) {
          await diary.add({
            date,
            meal,
            name: item.name,
            sourceType: 'saved_meal',
            sourceId: id,
            quantity: item.quantity * servings,
            unit: item.unit,
            nutrition: scaleNutrition(item.nutrition, servings),
          });
        }
        await history.recordLog(`meal:${id}`, entity.name, meal);
        invalidate();
      }
      goBackOrHome(router);
    } finally {
      setLogging(false);
    }
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        <FoodImage uri={entity.imageUrl} size={64} />
        <View style={{ flex: 1 }}>
          <AppText variant="heading" weight="600" display>
            {entity.name}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {isRecipe ? 'Recipe' : 'Saved meal'} · {items.length} item{items.length === 1 ? '' : 's'}
          </AppText>
        </View>
      </View>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="caption" tone="muted">
          Per serving: {Math.round(perServing.calories)} kcal · P{' '}
          {roundForDisplay(perServing.protein ?? 0)} · C {roundForDisplay(perServing.carbs ?? 0)} · F{' '}
          {roundForDisplay(perServing.fat ?? 0)}
        </AppText>
        {items.map((it, i) => (
          <ListRow
            key={i}
            title={it.name}
            subtitle={`${it.quantity} ${it.unit}`}
            value={`${Math.round(it.nutrition.calories)} kcal`}
          />
        ))}
      </Card>

      <Card style={{ gap: spacing.md }}>
        <NumberField label="Servings to log" value={servings} onChange={setServings} min={0.25} />
        <Button title={`Meal: ${mealName}`} variant="secondary" onPress={() => setMealPickerOpen(true)} />
        <AppText variant="caption" tone="muted">
          {formatDayKey(date)}
        </AppText>
        {scaled ? (
          <AppText variant="body" weight="600">
            Will log {Math.round(scaled.calories)} kcal
          </AppText>
        ) : null}
      </Card>

      <Button title={`Log to ${mealName}`} onPress={log} loading={logging} disabled={!scaled} />
      <Button
        title={`Edit ${isRecipe ? 'recipe' : 'meal'}`}
        variant="secondary"
        onPress={() =>
          router.push({
            pathname: isRecipe ? '/recipe-editor' : '/meal-editor',
            params: { id },
          })
        }
      />
      <Button title="Cancel" variant="ghost" onPress={() => goBackOrHome(router)} />

      <Sheet visible={mealPickerOpen} onClose={() => setMealPickerOpen(false)} title="Meal">
        {(categories.data ?? []).map((cat) => (
          <Button
            key={cat.id}
            title={cat.name}
            variant={meal === cat.id ? 'primary' : 'secondary'}
            onPress={() => {
              setTargetMeal(cat.id);
              setMealPickerOpen(false);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}
