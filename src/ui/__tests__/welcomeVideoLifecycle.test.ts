import fs from 'node:fs';
import path from 'node:path';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('expo-image', () => ({ Image: jest.fn() }));
jest.mock('react-native', () => ({ Image: {}, StyleSheet: { absoluteFill: {} }, View: jest.fn() }));
jest.mock('@/ui/WelcomeSlideshow', () => ({ WelcomeSlideshow: jest.fn() }));
jest.mock('../../../assets/video/welcome-loop.mp4', () => 'welcome-loop.mp4');

class Host {
  children: Video[] = [];
  appendChild(video: Video) {
    video.remove();
    this.children.push(video);
    video.parentElement = this;
  }
}

class Video {
  parentElement: Host | null = null;
  style: Record<string, string> = {};
  listeners = new Map<string, () => void>();
  src = '';
  poster = '';
  currentTime = 0;
  paused = true;
  muted = false;
  loop = false;
  playsInline = false;
  setAttribute = jest.fn();
  addEventListener(name: string, callback: () => void) {
    this.listeners.set(name, callback);
  }
  play = jest.fn(async () => {
    this.paused = false;
  });
  pause = jest.fn(() => {
    this.paused = true;
    this.listeners.get('pause')?.();
  });
  remove() {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
      this.parentElement = null;
    }
  }
}

const asElement = (host: Host) => host as unknown as HTMLElement;
let player: typeof import('../WelcomeBackground.web');
let video: Video;
let createElement: jest.Mock;
const documentDescriptor = Object.getOwnPropertyDescriptor(global, 'document');

beforeEach(async () => {
  jest.resetModules();
  jest.useFakeTimers();
  video = new Video();
  createElement = jest.fn(() => video);
  Object.defineProperty(global, 'document', {
    configurable: true,
    value: { createElement, addEventListener: jest.fn(), visibilityState: 'visible' },
  });
  player = await import('../WelcomeBackground.web');
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  if (documentDescriptor) Object.defineProperty(global, 'document', documentDescriptor);
  else Reflect.deleteProperty(global, 'document');
});

it('uses one muted, inline video with identical framing on every auth route', () => {
  const first = player.acquireWelcomeVideo('loop.mp4', 'poster.jpg');
  const second = player.acquireWelcomeVideo('loop.mp4', 'poster.jpg');
  expect(first).toBe(second);
  expect(createElement).toHaveBeenCalledTimes(1);
  expect(video).toMatchObject({ muted: true, loop: true, playsInline: true });
  expect(video.style).toMatchObject({
    objectFit: 'cover',
    objectPosition: '50% 0%',
    pointerEvents: 'none',
  });
});

it('keeps playback time and avoids pausing between welcome, sign-in and signup', () => {
  player.acquireWelcomeVideo('loop.mp4', 'poster.jpg');
  const routes = [new Host(), new Host(), new Host(), new Host()];
  player.claimHost(asElement(routes[0]));
  video.currentTime = 7.25;
  for (let i = 1; i < routes.length; i += 1) {
    player.releaseHost(asElement(routes[i - 1]));
    jest.advanceTimersByTime(100);
    player.claimHost(asElement(routes[i]));
    jest.advanceTimersByTime(500);
    expect(video.currentTime).toBe(7.25);
    expect(video.parentElement).toBe(routes[i]);
    expect(video.paused).toBe(false);
  }
  expect(video.pause).not.toHaveBeenCalled();
});

it('pauses at the Health boundary and resumes the same player when going back', () => {
  player.acquireWelcomeVideo('loop.mp4', 'poster.jpg');
  const credentials = new Host();
  player.claimHost(asElement(credentials));
  video.currentTime = 12;
  player.releaseHost(asElement(credentials));
  jest.advanceTimersByTime(400);
  expect(video.parentElement).toBeNull();
  expect(video.paused).toBe(true);
  player.claimHost(asElement(credentials));
  expect(video.paused).toBe(false);
  expect(video.currentTime).toBe(12);
});

it('releases covered but still-mounted screens on navigation blur', () => {
  const source = fs.readFileSync(path.join(__dirname, '../WelcomeBackground.web.tsx'), 'utf8');
  const focus = source.slice(source.indexOf('  useFocusEffect('));
  expect(focus).toContain('return () => {');
  expect(focus).toContain('if (host) releaseHost(host)');
});

it('uses the video shell throughout auth and excludes Health and the signed-in app', () => {
  const read = (name: string) =>
    fs.readFileSync(path.join(__dirname, '../../app', name + '.tsx'), 'utf8');
  for (const route of [
    'login',
    'forgot-password',
    'signup-legal',
    'signup-account',
    'signup-credentials',
  ]) {
    expect(read(route)).toContain('<WelcomeScene>');
    expect(read(route)).toContain('backgroundColor: welcomeColors.background');
    expect(read(route)).toContain('<StatusBar style="light" />');
  }
  for (const route of ['signup-health', 'onboarding', '(tabs)/index']) {
    expect(read(route)).not.toContain('WelcomeScene');
  }
  expect(read('signup-credentials')).toContain("router.replace('/signup-health')");
  expect(read('+html')).toContain('[data-videoauthfield]');
});
