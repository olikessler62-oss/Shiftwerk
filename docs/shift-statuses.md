# Schicht-Stati in SHIFTWERK

Referenz für Planungs-, Bestätigungs- und Anzeige-Stati von Schichten (Stand: Lifecycle-Migration Sprints 1–3).

Die **UI** (Karten, Tooltips, Schicht-Stati-Modal, Kontextmenüs) leitet den sichtbaren Status über `resolveShiftCardDisplayState` ab und zeigt den **`legacyConfirmationStatus`** an — die sechs bekannten Anzeige-Stati unten. Parallel existieren `lifecycle_status` und `shift_requests` in der Datenbank (Dual-Write-Phase).

---

## 1. Drei Ebenen (Architektur)

| Ebene | Typ (Code) | Werte | Rolle |
|--------|------------|--------|--------|
| **Legacy (DB)** | `ShiftConfirmationStatus` | 6 Werte | Spalte `shifts.confirmation_status` (Dual-Write, Sprint 4: geplant entfernen) |
| **Lifecycle (DB)** | `ShiftLifecycleStatus` | 3 Werte | Spalte `shifts.lifecycle_status` — grobe Planungslage |
| **Anfragen (DB)** | `shift_requests` | Typ + Status | Offene und abgeschlossene Bestätigungs- und Absage-Anfragen |

**Code-Referenzen:**

- Typen: `packages/types/src/index.ts`
- Display-Logik: `packages/database/src/shift-display-state.ts`
- UI-Mapping: `apps/web/src/lib/planning-shift-display-state.ts`

---

## 2. Lifecycle (`ShiftLifecycleStatus`)

| Status | Deutsch | Bedeutung |
|--------|---------|-----------|
| `planned` | Geplant | Schicht eingeplant, noch nicht endgültig bestätigt (oder offene Anfrage) |
| `confirmed` | Bestätigt | Schicht verbindlich bestätigt |
| `cancelled` | Abgesagt | Schicht abgesagt (typisch: MA-Absage) |

### Mapping Legacy → Lifecycle

| `confirmation_status` | `lifecycle_status` |
|-----------------------|-------------------|
| `proposed`, `requested`, `pending`, `rejected` | `planned` |
| `confirmed` | `confirmed` |
| `canceled` | `cancelled` |

---

## 3. Anfragen (`shift_requests`)

### Typ (`ShiftRequestType`)

| Typ | Bedeutung |
|-----|-----------|
| `confirmation` | Bestätigungsanfrage an den Mitarbeiter |
| `cancellation` | Absage der Schicht |

### Status (`ShiftRequestStatus`)

| Status | Deutsch | Bedeutung |
|--------|---------|-----------|
| `pending` | Offen | Bestätigung angefordert, MA hat noch nicht geantwortet |
| `expired` | Abgelaufen | Frist überschritten (Pending-Job oder Zeitlogik) |
| `approved` | Genehmigt | Bestätigung **oder** Absage durchgeführt |
| `rejected` | Abgelehnt | MA hat die Schicht abgelehnt |
| `cancelled` | Anfrage verworfen | z. B. Planänderung, Resend, Manager-Bestätigung |

---

## 4. Anzeige-Stati (`ShiftConfirmationStatus`) — 6 Werte

Das ist, was **Karten, Tooltips und Schicht-Stati-Tabs** anzeigen (`legacyConfirmationStatus`).

| # | Code | UI-Label (Karte) | Tooltip | Badge | Overlay |
|---|------|------------------|---------|-------|---------|
| 1 | `proposed` | Geplant | Geplant | `⋯` (weiß) | Ja |
| 2 | `requested` | Angefragt | Bestätigung angefordert | `?` (gelb) | Ja |
| 3 | `pending` | Ausstehend | Ausstehend | `⏱` (lila) | Ja |
| 4 | `rejected` | Abgelehnt | Abgelehnt | `✕` (magenta) | Ja |
| 5 | `confirmed` | Bestätigt | Bestätigt | *(keins)* | Nein |
| 6 | `canceled` | Abgesagt | Abgesagt | `⊘` (orange) | Ja |

