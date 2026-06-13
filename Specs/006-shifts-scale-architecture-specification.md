# Specification: Skalierung der Tabelle `shifts`

**Version:** 1.1  
**Status:** Freigegeben zur schrittweisen Implementierung  
**Scope:** `packages/database` · `apps/web` · `apps/mobile` · Supabase (Postgres)  
**Auslöser:** Viele Organisationen × lange Historie → sehr große `shifts`-Tabelle; Latenz, Traffic und Kosten kontrollieren.

---

## 1. Ziel

Die App soll bei **tausenden Organisationen** und **Jahren Schichthistorie** pro Mandant performant bleiben, ohne dass einzelne Dashboard-Aufrufe die Gesamttabellengröße spüren.

**Leitprinzip:** Jeder produktive Lesezugriff ist **mandanten- und zeitfensterbegrenzt**. Größe und Kosten werden über **Indizes, Caching, Archivierung und (später) Partitionierung** gesteuert — nicht über „alles in einer Tabelle forever“.

**Nicht-Ziele (dieses Dokument):**

- Multi-Region / Sharding pro Organisation
- Echtzeit-Sync (Realtime) für Schichten
- Vollständiges Data-Warehouse / BI-Stack
- **UI-Zugriff auf archivierte Schichten** (siehe §3)

---

## 2. Ist-Zustand (Referenz)

| Pfad | Query | Filter |
|------|--------|--------|
| Dashboard / Planung | `listDashboardShifts(orgId, from, to, locationId)` | org + location + 7 Tage |
| Mobile „Meine Schichten“ | `listMyShifts(from, to)` | RLS `employee_id = auth.uid()` + Datumsrange |
| Zuweisen / Bulk | `listShiftsForEmployeeDate`, `listShiftsForEmployeeOnDates` | employee + 1–N Tage |
| Abwesenheiten | `countShiftsConflictingWithAbsenceRanges` | org + employee_ids + Datumsrange |

**Bestehende Indizes** (`schema.sql`):

- `(organization_id, shift_date)` — `shifts_org_date_idx`
- `(employee_id, shift_date)` — `shifts_employee_date_idx`
- `(location_id)` — `shifts_location_id_idx` (allein, ohne Datum)

**Caching heute:** Nach Schreibzugriffen `revalidatePath('/dashboard')` und `revalidatePath('/planung')` in `apps/web/src/app/actions/shifts.ts` — **kein** explizites Daten-Cache-Layer.

---

## 3. Entscheidungsübersicht (freigegeben)

| Bereich | Entscheidung |
|---------|--------------|
| Hot-Daten | Tabelle `shifts` — **13 Monate** ab `shift_date` (operative Planung) |
| Archiv-Daten | Tabelle `shifts_archive` — **Monat 14 bis 25** ab `shift_date` (12 Monate im Archiv) |
| Endgültige Löschung | Schichten mit `shift_date` **älter als 25 Monate** werden aus `shifts_archive` **gelöscht** |
| UI-Zugriff Archiv | **Option A — kein UI-Zugriff.** Web, Mobile und öffentliche APIs lesen **nie** `shifts_archive` |
| Archiv-Zweck | Compliance-Aufbewahrung, Support, manuelle Service-Role-Exports — **nicht** für Endnutzer sichtbar |
| Dashboard / Planung / Mobile | Nur `shifts`; max. **13 Monate** zurück navigierbar / abfragbar |
| Berichte / Export (App) | **Out of scope** für Archiv — keine UNION-Queries in der App-Oberfläche |
| Pending Swaps vor Archiv | **Auto-cancel** (`status = 'cancelled'`) für betroffene `swap_requests` |
| Primär-Index Dashboard | `(organization_id, location_id, shift_date)` |
| App-Cache Phase 2 | Next.js `unstable_cache` + Tags; Invalidierung bei Shift-Writes |
| Archiv-/Purge-Jobs | Nächtlich (pg_cron oder Supabase Edge Function + service role) |
| Partitionierung | Phase 3 — monatliche Range-Partition auf `shift_date`, erst ab Bedarf |

### 3.1 Daten-Lebenszyklus (Zeitachse)

```
shift_date
    │
    ├─ [Heute − 13 Monate … Heute]     → shifts (Hot, planbar)
    ├─ [Heute − 25 Monate … − 13 Mon.) → shifts_archive (Cold, kein UI)
    └─ [älter als 25 Monate]           → endgültig gelöscht
```

**Env-Variablen:**

