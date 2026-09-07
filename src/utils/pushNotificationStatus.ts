/** In-app pause note for push notifications. A website cannot hold a push
 * token the way an app can, so this stops until an iOS build is on a real
 * device — the same wall Apple Health is behind. The full list of what is
 * waiting on that build is docs/native-ios.md. */

export const PUSH_STATUS_UPDATED = '7 September 2026';

/** Push is not live yet, so the opt-in is a stored intention rather than a
 * live permission. Flip this to a real check when the native app can ask. */
export function isPushNotificationsLive(): boolean {
  return false;
}

/** Whether someone wants push once it exists. Stored so the native build can
 * skip asking people who already said yes here. */
export const PUSH_WANTED_SETTING = 'pushNotificationsWanted';
