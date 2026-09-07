import fs from 'node:fs';
import path from 'node:path';
import {
  PUSH_STATUS_UPDATED,
  PUSH_WANTED_SETTING,
  isPushNotificationsLive,
} from '@/utils/pushNotificationStatus';

const root = path.join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const optIn = () => read('src', 'ui', 'components', 'NotificationOptIn.tsx');

/** The push toggle at the top of Notifications, and the list of what is
 * waiting on a native iOS build. Both are promises to a future build, so
 * these pin the parts that build will look for. */
describe('push notification opt-in', () => {
  it('sits at the top of Notifications, above every other state', () => {
    const page = read('src', 'app', 'notifications.tsx');
    expect(page).toContain('<NotificationOptIn />');
    // Before the loading, error, empty and list branches, so it is there
    // whether or not anyone has notifications yet.
    expect(page.indexOf('<NotificationOptIn />')).toBeLessThan(page.indexOf('feed.isLoading'));
    expect(read('src', 'ui', 'components', 'index.ts')).toContain(
      "export { NotificationOptIn } from './NotificationOptIn';",
    );
  });

  it('is a switch in the app’s own list language, not a banner to dismiss', () => {
    const source = optIn();
    expect(source).toContain('<Switch');
    // A control does not need dismissing; only a promotion does. So: no close
    // button, no stored dismissal, and none of the banner copy that needs one.
    expect(source).not.toContain('Pressable');
    expect(source).not.toContain('DISMISSED');
    expect(source).not.toMatch(/'close/);
    expect(source).not.toMatch(/Notifications Disabled/);
  });

  it('stores the answer as an account setting the native build can read', () => {
    const source = optIn();
    expect(source).toContain('PUSH_WANTED_SETTING');
    expect(source).toContain('settings.set(PUSH_WANTED_SETTING, next)');
    expect(source).toContain('keys.setting(PUSH_WANTED_SETTING)');
    expect(PUSH_WANTED_SETTING).toBe('pushNotificationsWanted');
  });

  it('never claims push is on, because a website has nowhere to hold a token', () => {
    expect(isPushNotificationsLive()).toBe(false);
    // Once it is live there is nothing left to ask for.
    expect(optIn()).toContain('if (isPushNotificationsLive()) return null;');
    expect(PUSH_STATUS_UPDATED).toMatch(/^\d{1,2} \w+ \d{4}$/);
  });

  it('keeps only the key the native build needs', () => {
    const status = read('src', 'utils', 'pushNotificationStatus.ts');
    expect(status).not.toContain('pushBannerDismissed');
    expect(status).toContain('docs/native-ios.md');
  });
});

describe('the after-native to-do list', () => {
  const doc = () => read('docs', 'native-ios.md');

  it('carries both parked features', () => {
    const text = doc();
    expect(text).toMatch(/## 1\. Apple Health and Apple Watch/);
    expect(text).toMatch(/## 2\. Push notifications/);
    // It points at the existing plans rather than re-planning them.
    expect(text).toContain('docs/apple-health.md');
    expect(text).toContain('docs/ios-setup.md');
    expect(text).toContain('src/utils/appleHealthStatus.ts');
    expect(text).toContain('src/utils/pushNotificationStatus.ts');
    expect(text).toContain('src/ui/components/NotificationOptIn.tsx');
  });

  it('describes the row that actually ships', () => {
    const text = doc();
    expect(text).not.toContain('pushBannerDismissed');
    expect(text).not.toMatch(/modelled on X/i);
    expect(text).toContain('pushNotificationsWanted');
  });

  it('is reachable from the README and from the Apple Health plan', () => {
    expect(read('README.md')).toContain('docs/native-ios.md');
    expect(read('docs', 'apple-health.md')).toContain('docs/native-ios.md');
  });
});
