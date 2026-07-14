import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
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
  Screen,
  Sheet,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget, type } from '@/ui/theme/tokens';

type Tab = 'history' | 'meals' | 'recipes' | 'foods';

const TABS: { value: Tab; label: string }[] = [
  { value: 'history', label: 'History' },
  { value: 'meals', label: 'My Meals' },
  { value: 'recipes', label: 'My Recipes' },
  { value: 'foods', label: 'My Foods' },
];

function foodSubtitle(f: ProviderFood): string {
  const cal = f.nutritionPerServing?.calories ?? f.nutritionPer100g?.calories;
  const per = f.nutritionPerServing ? (f.servingLabel ?? 'serving') : '100 g';
  const calBit = cal !== undefined ? `${Math.round(cal)} kcal, ${per}` : null;
  return [calBit, f.restaurant ?? f.brand].filter(Boolean).join(' · ');
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

/** MFP-style food row: image · copy · circular + */
function FoodPickRow({
  title,
  subtitle,
  imageUrl,
  onPress,
}: {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.foodCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <FoodImage uri={imageUrl} size={44} />
      <View style={styles.foodCopy}>
        <AppText variant="body" weight="600" numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.addCircle, { backgroundColor: colors.accent + '22' }]}>
        <Ionicons name="add" size={22} color={colors.accent} />
      </View>
    </Pressable>
  );
}