| Variable | Wert |
|----------|------|
| `SHIFTS_HOT_RETENTION_MONTHS` | `13` |
| `SHIFTS_TOTAL_RETENTION_MONTHS` | `25` |

**Cutoffs (täglich berechnet):**

- `hot_cutoff = current_date - 13 months` — archivieren wenn `shift_date < hot_cutoff`
- `purge_cutoff = current_date - 25 months` — löschen aus Archiv wenn `shift_date < purge_cutoff`

---

## 4. Architektur (Phasen)

```mermaid
flowchart TB
  subgraph ui [App UI — nur Hot]
    dash[Dashboard / Planung]
    mobile[Mobile Meine Schichten]
    assign[Shift Assign / Bulk]
  end
  subgraph db_hot [(shifts max 13 Monate)]
    idx["Index org + location + date"]
  end
  subgraph cache [Phase 2 Cache]
    rsc["unstable_cache Tag shifts:org:loc:week"]
  end
  subgraph db_cold [(shifts_archive Monat 14–25)]
  end
  subgraph internal [Nur Service-Role]
    support[Support / Compliance-Export]
  end
  subgraph jobs [Nightly Jobs]
    arch[Archivierung Hot → Cold]
    purge[Purge älter als 25 Monate]
  end

  dash --> cache --> db_hot
  mobile --> db_hot
  assign --> db_hot
  assign -->|revalidateTag| cache
  support -.-> db_cold
  arch --> db_hot
  arch --> db_cold
  purge --> db_cold
```

**Wichtig:** Gestrichelte Linie = kein produktiver App-Pfad; Support nur manuell mit Service-Role.

---

## 5. Phase 1 — Query-Vertrag & Index (sofort, geringes Risiko)

### 5.1 Query-Vertrag (verbindlich für neue Code-Pfade)

Jede neue Abfrage auf Schichten **MUSS** mindestens eines enthalten:

1. `organization_id = :orgId` **und** `shift_date` zwischen `:from` und `:to` (max. **93 Tage** / ~13 Wochen für UI; Bulk-Kontext max. **14 Tage**; **`from` nicht älter als 13 Monate**), **oder**
2. `employee_id = :employeeId` **und** `shift_date` in begrenzter Liste / Range (max. **31 Tage**; **`from` nicht älter als 13 Monate**), **oder**
3. `id = :shiftId` **und** `organization_id = :orgId` (Einzelabruf).

**Verboten:**

- `SELECT` ohne Datumsfilter auf `shifts`
- Datumsranges > 1 Jahr ohne Pagination
- Cross-Org-Queries
- **Jeglicher Client-Zugriff auf `shifts_archive`** (kein Repository-Methode in App-Code)

**Review-Checkliste** bei PRs, die `from('shifts')` oder `shifts_archive` berühren.

### 5.2 UI-Grenzen (Option A)

| Oberfläche | Regel |
|------------|--------|
| Dashboard / Planung Wochennavigation | Keine Woche mit `weekStart < hot_cutoff` |
| Mobile Schichtenliste | `fromDate >= hot_cutoff` erzwingen |
| Bulk-Modal | Nur Schichten innerhalb Hot-Fenster |
| Fehlermeldung (optional) | Hinweis: „Planung nur für die letzten 13 Monate verfügbar“ |

Implementierung: Server-seitig clampen (nicht nur UI disable), damit URL-Parameter nicht umgangen werden können.

### 5.3 Migration: zusammengesetzter Dashboard-Index

**Datei:** `packages/database/migrations/YYYYMMDD_shifts_org_location_date_idx.sql`

```sql
create index concurrently if not exists shifts_org_location_date_idx
  on public.shifts (organization_id, location_id, shift_date);
```

### 5.4 Optimierung: Konflikt-Count in SQL

`countShiftsConflictingWithAbsenceRanges` → Postgres-`count(*)` statt JS-Zählen (Phase 1b).

### 5.5 Monitoring

- Supabase Dashboard: Slow Queries (> 200 ms)
- `EXPLAIN (ANALYZE, BUFFERS)` auf Dashboard- und Employee-Day-Queries
- Erwartung: **Index Scan** auf `shifts_org_location_date_idx` bzw. `shifts_employee_date_idx`

### 5.6 Akzeptanz Phase 1

- [ ] Migration deployed
- [ ] `listDashboardShifts` nutzt Index Scan (EXPLAIN dokumentiert)
- [ ] Kein neuer Shift-Query ohne Datumsfilter
- [ ] Wochennavigation auf 13 Monate begrenzt (Server-Clamp)
- [ ] Konflikt-Count optional in SQL (1b)

