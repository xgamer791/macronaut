import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { View } from 'react-native';
import { Nutrition } from '@/domain/types';
import { ServingUnit } from '@/domain/serving';
import { useRepos } from '@/state/AppProvider';
import { goBackOrHome } from '@/utils/navigation';
import {
  AppText,
  Button,
  Card,
  Chip,
  NumberField,
  Screen,
  TargetEditor,
  TextField,
} from '@/ui/components';
import { spacing } from '@/ui/theme/tokens';

const UNIT_CHOICES: ServingUnit[] = ['serving', 'g', 'ml', 'cup', 'piece', 'slice', 'container'];

/** Create or edit a custom food. Pass ?id= to edit, ?barcode= to prefill
 * from an unknown scanned barcode. */
export default function CustomFoodScreen() {
  const { id, barcode: scannedBarcode } = useLocalSearchParams<{ id?: string; barcode?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { food } = useRepos();

  const existing = useQuery({
    queryKey: ['custom-food-edit', id ?? 'new'],
    enabled: !!id,
    queryFn: () => food.getCustomFood(id!),
  });

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState(scannedBarcode ?? '');
  const [imageUrl, setImageUrl] = useState('');
  const [servingQty, setServingQty] = useState<number | undefined>(1);
  const [servingUnit, setServingUnit] = useState<ServingUnit>('serving');
  const [gramsPerServing, setGramsPerServing] = useState<number | undefined>();
  const [nutrition, setNutrition] = useState<Nutrition>({ calories: 0 });
  const [notes, setNotes] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  // Hydrate the form once when editing.
  if (existing.data && !hydrated) {
    const f = existing.data;
    setName(f.name);
    setBrand(f.brand ?? '');
    setBarcode(f.barcode ?? '');
    setImageUrl(f.imageUrl ?? '');
    setServingQty(f.servingQty);
    setServingUnit((UNIT_CHOICES.includes(f.servingUnit as ServingUnit) ? f.servingUnit : 'serving') as ServingUnit);
    setGramsPerServing(f.gramsPerServing);
    setNutrition(f.nutrition);
    setNotes(f.notes ?? '');
    setHydrated(true);
  }

  async function save() {
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        brand: brand.trim() || undefined,
        barcode: barcode.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        servingQty: servingQty ?? 1,
        servingUnit,
        gramsPerServing,
        nutrition,
        notes: notes.trim() || undefined,
        favorite: existing.data?.favorite ?? false,
      };
      if (id) await food.updateCustomFood(id, payload);
      else await food.addCustomFood(payload);
      qc.invalidateQueries({ queryKey: ['custom-foods'] });
      qc.invalidateQueries({ queryKey: ['food-detail'] });
      goBackOrHome(router);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <AppText variant="title" weight="600" display>
        {id ? 'Edit custom food' : 'New custom food'}
      </AppText>

      <TextField
        label="Name"
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (t.trim()) setNameError(undefined);
        }}
        placeholder="Overnight oats"
        error={nameError}
        required
      />
      <TextField label="Brand (optional)" value={brand} onChangeText={setBrand} placeholder="Homemade" />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Barcode (optional)"
            value={barcode}
            onChangeText={setBarcode}
            placeholder="0123456789012"
            keyboardType="number-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Image URL (optional)"
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="https://…"
            autoCapitalize="none"
          />
        </View>
      </View>

      <Card style={{ gap: spacing.md }}>
        <AppText variant="body" weight="600">
          Serving
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <NumberField label="Amount" value={servingQty} onChange={setServingQty} min={0.01} />
          </View>
          <View style={{ flex: 2 }}>
            <AppText variant="caption" tone="secondary" style={{ marginBottom: spacing.xs }}>
              Unit
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {UNIT_CHOICES.map((u) => (
                <Chip key={u} label={u} selected={servingUnit === u} onPress={() => setServingUnit(u)} />
              ))}
            </View>
          </View>
        </View>
        <NumberField
          label="Grams per serving (enables weight and volume portions)"
          value={gramsPerServing}
          onChange={setGramsPerServing}
          unit="g"
          min={0.1}
        />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <AppText variant="body" weight="600">
          Nutrition per serving
        </AppText>
        <TargetEditor value={nutrition} onChange={setNutrition} />
      </Card>

      <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />

      <Button title={id ? 'Save changes' : 'Create food'} onPress={save} loading={saving} />
      {id ? (
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button
            title="Duplicate"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={async () => {
              await food.duplicateCustomFood(id);
              qc.invalidateQueries({ queryKey: ['custom-foods'] });
              goBackOrHome(router);
            }}
          />
          <Button
            title="Delete"
            variant="danger"
            style={{ flex: 1 }}
            onPress={async () => {
              await food.deleteCustomFood(id);
              qc.invalidateQueries({ queryKey: ['custom-foods'] });
              goBackOrHome(router);
            }}
          />
        </View>
      ) : null}
      <Button title="Cancel" variant="ghost" onPress={() => goBackOrHome(router)} />
    </Screen>
  );
}
