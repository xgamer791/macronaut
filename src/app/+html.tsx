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
          // data-authfield sit on the light auth chrome, and WebKit paints
          // autofilled text with its own black — force the light ink
          // explicitly. react-native-web drops className, hence the data attribute.
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
  background-color: #F6F7F9;
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
[data-authfield], [data-authfield] input, input[data-authfield] {
  color-scheme: light;
  color: #14181D;
  -webkit-text-fill-color: #14181D;
  caret-color: #14181D;
}
[data-authfield]:-webkit-autofill, [data-authfield]:-webkit-autofill:hover,
[data-authfield]:-webkit-autofill:focus, [data-authfield]:-webkit-autofill:active,
input[data-authfield]:-webkit-autofill, input[data-authfield]:-webkit-autofill:hover,
input[data-authfield]:-webkit-autofill:focus, input[data-authfield]:-webkit-autofill:active,
[data-authfield] input:-webkit-autofill, [data-authfield] input:-webkit-autofill:hover,
[data-authfield] input:-webkit-autofill:focus, [data-authfield] input:-webkit-autofill:active {
  color: #14181D !important;
  -webkit-text-fill-color: #14181D !important;
  caret-color: #14181D !important;
}
/* Liquid Glass — 2025–26 translucent UI recipe.
   Works on any colorful background; flat backgrounds will look subtler. */
.glass,
[data-headerglass] {
  background: radial-gradient(ellipse 130% 90% at 50% 0%, rgba(255, 255, 255, 0.94) 0%, rgba(246, 247, 249, 0.90) 45%, rgba(246, 247, 249, 0.88) 100%);
  backdrop-filter: blur(39px) saturate(135%);
  -webkit-backdrop-filter: blur(39px) saturate(135%);
  border: none;
  outline: none;
  border-radius: 0;
  box-shadow: 0 3px 8px -2px rgba(20, 24, 29, 0.08), 0 1px 2px rgba(20, 24, 29, 0.05), inset 0 0 23px rgba(255, 255, 255, 0.40), inset 0 4px 8px -4px rgba(20, 24, 29, 0.04);
  color: #14181D;
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
    background: #FFFFFF;
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
/* The page reserves the header band with fixed padding, so the browser is
 * never asked to re-anchor scrollTop while the slab moves. */
[data-screenscroll] {
  overflow-anchor: none;
}
/* Today / profile chrome: one slab over the page, same 294ms curve as stack /
 * friends feed. Transform only — animating anything that resizes the slab
 * would drag the page under it. */
[data-headerhide] {
  will-change: transform;
  transition: transform 294ms cubic-bezier(0.22, 1, 0.36, 1);
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
/* Calendar panel: the same right-hand slide, on the same curve. */
[data-calendarpanel] [data-calendarsheet] {
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
  [data-headermenu] [data-menudrawer],
  [data-calendarpanel] [data-calendarsheet] {
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
