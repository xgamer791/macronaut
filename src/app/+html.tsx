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
