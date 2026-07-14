import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { CollectionEditor } from '@/ui/components/CollectionEditor';

export default function RecipeEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <CollectionEditor kind="recipe" id={id} />;
}
