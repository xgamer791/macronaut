# Database schema

Convex, defined in [`convex/schema.ts`](../convex/schema.ts). Convex validates
every write against it and rejects a document that does not match. Schema
changes are ordinary code changes: edit the file, and `npx convex dev` /
`npx convex deploy` push it with the functions.

Every table below carries a `userId` (`Id<'users'>`) and is only ever read
through an index that starts with it. See [security.md](security.md) for why
that is the whole isolation story.

## Tables

| Table | Purpose | Notable fields | Indexes (after `userId`) |
|---|---|---|---|
| `users`, `authAccounts`, `authSessions`, `authRefreshTokens`, `authVerificationCodes`, `authVerifiers`, `authRateLimits` | Convex Auth's own tables (`authTables`) | `users.email`, `users.name`, `authAccounts.provider` | as defined by Convex Auth |
| `settings` | typed key-value, JSON text | key, value | `by_user_key` (key) |
| `goalConfigs` | effective-dated goal versions | effectiveFrom, mode, baseTarget, perWeekday, training, rest, trainingDays, weeklyMode, weeklyTarget | `by_user_effective` (effectiveFrom) |
| `dayTypeMarks` | per-date training/rest overrides | date, dayType | `by_user_date` (date) |
| `mealCategories` | user-added meals only; the four built-ins are constants in `convex/mealCategories.ts` | catId, name, position | `by_user`, `by_user_cat` (catId) |
| `customFoods` | user-created foods (soft delete) | name, brand, barcode, servingQty/Unit, gramsPerServing, nutrition, favorite, deleted | `by_user`, `by_user_barcode` (barcode) |
| `cachedFoods` | provider results, per account | provider + providerId, barcode, nutritionPer100g/PerServing, flagged, corrected, confidence, restaurant, preparationState, searchText | `by_user_provider` (provider, providerId), `by_user_barcode` (barcode), search index `search_text` on searchText |
| `favorites` | provider-food favorites | foodKey, createdAt | `by_user`, `by_user_key` (foodKey) |
| `diaryEntries` | logged food, nutrition + image snapshotted at log time | date, meal, time, sourceType/Id, quantity, unit, imageUrl, nutrition | `by_user_date` (date) |
| `savedMeals` | reusable meals with embedded `items[]` | name, servings, favorite, deleted, items (id, name, quantity, unit, nutrition, position) | `by_user` |
| `recipes` | recipes with embedded `ingredients[]` | same shape as saved meals | `by_user` |
| `foodLogHistory` | powers recent/frequent ranking | foodKey, name, meal, loggedAt, imageUrl | `by_user`, `by_user_key` (foodKey) |
| `searchHistory` | recent searches (deduped) | query, searchedAt | `by_user_query` (query), `by_user_time` (searchedAt) |
| `activityEntries` | workouts | date, name, nameLower, activityType, durationMin, distanceKm, caloriesBurned, intensity | `by_user_date` (date), `by_user_name_date` (nameLower, date) |
| `dayNotes` | per-day journal notes, many per day | date, body | `by_user_date` (date) |

## Conventions

- **Ids.** Convex assigns `_id`; the app sees it as `id`. Custom meal
  categories keep their own `catId` (`custom-<slug>-<n>`) because diary rows
  reference meals by that string.
- **Timestamps.** `createdAt` / `updatedAt` are ISO-8601 strings set on the
  server, alongside Convex's own `_creationTime`. Ordering within a date is
  by `_creationTime`, which is what the indexes give for free.
- **Nutrition** is a structured object (`nutritionValidator` in
  `convex/lib/validators.ts`): `calories` required, the macros optional,
  `micros` an open record. Settings values are the one place JSON text is
  used, because their shapes vary per key.
- **Soft deletes.** `customFoods`, `savedMeals` and `recipes` set `deleted`
  rather than removing the row, so diary entries that reference them keep
  resolving. "Delete all data" and "Delete account" remove rows outright.
- **Undefined never reaches the server.** Optional fields are simply absent;
  the client repositories strip `undefined` before every call.

## Shared vs. per-account data

Everything above except the auth tables is per account. The provider cache is
per account too: a user's `corrected` and `flagged` marks are opinions about a
record, and keeping them with the user avoids one account's correction
changing what another sees.
