# Specification: Profil-Wünsche (flexible Schichtwünsche)

**Version:** 1.0  
**Status:** Freigegeben zur Implementierung (Phase A)  
**Scope:** Web-App (`apps/web`) · `packages/database` · `packages/types` · `packages/i18n`  
**Erweitert:** `005-bulk-shift-column-controls-specification.md` (Wunsch-Priorisierung im Bulk-Modal)

---

## 1. Ziel

**Wunschzeiten** werden in der UI zu **Wünsche** umbenannt. Mitarbeiter-Wünsche dürfen **partielle Präferenzen** sein — nicht jede Dimension (Zeit, Standort, Bereich, Tätigkeit) muss gesetzt sein.

Wünsche sind **weiche Constraints** bei der Schichtzuweisung: Sie **priorisieren** eligible Mitarbeiter, blockieren aber nie die Zuweisung. Harte Gates (Verfügbarkeit, Abwesenheit, Qualifikation, Compliance) bleiben unverändert.

---

## 2. Entscheidungsübersicht

| Bereich | Entscheidung |
|---------|--------------|
| UI-Name | **Wünsche** (DE) / **Preferences** (EN) — ersetzt „Wunschzeiten“ / „Preferred shifts“ |
| Datenmodell | Tabelle `profile_shift_preferences` bleibt; `weekday`, `start_time`, `end_time` werden **nullable** |
| Mindestinhalt | Mindestens **eine Dimension** muss gesetzt sein |
| Zeit-Dimension | Wochentag + Von + Bis sind ** gekoppelt** — entweder alle drei oder keines |
| Verfügbarkeit | Zeitwünsche müssen weiterhin **vollständig innerhalb** einer Verfügbarkeit liegen |
| Placement-only | Wünsche nur mit Standort/Bereich/Tätigkeit **ohne** Verfügbarkeits-Check |
| Wochentag null | Placement-only-Wünsche gelten **an jedem Wochentag** |
| Matching | Alle **gesetzten** Felder eines Wunsches müssen zur Schicht passieren (AND) |
| Priorität | Höchster Wunsch-Score gewinnt; danach längste Pause, alphabetisch (wie Spec 005) |
| Override | Zuweisung auch bei Score 0 erlaubt; UI-Hinweis wenn MA Wünsche hat, aber keiner passt |
| Duplikate | Gleicher Wunsch = gleiche gesetzte Dimensionen (Zeit-Triple oder placement-only) |
| Phase A | Rename, Migration, flexibles Formular, erweitertes Matching, Override-Hinweis Web |
| Phase B (später) | Mobile-CRUD für partielle Wünsche, „Vermeiden“-Wünsche, erweiterte Panel-Sortierung |

---

## 3. Datenmodell

### 3.1 Migration

**Datei:** `packages/database/migrations/20260619_profile_shift_preferences_flexible_wishes.sql`

```sql
-- weekday/start_time/end_time nullable; mindestens eine Dimension
alter table public.profile_shift_preferences
  alter column weekday drop not null,
  alter column start_time drop not null,
  alter column end_time drop not null;

alter table public.profile_shift_preferences
  drop constraint if exists profile_shift_preferences_time_check;

alter table public.profile_shift_preferences
  add constraint profile_shift_preferences_time_pair_check check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and start_time <> end_time)
  );

alter table public.profile_shift_preferences
  add constraint profile_shift_preferences_weekday_time_check check (
    (weekday is null) = (start_time is null and end_time is null)
  );

alter table public.profile_shift_preferences
  add constraint profile_shift_preferences_dimension_check check (
    (weekday is not null and start_time is not null and end_time is not null)
    or location_id is not null
    or location_area_id is not null
    or qualification_id is not null
  );
```

Bestehende Zeilen (immer mit Zeit) bleiben gültig.

### 3.2 TypeScript

```typescript
export interface ProfileShiftPreference {
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
  // location_id, location_area_id, qualification_id unverändert optional
}
```

### 3.3 Laden für Zuweisung

`listOrganizationShiftPreferences(orgId, weekday)` liefert:

- Wünsche mit `weekday = weekday`
- **plus** Wünsche mit `weekday IS NULL` (placement-only, gilt täglich)

---

## 4. Validierung (Server)

| Regel | Fehler |
|-------|--------|
| Keine Dimension gesetzt | „Bitte mindestens eine Dimension angeben.“ |
| Nur Wochentag oder nur eine Uhrzeit | „Zeitwunsch erfordert Wochentag, Von und Bis.“ |
| Ungültiges Zeitfenster | wie Verfügbarkeit |
| Zeitwunsch außerhalb Verfügbarkeit | wie bisher |
| Duplikat | wie bisher (erweitert um placement-only) |