---

## 6. Phase 2 — Archiv, Purge & Cache

### 6.1 Tabelle `shifts_archive`

**Datei:** `packages/database/migrations/YYYYMMDD_shifts_archive.sql`

Gleiches Felder-Schema wie `shifts` plus `archived_at timestamptz not null default now()`.

Indizes:

- `(organization_id, shift_date)`
- `(organization_id, location_id, shift_date)`
- `(employee_id, shift_date)`

**RLS:** Keine SELECT-Policy für `authenticated` / Manager — Tabelle ist **nicht über Supabase-Client für App-Nutzer lesbar**. Zugriff ausschließlich **service role** (Jobs, manueller Support).

Alternativ (falls RLS-Linter): restriktive Policy `using (false)` für alle Client-Rollen.

**Kein** Eintrag in `SchichtwerkDatabase`-Interface für App-Code — Archiv bleibt außerhalb des typisierten DB-Adapters der Web/Mobile-Apps.

### 6.2 Job 1: Archivierung (Hot → Cold)

**Zeitplan:** täglich 03:00 UTC  
**Cutoff:** `shift_date < hot_cutoff` (`hot_cutoff = today - 13 months`)

**Ablauf pro Batch (z. B. 5 000 Zeilen):**

1. **Pending Swaps auto-cancel:**

```sql
update public.swap_requests sr
set status = 'cancelled'
from public.shifts s
where sr.shift_id = s.id
  and sr.status = 'pending'
  and s.shift_date < $hot_cutoff;
```

2. **Verschieben** (Insert + Delete in Transaktion):

```sql
with batch as (
  select id from public.shifts
  where shift_date < $hot_cutoff
  order by shift_date
  limit 5000
  for update skip locked
)
insert into public.shifts_archive (...)
select ... from public.shifts s
inner join batch b on b.id = s.id
on conflict (id) do nothing;

delete from public.shifts s
using batch b
where s.id = b.id;
```

**Metriken:** `archived_count`, `cancelled_swap_count`, `duration_ms` → Log / optional `shift_archive_runs`

**Implementierung:**

- `packages/database/scripts/archive-shifts.sql`
- pg_cron oder Edge Function `archive-shifts` (service role)

### 6.3 Job 2: Purge (Cold → gelöscht)

**Zeitplan:** täglich 04:00 UTC (nach Archiv-Job)  
**Cutoff:** `shift_date < purge_cutoff` (`purge_cutoff = today - 25 months`)

```sql
delete from public.shifts_archive
where shift_date < $purge_cutoff
  and id in (
    select id from public.shifts_archive
    where shift_date < $purge_cutoff
    limit 5000
    for update skip locked
  );
```

Batchweise bis leer. **Kein UI-Hinweis** — Daten sind für Nutzer ohnehin unsichtbar.

**Metriken:** `purged_count`, `duration_ms`

### 6.4 Swap Auto-Cancel — Verhalten

| Vorher | Nachher |
|--------|---------|
| `swap_requests.status = 'pending'` auf archivierter Schicht | `status = 'cancelled'` |
| Benachrichtigung an Requester | **Out of scope Phase 2** — optional später |
| Archivierung | Läuft unmittelbar nach Cancel weiter (kein Skip) |

### 6.5 Next.js Cache-Layer

Unverändert gegenüber v1.0 — nur Hot-Daten:

**Datei:** `apps/web/src/lib/cached-dashboard-shifts.ts`

- Tag: `shifts:{orgId}:{locationId}:{weekStart}`
- TTL-Fallback: 120 s
- Invalidierung in `revalidateShiftPaths()` bei Writes (+ Nachbarwoche bei Overnight)

`dashboard/page.tsx` und `planung/page.tsx` → `getCachedDashboardShifts`.

### 6.6 Cache-Key-Referenz

| Key / Tag | Inhalt | Invalidierung |
|-----------|--------|---------------|
| `shifts:{orgId}:{locationId}:{weekStart}` | Dashboard-Zeilen eine Woche (Hot) | Shift create/update/delete |
| `revalidatePath('/dashboard')` | RSC Page Cache | Fallback |

### 6.7 Akzeptanz Phase 2

