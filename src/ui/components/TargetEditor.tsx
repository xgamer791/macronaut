import React from 'react';
import { View } from 'react-native';
import { NutrientTargets } from '@/domain/types';
import { spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { NumberField } from './NumberField';

export interface TargetEditorProps {
  value: NutrientTargets;
  onChange: (next: NutrientTargets) => void;
  /** Show the extended nutrient fields (fiber/sugar/sodium/cholesterol). */
  extended?: boolean;
}

/** Shared editor for a full set of nutrient targets — used by onboarding
 * review, daily/weekday/training/weekly goal editors. */
export function TargetEditor({ value, onChange, extended = true }: TargetEditorProps) {
  const set = (key: keyof NutrientTargets, v: number | undefined) =>
    onChange({ ...value, [key]: key === 'calories' ? (v ?? 0) : v });

  return (
    <View style={{ gap: spacing.md }}>
      <NumberField
        label="Calories"
        value={value.calories}
        onChange={(v) => set('calories', v)}
        unit="kcal"
        required
      />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Protein"
            value={value.protein}
            onChange={(v) => set('protein', v)}
            unit="g"
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Carbs"
            value={value.carbs}
            onChange={(v) => set('carbs', v)}
            unit="g"
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField label="Fat" value={value.fat} onChange={(v) => set('fat', v)} unit="g" />
        </View>
      </View>
      {extended ? (
        <>
          <AppText variant="caption" tone="muted">
            Optional targets
          </AppText>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <NumberField
                label="Fiber"
                value={value.fiber}
                onChange={(v) => set('fiber', v)}
                unit="g"
              />
            </View>
            <View style={{ flex: 1 }}>
              <NumberField
                label="Sugar"
                value={value.sugar}
                onChange={(v) => set('sugar', v)}
                unit="g"
              />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <NumberField
                label="Sodium"
                value={value.sodium}
                onChange={(v) => set('sodium', v)}
                unit="mg"
              />
            </View>
            <View style={{ flex: 1 }}>
              <NumberField
                label="Cholesterol"
                value={value.cholesterol}
                onChange={(v) => set('cholesterol', v)}
                unit="mg"
              />
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}
