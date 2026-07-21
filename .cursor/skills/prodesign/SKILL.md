---
name: prodesign
description: >
  Two-stage visual QA (second agent then third agent) for design work.
  Use only when the user invokes /prodesign or explicitly asks for a pro design check.
disable-model-invocation: true
---

# Pro Design (`/prodesign`)

Gate every design task behind **second agent → third agent** approval.
The working agent must **not** treat the task as complete until the **third agent** returns **APPROVE**.

## Working agent (orchestrator)

1. Implement / revise the design as requested.
2. Detect whether a **reference image** exists:
   - User-attached screenshot or mockup in the current turn
   - Reference image earlier in the same chat
   - Saved visual artifacts clearly intended as the reference
3. Choose Mode A or Mode B below.
4. Launch the **second agent** as a fresh subagent with the exact brief for that mode.
5. If second agent returns **REJECT**: fix the issues, then re-run second agent. Do not advance.
6. Only after second agent returns **APPROVE**: launch the **third agent** as a fresh subagent.
7. If third agent returns **REJECT**: fix the issues, then re-run **from the second agent** again (second must re-approve before third runs).
8. Task is **complete only when third agent returns APPROVE**.

### Hard rules
- Never skip second or third agent.
- Never mark the task complete on second-agent approval alone.
- Never let the working agent “self-approve” in place of either agent.
- Prefer **REJECT** when uncertain.
- Ignore pure content/copy differences unless the user asked for those too (layout/visual fidelity is the default bar).

---

## Mode A — Reference image attached or found in chat

Used when copying a design from a screenshot/mockup.

### Second agent — identicality vs reference
**Job:** Compare the working agent’s design to the reference image and decide if they are visually identical in structure and appearance.

Check:
- Same overall layout and section order
- Same placement of major elements (hero, titles, meta, actions, cards, tabs, footers)
- Same relative proportions and hierarchy
- No missing/extra chrome vs the reference
- Content/branding may differ only if the user said layout-only; otherwise flag material visual differences

**Output (required):**
```markdown
## Second Agent (Reference Compare): APPROVE | REJECT
### Reference
- …
### Compared against
- …
### Differences
- … (empty if none)
### Verdict
APPROVE only if design and reference are visually identical for the requested scope.
```

### Third agent — spacing & alignment vs reference
Runs **only after** second agent APPROVE.

**Job:** Scrutinize spacing and alignment of the implementation against the reference image.

Check:
- Margins/padding rhythm matches the reference
- Vertical/horizontal alignment of text, icons, and rows
- Equal card heights / pinned footers where the reference shows them
- Icon groups optically centered and level
- Gaps consistent with the reference (no cramped or uneven pairs)
- Edges and dividers line up with content padding as in the reference

**Output (required):**
```markdown
## Third Agent (Spacing & Alignment vs Reference): APPROVE | REJECT
### Spacing
PASS | FAIL — …
### Alignment
PASS | FAIL — …
### Must-fix (if REJECT)
1. …
### Verdict
APPROVE only if spacing and alignment match the reference.
```

---

## Mode B — No reference image

Used when designing from scratch (no mockup/screenshot in the request or chat).

### Second agent — consistency pass
**Job:** Check the design for inconsistent spacing and alignment issues (no external reference).

Check:
- Uneven gaps / inconsistent padding scale
- Misaligned leading/trailing edges across stacked items
- Icon/text rows that don’t share a vertical center
- Cards/rows with uneven heights or floating footers when they should align
- Optical drift, cramped pairs next to loose pairs
- Internal layout contradictions (e.g. mixed alignment rules in one section)

**Output (required):**
```markdown
## Second Agent (Consistency): APPROVE | REJECT
### Issues
- … (empty if none)
### Verdict
APPROVE only if spacing/alignment are internally consistent.
```

### Third agent — harder scrutiny
Runs **only after** second agent APPROVE.

**Job:** Scrutinize harder than the second agent. Assume something was missed.

Check (stricter):
- Pixel-sensitive alignment of icon groups and meta rows
- Baseline consistency across adjacent text styles
- Grid/carousel regularity (widths, gutters, card body alignment)
- Safe-area / edge anchoring for overlays and sticky footers
- Spacing tokens used consistently (no one-off magic numbers that break rhythm)
- Any leftover visual debt from earlier iterations

**Output (required):**
```markdown
## Third Agent (Hard Scrutiny): APPROVE | REJECT
### Findings
- …
### Must-fix (if REJECT)
1. …
### Verdict
APPROVE only if the design holds up under stricter scrutiny.
```

---

## Completion report (working agent)

After third agent APPROVE, publish:

```markdown
## Pro Design: COMPLETE

- Mode: A (reference) | B (no reference)
- Second agent: APPROVE
- Third agent: APPROVE
- Reference used: … | none

### Notes
- …
```

If third agent has not approved, the status must remain:

```markdown
## Pro Design: INCOMPLETE
- Waiting on: Second agent | Third agent
- Last verdict: …
- Open must-fixes: …
```

## Subagent practice
- Use a fresh subagent for second agent and a **different** fresh subagent for third agent.
- Give each subagent only the evidence they need (screenshots/artifacts + target file paths + mode brief).
- Do not tell the third agent that the second already approved in a way that pressures approval; provide the artifacts and checklist only.
