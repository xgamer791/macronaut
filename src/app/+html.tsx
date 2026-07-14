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
          dangerouslySetInnerHTML={{
            __html: `html, body { touch-action: pan-x pan-y; } body { -webkit-text-size-adjust: 100%; }`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
