import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_EFFECTIVE_DATE,
  PRIVACY_SECTIONS,
  PRIVACY_TITLE,
  TERMS_SECTIONS,
  TERMS_TITLE,
} from '@/app/legalCopy';

function bodies(sections: { body: string }[]): string {
  return sections.map((s) => s.body).join(' ');
}

describe('public legal copy', () => {
  it('shares a contact address and effective date', () => {
    expect(LEGAL_CONTACT_EMAIL).toBe('chris@mangomarketeers.com');
    expect(LEGAL_EFFECTIVE_DATE).toBe('September 2, 2026');
    expect(bodies(PRIVACY_SECTIONS)).toContain(LEGAL_CONTACT_EMAIL);
    expect(bodies(TERMS_SECTIONS)).toContain(LEGAL_CONTACT_EMAIL);
  });

  it('describes Macronaut as a local-first calorie tracker with optional accounts', () => {
    expect(PRIVACY_TITLE).toBe('Privacy Policy');
    const privacy = bodies(PRIVACY_SECTIONS);
    expect(privacy).toMatch(/calorie and macro tracker/i);
    expect(privacy).toMatch(/Google or email/);
    expect(privacy).toMatch(/Supabase/);
    expect(privacy).toMatch(/local-first/);
    expect(privacy).toMatch(/Cloud sync of diary data is not shipping yet/);
    expect(privacy).toMatch(/email/);
    expect(privacy).toMatch(/Google profile name/);
    expect(privacy).toMatch(/profiles row/);
    expect(privacy).toMatch(/no ads/i);
    expect(privacy).toMatch(/trackers/);
  });

  it('states Macronaut is not advice and food data can be wrong', () => {
    expect(TERMS_TITLE).toBe('Terms of Use');
    const terms = bodies(TERMS_SECTIONS);
    expect(terms).toMatch(/not medical advice/i);
    expect(terms).toMatch(/not nutrition advice/i);
    expect(terms).toMatch(/at your own risk/i);
    expect(terms).toMatch(/Food database data can be wrong/);
    expect(terms).toMatch(/Accounts are optional/);
    expect(terms).toMatch(/Do not abuse the service/);
  });
});
