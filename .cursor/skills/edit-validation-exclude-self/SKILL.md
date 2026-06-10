---
name: edit-validation-exclude-self
description: >-
  Prevents false validation errors when editing existing records. Use when
  implementing or fixing save/update flows, overlap checks, uniqueness
  constraints, duplicate detection, or edit sub-modals — especially if
  validation passes on create but fails on edit without real conflicts.
---

# Edit validation: exclude the record being edited

## Core rule

**Create and edit are not the same validation context.**

When checking overlap, uniqueness, duplicates, or “already exists” constraints during an **update**, **exclude the entity being edited** from the comparison set. Otherwise the old value overlaps or duplicates itself and blocks legitimate saves.

## When to apply

Apply this skill when you touch any of:

- Interval/window overlap (time ranges, date ranges, service hours)
- Unique keys (slug, email, name per scope)
- “Already configured for this X” guards
- Upsert/ensure helpers that merge new input with existing rows
- Server actions with `previousId`, `editMode`, or `initial*Id` parameters

## Implementation checklist

Before merging or finishing an edit-save flow, verify:

- [ ] Validation receives an **edit identity** (`previousId`, `excludeId`, `currentRecordId`, …)
- [ ] The comparison list is filtered: `existing.filter((row) => row.id !== excludeId)`
- [ ] **Exact-match reuse** still searches the full set (including self) so unchanged values resolve to the same row
- [ ] **Conflict checks** (overlap, duplicate, “already taken”) use the filtered set only
- [ ] Create path passes no exclude id; edit path always passes it
- [ ] Client-only validation mirrors server logic (same exclude rule)

## Correct pattern

```typescript
async function ensureWindow(
  row: WindowInput,
  options?: { excludeServiceHourId?: string }
) {
  const existing = await listWindows();

  // Unchanged edit: return same row
  const exactMatch = existing.find((h) => sameWindow(h, row));
  if (exactMatch) return exactMatch;

  // Overlap / conflict: compare against others only
  const others = options?.excludeServiceHourId
    ? existing.filter((h) => h.id !== options.excludeServiceHourId)
    : existing;

  const merged = [...others.map(toInput), row];
  const check = validateNoOverlap(merged);
  if (!check.ok) throw new Error(check.error);

  return insert(row);
}
```

## Anti-patterns

| Wrong | Why it fails on edit |
|-------|----------------------|
| `validate([...existing, newRow])` without exclude | Old row overlaps new row when times shift slightly |
| Same validator for create and edit with no `previousId` | Edit always sees a duplicate of itself |
| Client validates; server omits exclude (or vice versa) | False errors or inconsistent UX |

## SHIFTWERK reference

Personalbedarf / service hours (`ensureLocationAreaServiceHour`):

- Edit save passes `previousServiceHourId` → `{ excludeServiceHourId }`
- Overlap uses `comparableExisting`; exact match uses full `existing`
- Files: `packages/database/src/supabase-database.ts`, `apps/web/src/app/actions/location-staffing.ts`

Same pattern applies elsewhere: absences overlap, availability windows, bulk shift overlap (exclude shift being replaced).

## Tests to add or run mentally

For any edit-save validator, assert:

1. **Edit, no field change** → success (reuse same id)
2. **Edit, change non-conflicting value** → success (exclude self)
3. **Edit, change to value that conflicts with another row** → fail with real error
4. **Create, genuine conflict** → fail
5. **Create, no conflict** → success

## Before marking done

Ask: *“If I only change this record’s times/fields slightly, does my code still compare it against its own old row?”*

If yes → add exclude-self filtering before returning overlap/duplicate errors.
