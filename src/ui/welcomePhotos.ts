/** Three Higgsfield Nano Banana 2 Lite stills — powerlift, jog, yoga.
 * Chosen once per JS load so the splash is not a single locked athlete, and
 * so the screen itself never calls Math.random during render. */
export const WELCOME_PHOTOS = [
  require('../../assets/images/welcome/01-lift.jpg'),
  require('../../assets/images/welcome/02-jog.jpg'),
  require('../../assets/images/welcome/03-yoga.jpg'),
];

export const SESSION_WELCOME_INDEX = Math.floor(Math.random() * WELCOME_PHOTOS.length);
export const SESSION_WELCOME_PHOTO = WELCOME_PHOTOS[SESSION_WELCOME_INDEX];

/** Hold each still, then a slow cross-dissolve into the next. */
export const WELCOME_PHOTO_HOLD_MS = 6000;
export const WELCOME_PHOTO_FADE_MS = 1800;
