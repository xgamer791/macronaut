import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { createFoodSearchService } from '@/services/food/foodSearchService';
import { ProviderFood, SearchFilter } from '@/services/food/types';
import { useRepos } from './AppProvider';

export function useFoodSearchService() {
  const { food } = useRepos();
  return useMemo(() => createFoodSearchService(food), [food]);
}

/** Debounce a changing value. */
export function useDebounced<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function emptyGroups() {
  return {
    bestMatch: null as ProviderFood | null,
    usdaWholeFoods: [] as ProviderFood[],
    packagedFoods: [] as ProviderFood[],
    restaurantFoods: [] as ProviderFood[],
    myFoods: [] as ProviderFood[],
  };
}

/** Debounced provider search that records history and falls back to the
 * local cache when offline. */
export function useFoodSearch(query: string, filter: SearchFilter) {
  const svc = useFoodSearchService();
  const { history, food } = useRepos();
  const debounced = useDebounced(query.trim(), 350);

  // Prefetch bundled/cache hits while the user is still typing.
  useEffect(() => {
    const q = query.trim();
    if (q.length >= 2 && q !== debounced) {
      svc.prefetchLikely(q).catch(() => {});
    }
  }, [query, debounced, svc]);

  return useQuery({
    queryKey: ['food-search', debounced, filter],
    enabled: debounced.length >= 2,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const result = await svc.search(debounced, { filter });
      history.recordSearch(debounced).catch(() => {});
      if (result.allFailed) {
        const cached = await food.searchCached(debounced, 25);
        const foods: ProviderFood[] = cached.map((c) => ({
          provider: c.provider,
          id: c.providerId,
          name: c.name,
          brand: c.brand,
          restaurant: c.restaurant,
          barcode: c.barcode,
          imageUrl: c.imageUrl,
          isGeneric: c.category === 'generic',
          nutritionPer100g: c.nutritionPer100g,
          nutritionPerServing: c.nutritionPerServing,
          gramsPerServing: c.gramsPerServing,
          servingLabel: c.servingUnit,
          category: c.category,
          preparationState: c.preparationState,
        }));
        return {
          foods,
          groups: {
            ...emptyGroups(),
            bestMatch: foods[0] ?? null,
            packagedFoods: foods.filter((f) => f.category !== 'restaurant' && f.category !== 'generic'),
            restaurantFoods: foods.filter((f) => f.category === 'restaurant'),
            usdaWholeFoods: foods.filter((f) => f.category === 'generic' || f.isGeneric),
          },
          failures: result.failures,
          allFailed: true,
        };
      }
      return result;
    },
  });
}
