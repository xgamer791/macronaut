import React from 'react';
import { FieldLabel as BaseLabel, OutlineInput as BaseInput } from '@/ui/DarkField';

export { VIDEO_FIELD as DARK_FIELD, videoFieldStyles as fieldStyles } from '@/ui/DarkField';

/** Opt-in video styling, leaving personalization's light fields untouched. */
export function FieldLabel(props: React.ComponentProps<typeof BaseLabel>) {
  return <BaseLabel {...props} appearance="video" />;
}

export function OutlineInput(props: React.ComponentProps<typeof BaseInput>) {
  return <BaseInput {...props} appearance="video" />;
}
