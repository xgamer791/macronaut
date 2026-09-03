import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { authColors } from './theme';

/** The barbell-M brand mark. `width` scales the whole drawing. */
export function BarbellMMark({ width = 78 }: { width?: number }) {
  const height = (width * 52) / 78;
  return (
    <Svg width={width} height={height} viewBox="0 0 78 52" accessibilityLabel="MacroNaught logo">
      {/* Left plates */}
      <Rect x={2} y={16} width={5} height={20} rx={1.5} fill="#2E8B57" />
      <Rect x={8} y={12} width={6} height={28} rx={1.5} fill="#3FA66A" />
      <Rect x={15} y={17} width={5} height={18} rx={1.2} fill="#57C07E" />
      {/* Crossbar through M */}
      <Rect x={20} y={24} width={38} height={4.5} rx={1} fill={authColors.navy} />
      {/* Bold M */}
      <Path
        d="M24 40 V12 H30 L39 30 L48 12 H54 V40 H48 V22 L39 38 H36 L27 22 V40 Z"
        fill={authColors.navy}
      />
      {/* Right plates */}
      <Rect x={58} y={17} width={5} height={18} rx={1.2} fill="#57C07E" />
      <Rect x={64} y={12} width={6} height={28} rx={1.5} fill="#3FA66A" />
      <Rect x={71} y={16} width={5} height={20} rx={1.5} fill="#2E8B57" />
    </Svg>
  );
}

/** Apple's Human Interface Guidelines allow a custom Sign in with Apple button
 * as long as it keeps the official logo, an approved title and Apple's own
 * black/white colours — which is what this and the Apple pill do, so the button
 * can match the Google and Email ones instead of standing apart from them. */
export function AppleLogo() {
  return (
    <Svg width={15} height={20} viewBox="0 0 384 512" accessibilityLabel="Apple logo">
      <Path
        fill="#FFFFFF"
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-36.8-2.8-77 21.3-91.7 21.3-15.5 0-51.1-20.3-79.1-20.3C56.9 141.1 0 184.7 0 273.5c0 26.2 4.8 53.3 14.4 81.2 12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-57.7-90.1-57.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </Svg>
  );
}

/** Official-style four-color Google G. */
export function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <Path fill="none" d="M0 0h48v48H0z" />
    </Svg>
  );
}