- [ ] `shifts_archive` deployed (service-role only)
- [ ] Archiv-Job: Schichten ab Monat 14 nur noch in Archiv
- [ ] Purge-Job: Schichten älter 25 Monate weg
- [ ] Pending Swaps werden vor Archiv cancelled
- [ ] Keine App-Route liest `shifts_archive`
- [ ] Dashboard/Mobile clamp auf 13 Monate
- [ ] Cache + Tag-Invalidierung aktiv

---

## 7. Phase 3 — Partitionierung (bei sehr großer Hot-Tabelle)

Erst sinnvoll wenn **auch nach Archivierung** `shifts` global > ~50–100 Mio. Zeilen oder Wartung Probleme macht.

Monatliche Range-Partition auf `shift_date`; Hot-Fenster = 13 Monate (+ Puffer-Partitionen).

Details unverändert zu v1.0 §7.

---

## 8. Kosten- & Traffic-Leitplanken

| Metrik | Ziel |
|--------|------|
| Dashboard DB-Query | p95 < 50 ms (ohne Cache), < 10 ms (Cache-Hit) |
| Zeilen pro Dashboard-Query | typ. < 500 |
| Hot-Tabelle | max. ~13 Monate × alle Orgs (begrenztes Wachstum) |
| Archiv-Tabelle | rollierend ~12 Monate × alle Orgs |
| Storage nach Purge | plateau bei 25 Monaten Gesamtretention pro Schicht |

**Kein Read Replica nötig** solange Option A gilt (Archiv nicht im App-Read-Path).

---

## 9. Implementierungs-Reihenfolge

| # | Task | Phase | Aufwand |
|---|------|-------|---------|
| 1 | Migration `shifts_org_location_date_idx` | 1 | S |
| 2 | Query-Vertrag + 13-Monats-Clamp (Dashboard, Mobile, Planung) | 1 | S |
| 3 | `countShiftsConflictingWithAbsenceRanges` → SQL COUNT | 1b | S |
| 4 | `shifts_archive` (service-role only) | 2 | M |
| 5 | Archiv-Job + Swap auto-cancel | 2 | M |
| 6 | Purge-Job (25 Monate) | 2 | S |
| 7 | `getCachedDashboardShifts` + Tag-Invalidierung | 2 | M |
| 8 | Partitionierung | 3 | L |

**Entfernt gegenüber v1.0:** `listArchivedShifts`, `listShiftsForReporting`, Berichte-UI, pro-Org-Retention-Override.

**S** = Stunden · **M** = 1–2 Tage · **L** = mehrere Tage

---

## 10. Testplan

### 10.1 Index & Clamp

- Dashboard-URL mit `week` älter 13 Monate → Redirect/Clamp auf älteste erlaubte Woche
- Mobile `from` älter 13 Monate → auf `hot_cutoff` gesetzt

### 10.2 Archiv

- Schicht `shift_date = today - 14 months` → nach Job in `shifts_archive`, nicht in `shifts`
- Dashboard listet sie **nicht**
- Supabase Client (authenticated Manager) → **kein** SELECT auf `shifts_archive`

### 10.3 Purge

- Schicht `shift_date = today - 26 months` im Archiv → nach Purge-Job gelöscht

### 10.4 Swap Auto-Cancel

- Pending Swap auf Schicht mit `shift_date < hot_cutoff` → `cancelled`, Schicht archiviert

### 10.5 Cache & Regression

- Bulk-Save, Undo, Overnight-Schichten (Nachbarwoche-Tag)
- Mobile `listMyShifts` nur Hot-Fenster

---

## 11. Produktentscheidungen (Historie)

| # | Frage | Entscheidung | Version |
|---|--------|--------------|---------|
| 1 | Hot-Retention | **13 Monate** | 1.1 |
| 2 | Gesamt-Retention | **25 Monate**, danach Löschung | 1.1 |
| 3 | UI-Zugriff Archiv | **Option A** — kein UI, nur Backend/Service-Role | 1.1 |
| 4 | Pending Swaps | **Auto-cancel** vor Archivierung | 1.1 |

---

## 12. Referenzen im Repo

| Datei | Rolle |
|-------|--------|
| `packages/database/schema.sql` | Tabellen- & Index-Definition |
| `packages/database/src/supabase-database.ts` | `listDashboardShifts`, `listMyShifts`, … |
| `apps/web/src/app/(manager)/dashboard/page.tsx` | Wochen-Load |
| `apps/web/src/app/actions/shifts.ts` | Writes + `revalidateShiftPaths` |
| `.cursor/rules/cursorrules.mdc` | RSC / `unstable_cache` Richtlinie |

---

**Ende der Specification v1.1**
