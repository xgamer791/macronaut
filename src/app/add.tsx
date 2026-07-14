import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { GroupedSearchResults } from '@/services/food/foodSearchService';
import { webFoodLookup } from '@/services/food/webFallback';
import { ProviderFood, SearchFilter } from '@/services/food/types';
import { useRepos } from '@/state/AppProvider';
import { useFoodSearch } from '@/state/foodSearch';
import { keys, useMealCategories } from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import { formatDayKey } from '@/utils/date';
import { goBackOrHome } from '@/utils/navigation';
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  FoodImage,
  ListRow,
  Screen,
  SegmentedControl,
  TextField,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing, touchTarget } from '@/ui/theme/tokens';

type Tab = 'search' | 'foods' | 'meals' | 'recipes';

function foodSubtitle(f: ProviderFood): string {
  return [
    f.restaurant ?? f.brand,
    f.isGeneric ? 'Generic' : null,
    f.provider === 'local'
      ? 'Built-in'
      : f.provider === 'restaurant'
        ? 'Restaurant'
        : f.provider.toUpperCase(),
  ]
    .filter(Boolean)
    .join(' · ');
}

function FoodResultRow({
  f,
  onOpen,
}: {
  f: ProviderFood;
  onOpen: (provider: string, id: string) => void;
}) {
  const cal = f.nutritionPerServing?.calories ?? f.nutritionPer100g?.calories;
  const per = f.nutritionPerServing ? (f.servingLabel ?? 'serving') : '100 g';
  return (
    <ListRow
      left={<FoodImage uri={f.imageUrl} />}
      title={f.name}
      subtitle={foodSubtitle(f)}
      value={cal !== undefined ? `${Math.round(cal)} kcal / ${per}` : undefined}
      onPress={() => onOpen(f.provider, f.id)}
    />
  );
}

function SearchResultSections({
  foods,
  groups,
  onOpen,
}: {
  foods: ProviderFood[];
  groups?: GroupedSearchResults;
  onOpen: (provider: string, id: string) => void;
}) {
  const sections: { title: string; items: ProviderFood[] }[] = [];
  if (groups) {
    if (groups.bestMatch) sections.push({ title: 'Best match', items: [groups.bestMatch] });
    if (groups.usdaWholeFoods.length) {
      sections.push({
        title: 'USDA whole foods',
        items: groups.usdaWholeFoods.filter((f) => f.id !== groups.bestMatch?.id || f.provider !== groups.bestMatch?.provider),
      });
    }
    if (groups.packagedFoods.length) {
      sections.push({ title: 'Packaged foods', items: groups.packagedFoods });
    }
    if (groups.restaurantFoods.length) {
      sections.push({ title: 'Restaurant foods', items: groups.restaurantFoods });
    }
    if (groups.myFoods.length) {
      sections.push({ title: 'My foods', items: groups.myFoods });
    }
  }
  const usable = sections.filter((s) => s.items.length > 0);
  if (usable.length === 0) {
    return (
      <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
        {foods.map((f) => (
          <FoodResultRow key={`${f.provider}:${f.id}`} f={f} onOpen={onOpen} />
        ))}
      </Card>
    );
  }
  return (
    <View style={{ gap: spacing.md }}>
      {usable.map((section) => (
        <View key={section.title} style={{ gap: spacing.xs }}>
          <AppText variant="caption" weight="600" tone="secondary">
            {section.title}
          </AppText>
          <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
            {section.items.map((f) => (
              <FoodResultRow key={`${f.provider}:${f.id}`} f={f} onOpen={onOpen} />
            ))}
          </Card>
        </View>
      ))}
    </View>
  );
}

