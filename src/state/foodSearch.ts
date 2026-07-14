import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { createFoodSearchService } from '@/services/food/foodSearchService';
import { SearchFilter } from '@/services/food/types';
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

/** Debounced provider search that records history and falls back to the
 * local cache when offline. */
export function useFoodSearch(query: string, filter: SearchFilter) {
  const svc = useFoodSearchService();
  const { history, food } = useRepos();
  const debounced = useDebounced(query.trim(), 350);

  return useQuery({
    queryKey: ['food-search', debounced, filter],
    enabled: debounced.length >= 2,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const result = await svc.search(debounced, { filter });
      history.recordSearch(debounced).catch(() => {});
      if (result.allFailed) {
        // Offline / providers down — serve from the local cache.
        const cached = await food.searchCached(debounced, 25);
        return {
          foods: cached.map((c) => ({
            provider: c.provider,
            id: c.providerId,
            name: c.name,
            brand: c.brand,
            barcode: c.barcode,
            imageUrl: c.imageUrl,
            isGeneric: false,
            nutritionPer100g: c.nutritionPer100g,
            nutritionPerServing: c.nutritionPerServing,
            gramsPerServing: c.gramsPerServing,
            servingLabel: c.servingUnit,
          })),
          failures: result.failures,
          allFailed: true,
        };
      }
      return result;
    },
  });
}
