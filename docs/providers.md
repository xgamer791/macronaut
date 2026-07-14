# Food-data providers

Lookup flows through `createFoodSearchService` in
`src/services/food/foodSearchService.ts`:

1. **Bundled generics** (`genericFoods.ts`) — USDA SR Legacy per-100 g.
2. **Official restaurant foods** (`restaurantFoods.ts`) — McDonald's,
   Chipotle, Starbucks, Subway, Chick-fil-A, Taco Bell curated menu items.
3. **USDA FoodData Central** (`usda.ts`) — Foundation → SR Legacy → Survey
   (FNDDS) → Branded priority. Key: `EXPO_PUBLIC_USDA_API_KEY`.
4. **Nutritionix** (`nutritionix.ts`) — instant search + UPC + natural
   nutrients. Keys: `EXPO_PUBLIC_NUTRITIONIX_APP_ID` /
   `EXPO_PUBLIC_NUTRITIONIX_APP_KEY`. Inactive (empty results) when unset.
5. **FatSecret** (`fatsecret.ts`) — OAuth2 client_credentials, foods.search +
   barcode. Keys: `EXPO_PUBLIC_FATSECRET_CLIENT_ID` /
   `EXPO_PUBLIC_FATSECRET_CLIENT_SECRET`. Inactive when unset.
6. **Open Food Facts** (`openFoodFacts.ts`) — packaged foods, ingredients,
   allergens, images. No key.

Network providers share `httpClient.ts`. Barcodes use `barcodeNormalize.ts`.

## Search result shape

```ts
{
  foods: ProviderFood[];           // flat, best-first (backward compatible)
  groups: GroupedSearchResults;    // Best / USDA / Packaged / Restaurant / My
  autoSelected?: ProviderFood;     // only when confidence ≥ 0.80
  failures: { provider, kind }[];
  allFailed: boolean;
}
```

## Adding a provider

1. Implement `FoodProvider` in `src/services/food/myProvider.ts` using
   `foodHttp`; map into `ProviderFood`.
2. Ensure `ProviderId` / `SOURCE_TRUST` / `SOURCE_LABEL` include the id.
3. Register in `defaultProviders()` inside `createFoodSearchService`.
4. Document env keys in `.env.example`.