i18n-Keys: `shiftConfirmation.status.*` und `shiftConfirmation.tooltipStatus.*` in `packages/i18n/src/messages/de.ts`.

### `requested` vs. `pending`

Beide bedeuten „MA soll noch reagieren“, unterscheiden sich aber in der Frist:

| | `requested` | `pending` |
|---|-------------|-----------|
| **Bedeutung** | Anfrage gesendet, noch in der Wartezeit | Frist abgelaufen, MA hat nicht rechtzeitig geantwortet |
| **Auslöser** | „Bestätigung anfordern“ / Resend | **3 Stunden** nach `requested_at` / `sent_at` **oder** Pending-Job setzt DB auf `pending` |
| **Request-Status (neu)** | `confirmation` / `pending` | `confirmation` / `expired` |
| **Schicht-Stati-Tab** | Bestätigung angefordert | Ausstehend |

Ohne geladene `shift_requests` wird `requested` + `requested_at` per Zeitlogik (`isShiftConfirmationPendingDue`) zu **`pending`** hochgestuft.

Konstante: `PENDING_ELAPSED_HOURS_REQUIRED = 3` in `packages/database/src/business-minutes.ts`.

---

## 5. Zuordnung: Lifecycle + Request → Anzeige

| `lifecycle_status` | Letzte `confirmation`-Anfrage | Anzeige (`legacyConfirmationStatus`) |
|--------------------|--------------------------------|--------------------------------------|
| `planned` | *(keine)* | `proposed` |
| `planned` | `pending`, noch nicht fällig | `requested` |
| `planned` | `pending`, fällig (≥ 3 h) | `pending` |
| `planned` | `expired` | `pending` |
| `planned` | `rejected` | `rejected` |
| `confirmed` | *(egal)* | `confirmed` |
| `cancelled` | *(egal)* | `canceled` |

Bei **`cancelled`**: zusätzlich `openCancellation` mit `cancelledBy`: `employee` | `manager`.

---

## 6. Schicht-Stati-Modal — Kategorien

Zusätzlich zu den Bestätigungs-Stati gibt es **Sonder-Kategorien** (kein `confirmation_status`):

| Kategorie | Tab-Label | Inhalt |
|-----------|-----------|--------|
| `conflicts` | Konflikte | Schicht kollidiert mit genehmigter Abwesenheit |
| `swaps` | Tausch-Anfragen | Offene Schicht-Tausch-Anfragen |

**Tab-Reihenfolge:** Konflikte → Tausch → MA abgesagt → Abgelehnt → Ausstehend → Nicht versendet → Bestätigung angefordert

| Tab (Code) | Tab-Label | Welche Schichten |
|------------|-----------|------------------|
| `canceled` | MA abgesagt | `canceled`, Absage durch **Mitarbeiter** |
| `rejected` | Abgelehnt | `rejected` |
| `pending` | Ausstehend | `pending` |
| `proposed` | Nicht versendet | `proposed` |
| `requested` | Bestätigung angefordert | `requested` |

`confirmed` erscheint **nicht** im Schicht-Stati-Modal (kein Handlungsbedarf).

Code: `apps/web/src/lib/communication-hub.ts`, `apps/web/src/lib/communication-tab-actions.ts`.

---

## 7. Aktionen pro Status

### Schicht-Stati-Modal / Kontextmenü (Manager)

| Anzeige-Status | Aktionen |
|----------------|----------|
| `proposed` | Bestätigung anfordern, Löschen |
| `requested` | Schicht stornieren |
| `pending` | Schicht stornieren, Bestätigung erneut anfordern |
| `rejected` | Neu zuweisen, Löschen |
| `canceled` | Neu zuweisen, Löschen |
| `confirmed` | **Kein Kontextmenü** |
| Konflikte | Neu zuweisen, Stornieren, Löschen |

