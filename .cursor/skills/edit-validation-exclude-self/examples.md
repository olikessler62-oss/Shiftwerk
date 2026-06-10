# Examples: edit validation exclude-self

## SHIFTWERK — Personalbedarf (fixed)

**Symptom:** Editing staffing sub-modal → “Zeitfenster am selben Tag dürfen sich nicht überlappen” even when no other window conflicts.

**Cause:** `ensureLocationAreaServiceHour` merged `existing + newRow` including the row being replaced (e.g. old 08:00–16:00 vs new 09:00–17:00).

**Fix:**

```typescript
// location-staffing.ts
await db.ensureLocationAreaServiceHour(
  locationAreaId,
  locationId,
  window,
  input.previousServiceHourId
    ? { excludeServiceHourId: input.previousServiceHourId }
    : undefined
);

// supabase-database.ts — overlap only
const comparableExisting = options?.excludeServiceHourId
  ? existing.filter((h) => h.id !== options.excludeServiceHourId)
  : existing;
```

## Generic — unique email per org

```typescript
function validateEmailUnique(
  email: string,
  existingUsers: User[],
  editingUserId?: string
) {
  const others = editingUserId
    ? existingUsers.filter((u) => u.id !== editingUserId)
    : existingUsers;
  if (others.some((u) => u.email === email)) {
    return { ok: false, error: "Email already in use" };
  }
  return { ok: true };
}
```

## Generic — date range overlap (absences)

```typescript
function findOverlappingAbsence(
  absences: Absence[],
  employeeId: string,
  start: string,
  end: string,
  excludeAbsenceId?: string
): Absence | null {
  return (
    absences.find(
      (a) =>
        a.employee_id === employeeId &&
        a.id !== excludeAbsenceId &&
        rangesOverlap(a.start, a.end, start, end)
    ) ?? null
  );
}
```

## Review prompt for PRs

When reviewing save/update code, search for:

- `validate*Input([...existing`
- `merged = [...existing`
- `some((row) => row.id ===` without `!== editingId`

If merge includes full `existing` and the flow supports edit, require exclude-self.
