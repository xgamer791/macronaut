import { Easing } from 'react-native-reanimated';

/** One curve and one duration for every horizontal move in the app: a panel
 * sliding in, the page it pushes aside, the header drawer. They are seen
 * together, so they have to be timed together. Kept apart from `SlideScreen`
 * so the pushed layer can share them without importing the panel. */
export const SLIDE_EASING = Easing.bezier(0.22, 1, 0.36, 1);
export const SLIDE_DURATION_MS = 294;
