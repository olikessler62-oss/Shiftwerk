# @schichtwerk/database

**Einzige SQL-Quelle (DDL):** [`schema.sql`](./schema.sql)

- Neuinstallation: vollständiges Schema nur aus `schema.sql`.
- Bestehende Datenbank: fehlende Änderungen aus `migrations/` in Reihenfolge ausführen; jede Migration wird parallel in `schema.sql` nachgezogen.
- `scripts/*.sql` sind optionale Reparatur-Hilfen, kein Ersatz für `schema.sql`.

Der gesamte App-Code (Web, Mobile, Scripts) nutzt nur die TypeScript-Schnittstelle `SchichtwerkDatabase` (`src/interface.ts`) — keine direkten Tabellenzugriffe außerhalb des Supabase-Adapters (`src/supabase-database.ts`).

## Datenbankwechsel

1. `schema.sql` für die neue Datenbank anpassen oder übersetzen
2. Neuen Adapter unter `src/adapters/` implementieren (`implements SchichtwerkDatabase`)
3. Factory in `src/index.ts` auf den neuen Adapter umstellen

## Schema anwenden (Supabase)

Dashboard → SQL → Inhalt von `schema.sql` einfügen → Run

**Bereits laufende Datenbank:** nur fehlende Änderungen aus `migrations/` ausführen (Reihenfolge: `20250604` … `20250621_profile_sort_order.sql`).

Fehler *„column locations.archived_at does not exist“*: im SQL Editor `scripts/apply-archive-columns.sql` ausführen (oder `20250608` + `20250609` einzeln).

Fehler *„column profiles.color does not exist“* / *„column profiles.mobile_phone does not exist“*: im SQL Editor `scripts/apply-profile-columns.sql` ausführen (oder `20250614` + `20250615` einzeln).

Weitere Profil-Migrationen (falls noch nicht ausgeführt): `20250611_profile_qualifications.sql`, `20250613_profile_hourly_rates.sql`, `20250616_profile_recurring_availability.sql`, `20250620_profile_availability_overnight.sql`, `20250621_profile_sort_order.sql`, `20250622_current_date_iso.sql`.

Standort-Migrationen: `20250618_location_area_service_hours.sql`, `20250619_location_area_staffing_qualifications.sql`.

**Supabase Security Linter:** `20250617_security_linter_fixes.sql` behebt Warnungen zu `set_updated_at` (search_path) und verschiebt RLS-Helfer (`current_profile`, `is_manager_or_owner`) ins Schema `private` (nicht über `/rest/v1/rpc` aufrufbar).

**Leaked-Password-Schutz:** Supabase Dashboard → **Authentication** → **Providers** → **Email** → *Prevent use of leaked passwords* aktivieren (Have I Been Pwned).

## Nutzung in der Web-App

```ts
import { getDatabase, getAdminDatabase } from "@schichtwerk/database";

const db = await getDatabase();
const types = await db.loadShiftTypesWithBreaks(orgId);
```

## Nutzung in der Mobile-App

```ts
import { getDatabase } from "@/lib/db";

const db = getDatabase();
const profile = await db.getCurrentUserProfile();

// E-Mail (Mitarbeiter, eigene Session): updateCurrentUserProfileEmail
// E-Mail (Manager, fremdes Profil): authAdminUpdateUserEmail via Admin-Client
const shifts = await db.listMyShifts(from, to);
```

Supabase-Verbindung (SecureStore) liegt in `apps/mobile/lib/supabase.ts` — nur Infrastruktur, kein Schema-SQL.

## Schichten — Query-Vertrag & Retention (Spec 006)

**Hot-Fenster:** 13 Kalendermonate (`SHIFTS_HOT_RETENTION_MONTHS` in `src/shift-retention.ts`).

Jede Abfrage auf `public.shifts` im App-Code **muss** mandanten- und zeitbegrenzt sein:

- Dashboard/Planung: `organization_id` + `location_id` + `shift_date` (max. eine Woche)
- Mobile: `employee_id` (via RLS) + `shift_date`-Range
- Einzelabruf: `id` + `organization_id`

**Verboten:** unbegrenzte `SELECT` ohne Datumsfilter; Client-Zugriff auf `shifts_archive` (Phase 2).

Hilfsfunktionen: `clampShiftQueryFromDate`, `resolvePlanningWeekStart`, `earliestPlanningWeekStartISO`.

Migration Phase 1: `migrations/20250706_shifts_hot_retention_phase1.sql` (Index + RPC Konflikt-Count).

**Phase 2 — Archiv (Option A, kein UI-Zugriff):**

- Hot: 13 Monate (`shifts`) · Archiv: Monat 14–25 (`shifts_archive`) · Purge danach
- Migration: `migrations/20250707_shifts_archive_phase2.sql`
- Manuell/SQL: `scripts/archive-shifts.sql`, `scripts/purge-shifts-archive.sql`
- Cron (Service-Role): `npm run retention:shifts --workspace=@schichtwerk/web` (täglich 03:00/04:00 UTC empfohlen)

```
