/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { ApiFromModules, FilterApi, FunctionReference } from 'convex/server';
import type * as ResendOTP from '../ResendOTP.js';
import type * as account from '../account.js';
import type * as activity from '../activity.js';
import type * as auth from '../auth.js';
import type * as chats from '../chats.js';
import type * as dayNotes from '../dayNotes.js';
import type * as diary from '../diary.js';
import type * as foods from '../foods.js';
import type * as foodScan from '../foodScan.js';
import type * as fasting from '../fasting.js';
import type * as goals from '../goals.js';
import type * as groupChats from '../groupChats.js';
import type * as groups from '../groups.js';
import type * as gyms from '../gyms.js';
import type * as history from '../history.js';
import type * as http from '../http.js';
import type * as lib_aiScanAccess from '../lib/aiScanAccess.js';
import type * as lib_auth from '../lib/auth.js';
import type * as lib_collections from '../lib/collections.js';
import type * as lib_geo from '../lib/geo.js';
import type * as lib_googlePlaces from '../lib/googlePlaces.js';
import type * as lib_grokVision from '../lib/grokVision.js';
import type * as lib_gymMembership from '../lib/gymMembership.js';
import type * as lib_gymVotes from '../lib/gymVotes.js';
import type * as lib_handles from '../lib/handles.js';
import type * as lib_profileAccess from '../lib/profileAccess.js';
import type * as lib_validators from '../lib/validators.js';
import type * as mealCategories from '../mealCategories.js';
import type * as notifications from '../notifications.js';
import type * as photos from '../photos.js';
import type * as places from '../places.js';
import type * as profiles from '../profiles.js';
import type * as recipes from '../recipes.js';
import type * as savedMeals from '../savedMeals.js';
import type * as settings from '../settings.js';
import type * as trainingSchedule from '../trainingSchedule.js';

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
  chats: typeof chats;
  dayNotes: typeof dayNotes;
  diary: typeof diary;
  foods: typeof foods;
  foodScan: typeof foodScan;
  fasting: typeof fasting;
  goals: typeof goals;
  groupChats: typeof groupChats;
  groups: typeof groups;
  gyms: typeof gyms;
  history: typeof history;
  http: typeof http;
  'lib/aiScanAccess': typeof lib_aiScanAccess;
  'lib/auth': typeof lib_auth;
  'lib/collections': typeof lib_collections;
  'lib/geo': typeof lib_geo;
  'lib/googlePlaces': typeof lib_googlePlaces;
  'lib/grokVision': typeof lib_grokVision;
  'lib/gymMembership': typeof lib_gymMembership;
  'lib/gymVotes': typeof lib_gymVotes;
  'lib/handles': typeof lib_handles;
  'lib/profileAccess': typeof lib_profileAccess;
  'lib/validators': typeof lib_validators;
  mealCategories: typeof mealCategories;
  notifications: typeof notifications;
  photos: typeof photos;
  places: typeof places;
  profiles: typeof profiles;
  recipes: typeof recipes;
  savedMeals: typeof savedMeals;
  settings: typeof settings;
  trainingSchedule: typeof trainingSchedule;
}>;
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, 'public'>>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, 'internal'>>;
