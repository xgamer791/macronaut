import React from 'react';
import { LEGAL_EFFECTIVE_DATE, TERMS_SECTIONS, TERMS_TITLE } from '@/app/legalCopy';
import { LegalDocument } from '@/ui/components/LegalDocument';

export default function TermsScreen() {
  return (
    <LegalDocument
      title={TERMS_TITLE}
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      sections={TERMS_SECTIONS}
    />
  );
}
