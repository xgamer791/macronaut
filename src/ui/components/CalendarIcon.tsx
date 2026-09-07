import { CalendarDays } from 'lucide-react-native';
import type React from 'react';

/** The single calendar glyph used throughout the app. */
export function CalendarIcon(props: React.ComponentProps<typeof CalendarDays>) {
  return <CalendarDays {...props} />;
}
