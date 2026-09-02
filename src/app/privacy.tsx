import React from 'react';
import { LEGAL_EFFECTIVE_DATE, PRIVACY_SECTIONS, PRIVACY_TITLE } from '@/content/legalCopy';
import { LegalDocument } from '@/ui/components/LegalDocument';

export default function PrivacyScreen() {
  return (
    <LegalDocument
      title={PRIVACY_TITLE}
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      sections={PRIVACY_SECTIONS}
    />
  );
}
