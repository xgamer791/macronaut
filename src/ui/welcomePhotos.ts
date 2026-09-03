/** Fallback stills in the same order as the Seedance loop: jog, meal,
 * yoga, bench, then squat last so the man in the gym is never the opener. */
export const WELCOME_PHOTOS = [
  require('../../assets/images/welcome/02-jog.jpg'),
  require('../../assets/images/welcome/03-meal.jpg'),
  require('../../assets/images/welcome/04-yoga.jpg'),
  require('../../assets/images/welcome/05-bench.jpg'),
  require('../../assets/images/welcome/01-lift.jpg'),
];

export const SESSION_WELCOME_INDEX = 0;
export const SESSION_WELCOME_PHOTO = WELCOME_PHOTOS[SESSION_WELCOME_INDEX];

/** Hold each still, then a slow cross-dissolve into the next. */
export const WELCOME_PHOTO_HOLD_MS = 6000;
export const WELCOME_PHOTO_FADE_MS = 1800;
