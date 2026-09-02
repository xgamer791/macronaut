import React from 'react';
import { View } from 'react-native';
import { spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { Card } from './Card';
import { SectionHeader } from './SectionHeader';

export interface LegalSectionProps {
  title: string;
  /** Paragraphs, rendered in order. */
  paragraphs: string[];
  /** Extra content below the prose, e.g. rows of links. */
  children?: React.ReactNode;
}

/** One titled block of a policy page: heading, prose, optional extras. */
export function LegalSection({ title, paragraphs, children }: LegalSectionProps) {
  return (
    <View style={{ gap: spacing.sm }}>
      <SectionHeader title={title} />
      <Card>
        <View style={{ gap: spacing.md }}>
          {paragraphs.map((text) => (
            <AppText key={text} variant="body" tone="secondary">
              {text}
            </AppText>
          ))}
          {children}
        </View>
      </Card>
    </View>
  );
}
