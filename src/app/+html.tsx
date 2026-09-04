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
          // Also kill the manila autofill wash on every input.
          dangerouslySetInnerHTML={{
            __html: `html, body { touch-action: pan-x pan-y; } body { -webkit-text-size-adjust: 100%; }
input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active,
textarea:-webkit-autofill, textarea:-webkit-autofill:hover, textarea:-webkit-autofill:focus, textarea:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 1000px transparent inset !important;
  box-shadow: 0 0 0 1000px transparent inset !important;
  -webkit-text-fill-color: inherit !important;
  caret-color: inherit;
  background-image: none !important;
  transition: background-color 99999s ease-out 0s;
}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
