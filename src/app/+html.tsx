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
 * Pin the shell to the visible viewport so only in-app ScrollViews move. */
html, body, #root {
  height: 100%;
  height: 100dvh;
  min-height: 100dvh;
  max-height: 100dvh;
  width: 100%;
  background-color: #101418;
}
html, body {
  position: fixed;
  inset: 0;
  overflow: hidden;
  overscroll-behavior: none;
}
#root { display: flex; }
/* Lock the Apple Health ask to the visible viewport on the first paint.
 * JS insets and window height start at 0 and then update, which lifts
 * the screen and drops it. CSS env() and 100dvh are known immediately. */
#signup-health-root {
  position: fixed !important;
  inset: 0 !important;
  height: 100dvh !important;
  width: 100% !important;
  max-height: 100dvh !important;
}
#signup-health-frame {
  padding-top: calc(env(safe-area-inset-top, 0px) + 4px) !important;
}
#signup-health-lower {
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 20px) !important;
}
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
      </head>
      <body>{children}</body>
    </html>
  );
}
