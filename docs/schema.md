# Database schema

SQLite, versioned by forward-only migrations (`src/db/migrations`). Applied
versions are recorded in `migrations`; new installs replay the chain, old
installs apply only what they're missing — user data survives upgrades
(covered by tests).

## Tables (v2)

| Table | Purpose | Key columns |
|---|---|---|
| `migrations` | applied migration versions | version, name, applied_at |
| `settings` | typed key-value (JSON) | key, value |
| `goal_configs` | effective-dated goal versions (JSON payload) | id, effective_from, payload |
| `day_type_marks` | per-date training/rest overrides | date, day_type |
| `meal_categories` | six built-ins + user categories | id, name, position, builtin |
| `custom_foods` | user-created foods (soft delete) | id, name, barcode, serving_qty/unit, grams_per_serving, nutrition(JSON), favorite |
| `cached_foods` | provider results for offline/speed | (provider, provider_id) PK, barcode, image_url, nutrition_per_100g/serving(JSON), flagged |
| `diary_entries` | logged food, nutrition + image snapshotted | id, date, meal, source_type/id, quantity, unit, image_url, nutrition(JSON) |
| `saved_meals` / `saved_meal_items` | reusable meals | parent: servings; items: quantity, unit, nutrition(JSON), position |
| `recipes` / `recipe_ingredients` | recipes | same shape as saved meals |
| `food_log_history` | powers recent/frequent ranking | food_key, name, meal, logged_at, image_url |
| `search_history` | recent searches (deduped) | query PK, searched_at |
| `favorites` | provider-food favorites | food_key PK |

Nutrition values are stored as JSON text: they are read/written as whole
objects, never queried by field, and the shape can grow (micros) without
schema churn. Everything that is filtered or joined has real columns.

Migration list:
1. `001_init` — full schema + default meal categories
2. `002_food_images` — image_url on diary_entries + food_log_history
