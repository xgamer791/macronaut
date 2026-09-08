import fs from 'node:fs';
import path from 'node:path';

const today = fs.readFileSync(path.join(__dirname, '..', '(tabs)', 'index.tsx'), 'utf8');
const mealsSection = today.split('{/* —— Meals —— */}')[1].split('{/* —— Activity')[0];

describe('Today meals section', () => {
  it('keeps the heading focused on the meal strips', () => {
    expect(mealsSection).toContain('<SectionHeader flush title="Meals" />');
    expect(mealsSection).not.toContain('View all');
    expect(mealsSection).not.toContain('Browse curated meals');
  });

  it('uses the same green add glyph as food result rows', () => {
    const addFood = fs.readFileSync(path.join(__dirname, '..', 'add.tsx'), 'utf8');
    const greenAddGlyph = '<Ionicons name="add" size={22} color={colors.accent} />';

    expect(addFood).toContain(greenAddGlyph);
    expect(mealsSection).toContain(greenAddGlyph);
    expect(mealsSection).not.toContain('name="chevron-forward"');
  });

  it('keeps every meal strip clickable', () => {
    expect(mealsSection).toContain("router.push(kcal > 0 ? '/day-detail' : '/add')");
  });
});