function QuickTile({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickTile,
        {
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={24} color={colors.accent} />
      <AppText variant="micro" weight="600" tone="accent" align="center" numberOfLines={2}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Keep incomplete rows the same tile width as a full 3-up quick row. */
function QuickTileRow({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  const pads = Math.max(0, 3 - items.length);
  return (
    <View style={styles.quickRow}>
      {items}
      {Array.from({ length: pads }, (_, i) => (
        <View key={`pad-${i}`} style={styles.quickTilePad} />
      ))}
    </View>
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
        items: groups.usdaWholeFoods.filter(
          (f) => f.id !== groups.bestMatch?.id || f.provider !== groups.bestMatch?.provider,
        ),
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
  const flat = usable.length === 0 ? foods : null;

  if (flat) {
    return (
      <View style={styles.stack}>
        {flat.map((f) => (
          <FoodPickRow
            key={`${f.provider}:${f.id}`}
            title={f.name}
            subtitle={foodSubtitle(f)}
            imageUrl={f.imageUrl}
            onPress={() => onOpen(f.provider, f.id)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {usable.map((section) => (
        <View key={section.title} style={styles.stack}>
          <AppText variant="heading" weight="600" display>
            {section.title}
          </AppText>
          {section.items.map((f) => (
            <FoodPickRow
              key={`${f.provider}:${f.id}`}
              title={f.name}
              subtitle={foodSubtitle(f)}
              imageUrl={f.imageUrl}
              onPress={() => onOpen(f.provider, f.id)}
            />
          ))}
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
  const setTargetMeal = useUiStore((s) => s.setTargetMeal);

  const [tab, setTab] = useState<Tab>('history');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [mealPickerOpen, setMealPickerOpen] = useState(false);

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
      {/* Header: circular back + meal selector (MFP-style, teal polish) */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => goBackOrHome(router)}
          style={[
            styles.backCircle,
            { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
          ]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Logging to ${mealName}. Change meal`}
          onPress={() => setMealPickerOpen(true)}
          style={styles.mealPicker}
        >
          <AppText variant="body" weight="600" tone="accent" numberOfLines={1}>
            {mealName}
          </AppText>
          <Ionicons name="chevron-down" size={16} color={colors.accent} />
        </Pressable>

        <View style={styles.headerSpacer} />
      </View>

      {/* Pill search + barcode */}
      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchPill,
            { backgroundColor: colors.surface, borderColor: colors.borderStrong, flex: 1 },
          ]}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            accessibilityLabel="Search foods"
            value={query}
            onChangeText={setQuery}
            placeholder="Search foods, brands, flavors…"
            placeholderTextColor={colors.textMuted}
            autoFocus={false}
            returnKeyType="search"
            style={[type.body, styles.searchInput, { color: colors.textPrimary }]}
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan barcode"
          onPress={() => router.push('/scan')}
          style={[
            styles.barcodeBtn,
            { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong },
          ]}
        >
          <Ionicons name="barcode-outline" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

      {/* Underline tabs */}
      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {TABS.map((t) => {
          const selected = tab === t.value;
          return (
            <Pressable
              key={t.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setTab(t.value)}
              style={styles.tabHit}
            >
              <AppText
                variant="caption"
                weight={selected ? '600' : '400'}
                tone={selected ? 'primary' : 'muted'}
              >
                {t.label}
              </AppText>
              <View
                style={[
                  styles.tabUnderline,
                  { backgroundColor: selected ? colors.accent : 'transparent' },
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      {tab === 'history' ? (
        <>
          {!searching ? (
            <>
              <QuickTileRow>
                <QuickTile
                  icon="sparkles-outline"
                  label="AI food scan"
                  onPress={() => router.push('/ai-scan')}
                />
                <QuickTile
                  icon="flash-outline"
                  label="Quick add"
                  onPress={() => router.push('/manual-entry')}
                />
                <QuickTile
                  icon="nutrition-outline"
                  label="Custom food"
                  onPress={() => router.push('/custom-food')}
                />
              </QuickTileRow>

              {(recentSearches.data?.length ?? 0) > 0 ? (
                <View style={styles.stackSm}>
                  <AppText variant="caption" tone="muted">
                    Recent searches
                  </AppText>
                  {chunk(recentSearches.data!, 3).map((row) => (
                    <QuickTileRow key={row.join('|')}>
                      {row.map((q) => (
                        <QuickTile
                          key={q}
                          icon="search-outline"
                          label={q}
                          onPress={() => setQuery(q)}
                        />
                      ))}
                    </QuickTileRow>
                  ))}
                </View>
              ) : null}

              <AppText variant="heading" weight="600" display>
                Frequently logged for {mealName}
              </AppText>
              {(frequents.data?.length ?? 0) === 0 ? (
                <AppText variant="caption" tone="muted">
                  Foods you log often to {mealName.toLowerCase()} will show up here.
                </AppText>
              ) : (
                <View style={styles.stack}>
                  {frequents.data!.map((f) => (
                    <FoodPickRow
                      key={f.foodKey}
                      title={f.name}
                      subtitle={`Logged ${f.count}× to ${mealName.toLowerCase()}`}
                      imageUrl={f.imageUrl}
                      onPress={() => openHistoryItem(f.foodKey)}
                    />
                  ))}
                </View>
              )}

              <AppText variant="heading" weight="600" display>
                Recently logged
              </AppText>
              {(recents.data?.length ?? 0) === 0 ? (
                <AppText variant="caption" tone="muted">
                  Your latest foods will appear here after you log something.
                </AppText>
              ) : (
                <View style={styles.stack}>
                  {recents.data!.map((r) => (
                    <FoodPickRow
                      key={r.foodKey}
                      title={r.name}
                      subtitle="Recently logged"
                      imageUrl={r.imageUrl}
                      onPress={() => openHistoryItem(r.foodKey)}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.wrapRow}>
                {(['all', 'branded', 'generic'] as const).map((f) => (
                  <Chip
                    key={f}
                    label={f === 'all' ? 'All' : f === 'branded' ? 'Branded' : 'Generic'}
                    selected={filter === f}
                    onPress={() => setFilter(f)}
                  />
                ))}
              </View>

              {search.isLoading ? (
                <AppText variant="caption" tone="muted" align="center">
                  Searching USDA, restaurant menus, Open Food Facts and built-in foods…
                </AppText>
              ) : null}

              {search.isError ? (
                <ErrorState
                  message="Food search needs an internet connection. Check your connection and try again."
                  onRetry={() => search.refetch()}
                />
              ) : null}

              {search.data ? (
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
                    <View style={styles.stack}>
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
          )}
        </>
      ) : null}

      {tab === 'foods' ? (
        <>
          <Button title="New custom food" onPress={() => router.push('/custom-food')} />
          {(customFoods.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No custom foods yet"
              body="Create foods you eat often so logging takes two taps."
            />
          ) : (
            <View style={styles.stack}>
              {customFoods.data!.map((f) => (
                <FoodPickRow
                  key={f.id}
                  title={f.favorite ? `★ ${f.name}` : f.name}
                  subtitle={[f.brand, `${Math.round(f.nutrition.calories)} kcal`]
                    .filter(Boolean)
                    .join(' · ')}
                  imageUrl={f.imageUrl}
                  onPress={() =>
                    router.push({
                      pathname: '/food/[provider]/[id]',
                      params: { provider: 'custom', id: f.id },
                    })
                  }
                />
              ))}
            </View>
          )}
        </>
      ) : null}

      {tab === 'meals' ? (
        <>
          <Button title="New saved meal" onPress={() => router.push('/meal-editor')} />
          {(mealsList.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No saved meals yet"
              body="Save combinations you eat together and log them in one tap."
            />
          ) : (
            <View style={styles.stack}>
              {mealsList.data!.map((m) => (
                <FoodPickRow
                  key={m.id}
                  title={m.favorite ? `★ ${m.name}` : m.name}
                  subtitle={`${m.items.length} item${m.items.length === 1 ? '' : 's'} · ${Math.round(savedMeals.totalNutrition(m).calories)} kcal`}
                  imageUrl={m.imageUrl}
                  onPress={() =>
                    router.push({ pathname: '/log-collection', params: { kind: 'meal', id: m.id } })
                  }
                />
              ))}
            </View>
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
            <View style={styles.stack}>
              {recipesList.data!.map((r) => (
                <FoodPickRow
                  key={r.id}
                  title={r.favorite ? `★ ${r.name}` : r.name}
                  subtitle={`${r.ingredients.length} ingredients · ${Math.round(recipes.perServing(r).calories)} kcal/serv`}
                  imageUrl={r.imageUrl}
                  onPress={() =>
                    router.push({
                      pathname: '/log-collection',
                      params: { kind: 'recipe', id: r.id },
                    })
                  }
                />
              ))}
            </View>
          )}
        </>
      ) : null}

      <Sheet visible={mealPickerOpen} onClose={() => setMealPickerOpen(false)} title="Select a meal">
        {(categories.data ?? []).map((cat) => (
          <Pressable
            key={cat.id}
            accessibilityRole="button"
            accessibilityState={{ selected: cat.id === meal }}
            onPress={() => {
              setTargetMeal(cat.id);
              setMealPickerOpen(false);
            }}
            style={[
              styles.mealOption,
              {
                backgroundColor: cat.id === meal ? colors.accent + '18' : colors.track,
                borderColor: cat.id === meal ? colors.accent : colors.border,
              },
            ]}
          >
            <AppText variant="body" weight={cat.id === meal ? '600' : '400'}>
              {cat.name}
            </AppText>
            {cat.id === meal ? <Ionicons name="checkmark" size={20} color={colors.accent} /> : null}
          </Pressable>
        ))}
        <AppText variant="micro" tone="muted">
          Logging to {mealName} · {formatDayKey(date)}
        </AppText>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTarget,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealPicker: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: touchTarget,
    paddingHorizontal: spacing.sm,
  },
  headerSpacer: {
    width: 40,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  barcodeBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    minHeight: 44,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  tabHit: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  tabUnderline: {
    height: 2,
    width: '70%',
    borderRadius: 1,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 88,
  },
  quickTilePad: {
    flex: 1,
  },
  stack: {
    gap: spacing.sm,
  },
  stackSm: {
    gap: spacing.sm,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  foodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: touchTarget + 8,
  },
  foodCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  addCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: touchTarget,
  },
});