**Vergangene, unbestätigte Schichten:** nur „Status auf bestätigt setzen“.

Code: `apps/web/src/lib/shift-card-context-menu-actions.ts`.

### Mitarbeiter-App (Mobile)

| Anzeige-Status | MA kann … |
|----------------|-----------|
| `requested` | Bestätigen / Ablehnen, Absagen* |
| `pending` | Bestätigen / Ablehnen, Absagen* |
| `confirmed` | Absagen* |
| `proposed`, `rejected`, `canceled` | Nicht antworten / nicht absagen |

\*Absage nur für **zukünftige** Schichtdaten.

Respondierbar: `EMPLOYEE_RESPONDABLE_CONFIRMATION_STATUSES = ["requested", "pending"]`.

### Manager vs. Mitarbeiter bei „Absage“

| Akteur | Verhalten |
|--------|-----------|
| **Manager** storniert | Schicht wird **gelöscht** (nicht `canceled`) |
| **Mitarbeiter** sagt ab | `lifecycle` → `cancelled`, Anzeige → `canceled` |

Absagbar (MA): `requested`, `pending`, `confirmed` — siehe `SHIFT_CANCELLABLE_CONFIRMATION_STATUSES`.

### Schichtbestätigung deaktiviert

Neue Zuweisungen erhalten sofort `confirmed` (`resolveInitialConfirmationStatus`). Keine `proposed`-Stati, kein Schicht-Stati-Modal.

---

## 8. Typische Status-Übergänge

```
Zuweisung (Bestätigung AN)
  → proposed (lifecycle: planned)

„Bestätigung anfordern“
  → requested (Request: confirmation/pending)

Nach 3 h ohne Antwort (Pending-Job)
  → pending (Request: confirmation/expired)

MA bestätigt
  → confirmed (Request: confirmation/approved, lifecycle: confirmed)

MA lehnt ab
  → rejected (Request: confirmation/rejected, lifecycle: planned)

MA sagt ab
  → canceled (Request: cancellation/approved, lifecycle: cancelled)

Planänderung / Reset
  → proposed (offene Requests → cancelled)

Zuweisung (Bestätigung AUS)
  → confirmed (sofort)
```

---

## 9. `ShiftCardDisplayState` — Detail-Felder

Neben `legacyConfirmationStatus` liefert `resolveShiftCardDisplayState`:

| Feld | Wann gesetzt | Inhalt |
|------|--------------|--------|
| `openConfirmation` | Offene Bestätigung | `pending` oder `expired`, inkl. `sentAt` |
| `lastConfirmation` | Abgeschlossene Bestätigung | `approved` oder `rejected` |
| `openCancellation` | Schicht abgesagt | `approved`, `cancelledBy`: employee/manager |

---

## 10. Kurz-Referenz (Anzeige)

| Code | Deutsch | Lifecycle | Overlay | Tab Schicht-Stati |
|------|---------|-----------|---------|-------------------|
| `proposed` | Geplant | planned | ✓ | Nicht versendet |
| `requested` | Angefragt | planned | ✓ | Bestätigung angefordert |
| `pending` | Ausstehend | planned | ✓ | Ausstehend |
| `rejected` | Abgelehnt | planned | ✓ | Abgelehnt |
| `confirmed` | Bestätigt | confirmed | — | *(kein Tab)* |
| `canceled` | Abgesagt | cancelled | ✓ | MA abgesagt |

---

## 11. Migration & Roadmap

| Sprint | Inhalt | Status |
|--------|--------|--------|
| 1 | Schema (`lifecycle_status`, `shift_requests`) + Read-Model | ✅ |
| 2 | Dual-Write auf allen Schreibpfaden | ✅ |
| 3 | UI über `resolveShiftCardDisplayState` | ✅ |
| 4 | Legacy-Spalte `confirmation_status` entfernen | Geplant |

Migrationen: `packages/database/migrations/20260620_shift_lifecycle_and_requests.sql`, `20260621_shift_requests_write_policies.sql`.
