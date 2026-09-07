import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';

/** Web HTML shell. Zoom is disabled on all devices (maximum-scale=1 +
 * user-scalable=no) so the app feels native — this also prevents iOS
 * Safari's automatic zoom-in when focusing text inputs. */
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <title>Macronaut</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="description" content="Macronaut — clean calorie and macro tracking." />
        <ScrollViewStyleReset />
        <style
          // Belt-and-braces: block pinch/double-tap zoom gestures in browsers
          // that ignore user-scalable, without breaking scroll or taps.
          // Also kill the manila autofill wash. Fields marked with
          // data-darkfield sit on the dark video, and WebKit paints autofilled
          // text with its own black, so they force white explicitly —
          // react-native-web drops className, hence the data attribute.
          dangerouslySetInnerHTML={{
            __html: `html, body { touch-action: pan-x pan-y; } body { -webkit-text-size-adjust: 100%; }
/* iOS Safari pans the document when it sees a new-password field, which
 * lifts the welcome screens and leaves a white gap under the photo.
 * Pin the shell to the visible viewport so only in-app ScrollViews move.
 * The height and top come from visualViewport (see the script below):
 * dvh resolves against the URL-bar-collapsed viewport, so while the bar is
 * still open the shell is taller than what is on screen and anchored above
 * it, which cuts the top off every screen. */
html, body, #root {
  height: 100%;
  height: var(--app-viewport-height, 100%);
  width: 100%;
  background-color: #101418;
}
html, body {
  position: fixed;
  left: 0;
  right: 0;
  top: var(--app-viewport-top, 0px);
  overflow: hidden;
  overscroll-behavior: none;
}
#root { display: flex; }
input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active,
textarea:-webkit-autofill, textarea:-webkit-autofill:hover, textarea:-webkit-autofill:focus, textarea:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 1000px transparent inset !important;
  box-shadow: 0 0 0 1000px transparent inset !important;
  background-image: none !important;
  transition: background-color 99999s ease-out 0s;
}
[data-darkfield], [data-darkfield] input, input[data-darkfield] {
  color-scheme: dark;
  color: #FFFFFF;
  -webkit-text-fill-color: #FFFFFF;
  caret-color: #FFFFFF;
}
[data-darkfield]:-webkit-autofill, [data-darkfield]:-webkit-autofill:hover,
[data-darkfield]:-webkit-autofill:focus, [data-darkfield]:-webkit-autofill:active,
input[data-darkfield]:-webkit-autofill, input[data-darkfield]:-webkit-autofill:hover,
input[data-darkfield]:-webkit-autofill:focus, input[data-darkfield]:-webkit-autofill:active,
[data-darkfield] input:-webkit-autofill, [data-darkfield] input:-webkit-autofill:hover,
[data-darkfield] input:-webkit-autofill:focus, [data-darkfield] input:-webkit-autofill:active {
  color: #FFFFFF !important;
  -webkit-text-fill-color: #FFFFFF !important;
  caret-color: #FFFFFF !important;
}
/* Liquid Glass — 2025–26 translucent UI recipe.
   Works on any colorful background; flat backgrounds will look subtler. */
.glass,
[data-headerglass] {
  background: radial-gradient(ellipse 130% 90% at 50% 0%, rgba(0, 0, 0, 0.630) 0%, rgba(0, 0, 0, 0.550) 45%, rgba(0, 0, 0, 0.500) 100%);
  backdrop-filter: blur(39px) saturate(135%);
  -webkit-backdrop-filter: blur(39px) saturate(135%);
  border: none;
  outline: none;
  border-radius: 0;
  box-shadow: 0 3px 8px -2px rgba(0, 0, 0, 0.198), 0 1px 2px rgba(0, 0, 0, 0.099), inset 0 0 23px rgba(255, 255, 255, 0.040), inset 0 4px 8px -4px rgba(0, 0, 0, 0.220);
  color: #ffffff;
  overflow: hidden;
  isolation: isolate;
}
.glass::before,
[data-headerglass]::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(ellipse 110% 65% at 50% -15%, rgba(255, 255, 255, 0.000) 0%, rgba(255, 255, 255, 0) 70%);
  opacity: 0.00;
  mix-blend-mode: screen;
  pointer-events: none;
  z-index: 1;
}
.glass::after,
[data-headerglass]::after {
  content: none;
}
.glass > *,
[data-headerglass] > * { position: relative; z-index: 2; }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass,
  [data-headerglass] {
    background: rgba(0, 0, 0, 1.000);
  }
}
/* Stack pages slide over the screen underneath. Notifications and profiles
 * enter from the right; everything else from the left. */
[data-slidescreen] {
  will-change: transform;
  transition: transform 294ms cubic-bezier(0.22, 1, 0.36, 1);
}
/* The page underneath travels with the panel, on the one curve, so the two
 * read as a single strip being pulled across rather than a cover and a page. */
[data-slidepush] {
  will-change: transform;
  transition: transform 294ms cubic-bezier(0.22, 1, 0.36, 1);
}
/* Changing the header's in-flow size must not let the browser rewrite
 * scrollTop — that fight is what makes iOS rubber-band hitch. */
[data-screenscroll] {
  overflow-anchor: none;
}
/* Today / profile chrome: one slab, same 294ms curve as stack / friends feed. */
[data-headerhide] {
  will-change: transform, margin-bottom;
  transition: transform 294ms cubic-bezier(0.22, 1, 0.36, 1),
    margin-bottom 294ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-headerhide="out"] {
  transform: translateY(-100%);
}
/* Hamburger drawer: same 294ms curve as stack / friends feed. */
[data-headermenu] [data-menuscrim] {
  transition: opacity 294ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-headermenu="shut"] [data-menuscrim] {
  opacity: 0;
}
[data-headermenu] [data-menudrawer] {
  will-change: transform;
  transition: transform 294ms cubic-bezier(0.22, 1, 0.36, 1);
}
@media (prefers-reduced-motion: reduce) {
  [data-slidescreen],
  [data-slidepush] {
    transition: none;
  }
  [data-headerhide] {
    transition: none;
  }
  [data-headermenu] [data-menuscrim],
  [data-headermenu] [data-menudrawer] {
    transition: none;
  }
}`,
          }}
        />
        <script
          // Keep the shell exactly on the pixels the browser is showing.
          // Skipped while a field is focused so the soft keyboard does not
          // squash the layout; the blur re-syncs it.
          dangerouslySetInnerHTML={{
            __html: `(function () {
  var root = document.documentElement;
  var vv = window.visualViewport;
  function typing() {
    var el = document.activeElement;
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true;
  }
  function sync() {
    if (typing()) return;
    var height = vv ? vv.height : window.innerHeight;
    var top = vv ? vv.offsetTop : 0;
    root.style.setProperty('--app-viewport-height', Math.round(height) + 'px');
    root.style.setProperty('--app-viewport-top', Math.round(top) + 'px');
  }
  sync();
  if (vv) {
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
  }
  window.addEventListener('orientationchange', sync);
  window.addEventListener('pageshow', sync);
  window.addEventListener('load', sync);
  document.addEventListener('focusout', function () { setTimeout(sync, 0); });
})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
