import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { CollectionEditor } from '@/ui/components/CollectionEditor';

export default function MealEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <CollectionEditor kind="meal" id={id} />;
}