---

## 5. Matching-Algorithmus

### 5.1 Kontext pro Schichtzeile

```typescript
type ShiftWishMatchContext = {
  weekday: number;
  demandStart: string;
  demandEnd: string;
  areaId: string;
  locationId: string | null;
  qualificationId: string | null;
};
```

### 5.2 Wunsch passt (AND über gesetzte Felder)

| Feld gesetzt | Bedingung |
|--------------|-----------|
| `weekday` | `weekday === context.weekday` |
| `start_time` + `end_time` | Overlap mit Schichtfenster > 0 Minuten |
| `location_id` | `location_id === context.locationId` |
| `location_area_id` | `location_area_id === context.areaId` |
| `qualification_id` | `qualification_id === context.qualificationId` |

`weekday IS NULL` → kein Wochentagsfilter (placement-only oder kombiniert).

### 5.3 Score

Pro passendem Wunsch:

- Zeit-Overlap: `overlapMinutes × 100 + priority` (wie Spec 005)
- Bereich: `+1000`
- Standort: `+500`
- Tätigkeit: `+300`

Bestes passendes Wunsch-Score pro MA; höchster gewinnt.

### 5.4 Override-Hinweis

```typescript
wishFulfilled =
  !employeeHasApplicableWishes(employeeId, context, preferences)
  || employeeWishScore(employeeId, context, preferences) > 0
```

Wenn `wishFulfilled === false`: dezenter Hinweis unter Personal-Auswahl (Bulk + Einzelschicht).

---

## 6. UI

### 6.1 Umbenennung (i18n)

| Key | DE (neu) | EN (neu) |
|-----|----------|----------|
| `panelShiftPreferences` | Wünsche | Preferences |
| `shiftPreferenceCreateTitle` | Wunsch anlegen | Add preference |
| `emptyShiftPreferences` | Keine Wünsche hinterlegt. | No preferences saved. |

(Vollständige Keys siehe Implementierung in `packages/i18n`.)

### 6.2 Formular

Dimension-Toggles (Chips): **Zeit**, **Standort**, **Bereich**, **Tätigkeit**

- Mindestens ein Toggle aktiv mit ausgefülltem Wert
- Zeit aus → Wochentag/Von/Bis ausgeblendet; ein Datensatz ohne Zeit
- Zeit an → Wochentag + Von/Bis Pflicht; bei Anlegen weiterhin Mehrfach-Wochentage → mehrere Zeilen
- Standort/Bereich/Tätigkeit optional kombinierbar

### 6.3 Panel-Liste

| Spalte | Ohne Zeit |
|--------|-----------|
| Wochentag | „—“ oder „Jeder Tag“ wenn placement-only |
| Zeitfenster | „—“ |

Nicht-konforme **Zeit**wünsche (Verfügbarkeit) weiterhin warnen.

---

## 7. Betroffene Module

| Modul | Änderung |
|-------|----------|
| `profile-shift-preference-validation.ts` | Duplikate, Dimension-Check |
| `profile-shift-preference-matching.ts` | Score + `pickEmployeeForBulkPrefill` |
| `profile-shift-preferences.ts` (actions) | Flexibles Speichern |
| `profile-shift-preferences-form-modal.tsx` | Dimension-Toggles |
| `bulk-shift-row-prefill.ts` | Matching-Kontext |
| `areacalendar-*-modal.tsx` | Override-Hinweis |

---

## 8. Testplan

- [ ] Migration auf DB mit bestehenden Zeitwünschen
- [ ] Anlegen: nur Bereich, nur Tätigkeit, Zeit+Bereich
- [ ] Validierung: leeres Formular, nur Wochentag ohne Zeit
- [ ] Bulk-Vorbestückung: Bereichswunsch priorisiert passenden MA
- [ ] Override-Hinweis wenn Wunsch nicht erfüllt
- [ ] Panel zeigt „—“ für fehlende Zeitdimension
- [ ] Duplikat-Erkennung placement-only

---

## 9. Phasen

### Phase A (dieses Release)

- Spec + Migration + Types
- Server-Validierung + flexibles Formular
- Erweitertes Matching + Override-Hinweis Web
- i18n Rename

### Phase B ( später )

- Mobile App: partielle Wünsche
- Negative Wünsche („Vermeiden“)
- Erweiterte Sortierung im Panel (placement-first)