export default function AddScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { history, food, savedMeals, recipes } = useRepos();
  const categories = useMealCategories();
  const date = useUiStore((s) => s.selectedDate);
  const meal = useUiStore((s) => s.targetMeal);

  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');

  const search = useFoodSearch(query, filter);
  const recentSearches = useQuery({
    queryKey: ['recent-searches'],
    queryFn: () => history.recentSearches(8),
  });
  const recents = useQuery({ queryKey: keys.recents, queryFn: () => history.recentFoods(8) });
  const frequents = useQuery({
    queryKey: keys.frequents(meal),
    queryFn: () => history.frequentFoods(8, meal),
  });
  const customFoods = useQuery({
    queryKey: keys.customFoods(tab === 'foods' ? query : ''),
    queryFn: () => food.listCustomFoods(tab === 'foods' && query ? query : undefined),
  });
  const mealsList = useQuery({
    queryKey: keys.savedMeals(''),
    queryFn: () => savedMeals.list(),
  });
  const recipesList = useQuery({ queryKey: keys.recipes(''), queryFn: () => recipes.list() });

  const mealName = categories.data?.find((c) => c.id === meal)?.name ?? 'Breakfast';
  const searching = query.trim().length >= 2;

  function openHistoryItem(foodKey: string) {
    const [kind, id] = foodKey.split(':');
    if (kind === 'recipe' || kind === 'meal') {
      router.push({ pathname: '/log-collection', params: { kind, id } });
    } else {
      router.push({ pathname: '/food/[provider]/[id]', params: { provider: kind, id } });
    }
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="title" weight="600" display>
          Add food
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => goBackOrHome(router)}
          style={{ minWidth: touchTarget, minHeight: touchTarget, alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>
      <AppText variant="caption" tone="secondary">
        Logging to {mealName} · {formatDayKey(date)}
      </AppText>

      <SegmentedControl<Tab>
        options={[
          { value: 'search', label: 'Search' },
          { value: 'foods', label: 'My foods' },
          { value: 'meals', label: 'Meals' },
          { value: 'recipes', label: 'Recipes' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'search' ? (
        <>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField
                value={query}
                onChangeText={setQuery}
                placeholder="Search foods (e.g. greek yogurt)"
                autoFocus
                returnKeyType="search"
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Scan barcode"
              onPress={() => router.push('/scan')}
              style={{
                width: touchTarget,
                minHeight: touchTarget,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
              }}
            >
              <Ionicons name="barcode-outline" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(['all', 'branded', 'generic'] as const).map((f) => (
              <Chip
                key={f}
                label={f === 'all' ? 'All' : f === 'branded' ? 'Branded' : 'Generic'}
                selected={filter === f}
                onPress={() => setFilter(f)}
              />
            ))}
          </View>

          {!searching ? (
            <>
              <Button title="Scan a barcode" onPress={() => router.push('/scan')} />
              {(recentSearches.data?.length ?? 0) > 0 ? (
                <View style={{ gap: spacing.sm }}>
                  <AppText variant="caption" tone="muted">
                    Recent searches
                  </AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {recentSearches.data!.map((q) => (
                      <Chip key={q} label={q} onPress={() => setQuery(q)} />
                    ))}
                  </View>
                </View>
              ) : null}
              {(frequents.data?.length ?? 0) > 0 ? (
                <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
                  <AppText variant="caption" tone="muted" style={{ paddingTop: spacing.sm }}>
                    Frequent in {mealName}
                  </AppText>
                  {frequents.data!.map((f) => (
                    <ListRow
                      key={f.foodKey}
                      left={<FoodImage uri={f.imageUrl} size={36} />}
                      title={f.name}
                      subtitle={`Logged ${f.count}×`}
                      onPress={() => openHistoryItem(f.foodKey)}
                    />
                  ))}
                </Card>
              ) : null}
              {(recents.data?.length ?? 0) > 0 ? (
                <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
                  <AppText variant="caption" tone="muted" style={{ paddingTop: spacing.sm }}>
                    Recently logged
                  </AppText>
                  {recents.data!.map((r) => (
                    <ListRow
                      key={r.foodKey}
                      left={<FoodImage uri={r.imageUrl} size={36} />}
                      title={r.name}
                      onPress={() => openHistoryItem(r.foodKey)}
                    />
                  ))}
                </Card>
              ) : null}
              <Button title="Quick add (manual entry)" variant="secondary" onPress={() => router.push('/manual-entry')} />
            </>
          ) : null}

          {searching && search.isLoading ? (
            <AppText variant="caption" tone="muted" align="center">
              Searching USDA, restaurant menus, Open Food Facts and built-in foods…
            </AppText>
          ) : null}

          {searching && search.isError ? (
            <ErrorState
              message="Food search needs an internet connection. Check your connection and try again."
              onRetry={() => search.refetch()}
            />
          ) : null}

          {searching && search.data ? (
            <>
              {search.data.allFailed ? (
                <Card>
                  <AppText variant="caption" tone="secondary">
                    You appear to be offline — showing previously seen foods from your device.
                  </AppText>
                </Card>
              ) : search.data.failures.length > 0 ? (
                <AppText variant="micro" tone="muted">
                  Some sources are unavailable — results may be partial.
                </AppText>
              ) : null}
              {search.data.foods.length === 0 ? (
                <View style={{ gap: spacing.sm }}>
                  <EmptyState
                    title="No foods found"
                    body="We checked USDA, restaurant menus, Open Food Facts and the built-in database. Look it up on the web, or create it as a custom food."
                    actionTitle="Create custom food"
                    onAction={() => router.push('/custom-food')}
                  />
                  <Button
                    title="Search the web"
                    variant="ghost"
                    onPress={() => Linking.openURL(webFoodLookup.searchUrl({ name: query }))}
                  />
                </View>
              ) : (
                <SearchResultSections
                  foods={search.data.foods}
                  groups={search.data.groups}
                  onOpen={(provider, id) =>
                    router.push({
                      pathname: '/food/[provider]/[id]',
                      params: { provider, id },
                    })
                  }
                />
              )}
            </>
          ) : null}
        </>
      ) : null}

      {tab === 'foods' ? (
        <>
          <TextField value={query} onChangeText={setQuery} placeholder="Search your foods" />
          <Button title="New custom food" onPress={() => router.push('/custom-food')} />
          {(customFoods.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No custom foods yet"
              body="Create foods you eat often so logging takes two taps."
            />
          ) : (
            <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
              {customFoods.data!.map((f) => (
                <ListRow
                  key={f.id}
                  left={<FoodImage uri={f.imageUrl} />}
                  title={f.favorite ? `★ ${f.name}` : f.name}
                  subtitle={f.brand}
                  value={`${Math.round(f.nutrition.calories)} kcal`}
                  onPress={() =>
                    router.push({ pathname: '/food/[provider]/[id]', params: { provider: 'custom', id: f.id } })
                  }
                />
              ))}
            </Card>
          )}
        </>
      ) : null}

      {tab === 'meals' ? (
        <>
          <Button title="New saved meal" onPress={() => router.push('/meal-editor')} />
          {(mealsList.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No saved meals yet"
              body="Save combinations you eat together and log them in one tap. You can also save a meal from the Diary."
            />
          ) : (
            <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
              {mealsList.data!.map((m) => (
                <ListRow
                  key={m.id}
                  left={<FoodImage uri={m.imageUrl} />}
                  title={m.favorite ? `★ ${m.name}` : m.name}
                  subtitle={`${m.items.length} item${m.items.length === 1 ? '' : 's'}`}
                  value={`${Math.round(savedMeals.totalNutrition(m).calories)} kcal`}
                  onPress={() =>
                    router.push({ pathname: '/log-collection', params: { kind: 'meal', id: m.id } })
                  }
                />
              ))}
            </Card>
          )}
        </>
      ) : null}

      {tab === 'recipes' ? (
        <>
          <Button title="New recipe" onPress={() => router.push('/recipe-editor')} />
          {(recipesList.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No recipes yet"
              body="Build a recipe from ingredients and Macronaut calculates nutrition per serving."
            />
          ) : (
            <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
              {recipesList.data!.map((r) => (
                <ListRow
                  key={r.id}
                  left={<FoodImage uri={r.imageUrl} />}
                  title={r.favorite ? `★ ${r.name}` : r.name}
                  subtitle={`${r.ingredients.length} ingredients · ${r.servings} servings`}
                  value={`${Math.round(recipes.perServing(r).calories)} kcal/serv`}
                  onPress={() =>
                    router.push({ pathname: '/log-collection', params: { kind: 'recipe', id: r.id } })
                  }
                />
              ))}
            </Card>
          )}
        </>
      ) : null}
    </Screen>
  );
}
