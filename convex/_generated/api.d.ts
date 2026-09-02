/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import type * as ResendOTP from "../ResendOTP.js";
import type * as account from "../account.js";
import type * as activity from "../activity.js";
import type * as auth from "../auth.js";
import type * as dayNotes from "../dayNotes.js";
import type * as diary from "../diary.js";
import type * as foods from "../foods.js";
import type * as goals from "../goals.js";
import type * as history from "../history.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_collections from "../lib/collections.js";
import type * as lib_validators from "../lib/validators.js";
import type * as mealCategories from "../mealCategories.js";
import type * as recipes from "../recipes.js";
import type * as savedMeals from "../savedMeals.js";
import type * as settings from "../settings.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  account: typeof account;
  activity: typeof activity;
  auth: typeof auth;
  dayNotes: typeof dayNotes;
  diary: typeof diary;
  foods: typeof foods;
  goals: typeof goals;
  history: typeof history;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/collections": typeof lib_collections;
  "lib/validators": typeof lib_validators;
  mealCategories: typeof mealCategories;
  recipes: typeof recipes;
  savedMeals: typeof savedMeals;
  settings: typeof settings;
}>;
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
