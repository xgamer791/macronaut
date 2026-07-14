import React from 'react';
import { addDays, DayKey, formatDayKey, todayKey } from '@/utils/date';
import { ListRow } from './ListRow';
import { Sheet } from './Sheet';

export interface DatePickSheetProps {
  visible: boolean;
  onClose: () => void;
  onPick: (date: DayKey) => void;
  title?: string;
  /** Days back/forward from today to offer. */
  back?: number;
  forward?: number;
}

/** Simple nearby-date picker (±2 weeks) for copy/move flows. */
export function DatePickSheet({
  visible,
  onClose,
  onPick,
  title = 'Choose a date',
  back = 7,
  forward = 14,
}: DatePickSheetProps) {
  const today = todayKey();
  const dates: DayKey[] = [];
  for (let i = -back; i <= forward; i++) dates.push(addDays(today, i));

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {dates.map((d) => (
        <ListRow
          key={d}
          title={formatDayKey(d)}
          subtitle={d}
          onPress={() => {
            onPick(d);
            onClose();
          }}
        />
      ))}
    </Sheet>
  );
}
