---
name: prodesign
description: >
  Strict third-agent visual QA for layout, position, and alignment.
  Use only when the user invokes /prodesign or explicitly asks for a pro design check.
disable-model-invocation: true
---

# Pro Design (`/prodesign`)

Strict visual QA modeled on the Macronaut “third agent” pass: layout, position, **and alignment**. Content/copy matching is out of scope unless the user asks.

## Goal
Decide whether the current UI is a **MATCH** or **NO MATCH** against the intended design/reference for spacing, structure, element placement, and alignment.

## When Invoked
1. Identify the **target UI** (screen/component the user is reviewing).
2. Identify the **reference** (screenshot, mock, described layout, or prior approved state). If missing, ask once — then proceed with best available evidence.
3. Run the checklist below on the live implementation (code + screenshots/artifacts when available).
4. Optionally launch a fresh subagent for an independent second opinion on the same evidence; reconcile disagreements conservatively (prefer **NO MATCH** if uncertain).

## Checklist (all must pass for MATCH)

### Layout
- [ ] Section order matches the reference (header → content blocks → footer/actions)
- [ ] Card/list structure matches (columns, carousels, tabs, hero, meta rows)
- [ ] Relative sizing feels consistent (image vs text blocks, card proportions)
- [ ] No accidental leftover chrome from older layouts

### Position
- [ ] Key elements sit in the correct region (e.g. meta top-left, actions top-right, CTAs bottom)
- [ ] Overlays/back buttons/fabs are anchored as designed (safe-area aware)
- [ ] Empty states / dividers / pills appear where expected

### Alignment (required — this is the strict third-agent bar)
- [ ] Shared baselines: text rows and icon rows share a common vertical center where intended
- [ ] Leading edges align across stacked items (titles, body, meta) unless design deliberately indents
- [ ] Trailing edges / right-side actions align consistently across cards or rows
- [ ] Icon groups use equal hit boxes and optical center alignment (not just flex defaults)
- [ ] Columns in grids/carousels share equal card heights or intentionally pinned footers
- [ ] Spacing rhythm is even (no 1-off gaps, no cramped pairs next to loose pairs)
- [ ] Dividers and rules span/align with content padding, not floating short/long

## Method
1. Read the relevant screen/component source and theme tokens.
2. Prefer visual evidence: screenshots in `/opt/cursor/artifacts`, browser captures, or user-provided images.
3. For icon/text rows, verify equal-height containers + `alignItems: 'center'` (or equivalent) and call out optical drift from glyph bounds.
4. For card grids/carousels, verify footer pinning / minHeights if footers must line up.
5. Note only **material** issues (visible misalignment or structural drift). Ignore pure copy/image content differences unless requested.

## Output Format
Return a short report:

```markdown
## Pro Design Result: MATCH | NO MATCH

### Scope
- Target: …
- Reference: …

### Findings
- Layout: PASS | FAIL — …
- Position: PASS | FAIL — …
- Alignment: PASS | FAIL — …

### Must-fix (if NO MATCH)
1. …
2. …

### Notes
- …
```

**Verdict rule:** any FAIL in Layout, Position, or Alignment ⇒ **NO MATCH**.

## Do Not
- Rubber-stamp MATCH without checking alignment explicitly
- Fail on brand/content differences when the user asked for layout-only comparison
- Rewrite large features unless the user asks to implement the fixes after the report
