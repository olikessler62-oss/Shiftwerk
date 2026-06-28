# Testdaten-Setup: Dashboard · Bereichskarten-Header

Konkrete Schrittfolge für manuelle Tests aus [012-dashboard-area-header-test-scenarios.md](./012-dashboard-area-header-test-scenarios.md).

**Ziel:** In **einer Demo-Organisation** (Gastronomie-Vorlage) alle Header-Szenarien reproduzierbar anlegen — Unterbesetzung, Gedeckt, Einteilungs-Hinweise, fünf Bestätigungstypen, Scroll-Stress-Test.

**Zeitbedarf:** ca. 20–30 Minuten (ohne 3-h-Wartezeit für `pending`; siehe Shortcut unten).

---

## 0. Voraussetzungen

| Punkt | Hinweis |
|-------|---------|
| Rolle | **Superadmin** (für Reset + Simulation) |
| Organisation | Gastronomie-Demo mit Bereichen **Restaurant**, **Küche**, **Bar** |
| Wochentag | **Nicht Donnerstag** — Restaurant/Küche sind donnerstags geschlossen |
| Kalenderwoche | **Aktuelle KW** verwenden (Dashboard → Wochenübersicht) |
| Personalbedarf | Nach Reset aktiv (Standard) |

**Profil-Qualifikationen nach „Schichten zurücksetzen“** (Reihenfolge = `sort_order` in der Mitarbeiterliste):

| Profile | Qualifikationen |
|---------|-----------------|
| Alle | Kellner/in |
| 1–7 | zusätzlich Koch/Köchin |
| 7–13 | zusätzlich Spülkraft |
| letzte 7 | zusätzlich Barista |

**Bedarf nach Reset (Mo, Di, Mi, Fr, Sa, So):**

| Bereich | Fenster | Bedarf |
|---------|---------|--------|
| Restaurant | 07–10, 12–15, 18–22 | Kellner/in ×2 je Fenster |
| Küche | 07–10 | Koch ×1 |
| Küche | 12–15, 18–22 | Koch ×1 + Spülkraft ×1 |
| Bar | 18–22 | Barista ×1 + Spülkraft ×1 |

---

## 1. Basis-Reset (einmalig)

1. **Einstellungen → Superadmin** öffnen.
2. Abschnitt **„Schichtdaten zurücksetzen“**:
   - **„Alle Schichten löschen“** aktivieren (sauberer Start).
   - **Zurücksetzen** bestätigen.
3. Im selben Dialog **Organisation**:
   - **Schichtbestätigung** aktivieren und **Speichern** (DB-Flag).
4. Simulation (nur Superadmin, Session):
   - **Schichtbestätigung simulieren** → **An**
   - **App-Registrierungs-Gate lockern** → **An** (Zuweisung ohne App-Registrierung)
   - **Neue Zuweisungen als „Geplant“ (proposed)** → **Aus** (Zuweisung direkt als `proposed`, Anfrage separat)

> Nach Reset existieren **keine Schichten** — alles wird im Bereichskalender zugewiesen.

---

## 2. Schnell-Referenz: Status erzeugen

| Header-Zeile (DE) | Status | Kurzweg |
|-------------------|--------|---------|
| Noch unbesetzte Schichten | — | Bedarf nicht erfüllt (aktueller Tag) |
| Gedeckt | — | Bedarf vollständig erfüllt |
| Hinweise zur Einteilung | — | Überbesetzung oder falsche Quali |
| Angefragte Bestätigungen | `requested` | Zuweisen → **Bestätigung anfragen** (frisch, &lt; 3 h) |
| Ausstehende Anfragen | `pending` | Anfrage + **3 h** vergangen (Shortcut: § 2.1) |
| Abgelehnte Anfragen | `rejected` | MA lehnt in App ab **oder** Kommunikation → Antworten simulieren |
| Abgesagte Schichten | `canceled` | **Schicht stornieren** (MA informieren) |
| Ungeklärte Schichten | `unresolved` | **Vergangener** Schichttag + offene Anfrage (`requested`/`pending`) |

### 2.1 Shortcut `pending` ohne 3 h warten

In Supabase SQL Editor (nur Dev/Staging):

```sql
-- shift_id und requested_at anpassen
update shifts
set
  confirmation_status = 'requested',
  requested_at = now() - interval '4 hours'
where id = '<SHIFT_UUID>';
```

Seite neu laden — Anzeige wechselt per Zeitlogik zu **`pending`**.

### 2.2 Shortcut `unresolved`

Schicht mit **gestrigem** oder älterem `shift_date` anlegen, Bestätigung anfragen, Status `requested` oder `pending` belassen. Vergangenes Datum → Anzeige **`unresolved`**.

---

## 3. Szenario A — Restaurant · Unterbesetzung (Header rot)

**Ziel:** Spec 012 · 1.2, 2.1–2.2, 3.1

1. **Bereichskalender → Restaurant → Heute (Mittag 12:00–15:00)**.
2. **1 Kellner/in** zuweisen (z. B. Profil **1** — hat Kellner + Koch).
3. Zweiten Kellner **nicht** zuweisen (Bedarf 2/2, besetzt 1).

**Erwartung Dashboard (Woche + Drilldown Heute):**

- Header: **„Noch unbesetzte Schichten“** (roter Punkt)
- Zeile Mittag: `1/2`, ocker/rot
- Klick Header oder Drei-Punkt → **„Vorschlag: Personal“**

---

## 4. Szenario B — Restaurant · Gedeckt (Header grün)

**Ziel:** Spec 012 · 1.1, 2.3, 3.4

1. Gleiches Fenster **Heute Mittag**.
2. **Zweiten Kellner** zuweisen (z. B. Profil **8**).

**Erwartung:**

- Header: **„Gedeckt“** (grün) — **nicht klickbar**
- Zeile Mittag: `2/2`, grün, kein Drei-Punkt

> Tipp: Für paralleles Testen von A + B zwei **verschiedene Tage** nutzen (z. B. heute unterbesetzt, morgen gedeckt).

---

## 5. Szenario C — Restaurant · Überbesetzung (Einteilungs-Hinweis)

**Ziel:** Spec 012 · 1.5, 2.5, 3.2

1. **Morgen** (oder anderer Zukunftstag, ≠ Donnerstag) **Mittag 12–15**.
2. **3 Kellner** zuweisen (z. B. Profile **1**, **2**, **8**) — Bedarf nur 2.

**Erwartung:**

- Header: zusätzlich **„Hinweise zur Einteilung“** (ocker)
- Zeile: `3/2` ocker
- Klick → Modal **„Hinweise zur Einteilung · Restaurant“** (Überbesetzung)

---

## 6. Szenario D — Küche · Qualifikation passt nicht

**Ziel:** Spec 012 · 1.5 (Qualifikation), Drilldown-Text „Qualifikation passt nicht“

1. **Bereichskalender → Küche → Mittag 12–15**.
2. **Koch-Slot:** Profil **8** (oder 9–13) zuweisen — hat **kein** Koch/Köchin, nur Kellner + Spülkraft.
3. Spülkraft-Slot optional mit Profil **7** korrekt besetzen.

**Erwartung:**

- Header Küche: **„Hinweise zur Einteilung“**
- Modal: Eintrag **„Qualifikation passt nicht“** (nicht nur Überbesetzung)

---

## 7. Szenario E — Fünf Bestätigungstypen (Restaurant, verteilt auf die KW)

Alle Schichten im **Restaurant**, **Abendfenster 18–22** (einfacher als Mittag). Pro Tag **ein** MA, **ein** Status — so bleiben die Zeilen in der Wochenaggregation getrennt.

| Tag in KW | Aktion | Ergebnis-Status |
|-----------|--------|-----------------|
| Mo | Profil 1 zuweisen → **Bestätigung anfragen** (Kommunikation oder Kontextmenü) | `requested` |
| Di | Profil 2 zuweisen → anfragen → SQL `requested_at` −4 h (§ 2.1) | `pending` |
| Mi | Profil 3 zuweisen → anfragen → MA **ablehnen** (Mobile oder Kommunikation → Antworten) | `rejected` |
| Fr | Profil 4 zuweisen → anfragen → **Schicht stornieren** | `canceled` |
| **Gestern** (in aktueller KW) | Profil 5 zuweisen → anfragen, Datum in Vergangenheit | `unresolved` |

**Schritte im Bereichskalender (Beispiel Mo):**

1. Restaurant → Montag → Abend → Profil zuweisen.
2. Schichtkarte → Kontextmenü → **Bestätigung anfragen**  
   *oder* **Kommunikation → Senden → Bestätigung anfragen**.
3. Für **rejected:** Mobile-App als MA einloggen → Schicht ablehnen.  
   Alternativ: **Kommunikation → Antworten** (Dev-Simulation).
4. Für **canceled:** Kontextmenü → **Schicht stornieren** (Bestätigungsdialog).

**Erwartung Dashboard (Wochenansicht, Restaurant):**

- Bis zu **5 Bestätigungszeilen** im Header (je ein Typ)
- Jede Zeile klickbar → Modal **„Offene Punkte“**, gefiltert auf den Typ

---

## 8. Szenario F — Scroll-Stress-Test (≥ 6 Header-Zeilen)

**Ziel:** Spec 012 · 4.2

Kombination in **einem Bereich** (Restaurant) in **derselben KW**:

1. **Heute Mittag:** Unterbesetzt (§ 3) → 1 Zeile Besetzung
2. **Morgen Mittag:** Überbesetzt (§ 5) → 1 Zeile Hinweise
3. **Mo–Fr + gestern:** je 1 Bestätigungstyp (§ 7) → 5 Zeilen

**Summe:** 1 + 1 + 5 = **7 Zeilen** → rechte Header-Spalte **scrollbar**.

Prüfen: alle klickbaren Zeilen behalten `pointer` und öffnen das passende Modal.

---

## 9. Szenario G — Vergangenheit (grau, nicht klickbar)

**Ziel:** Spec 012 · 1.3, 2.4, 3.5

1. **Letzte Woche** im Dashboard öffnen (oder Drilldown auf vergangenen Tag).
2. Bereich mit **offenen Schichten** in der Vergangenheit wählen (oder Schichten dort anlegen vor Reset-Woche).

**Erwartung:**

- **„unbesetzte Schichten“** (grau, nicht „Noch …“)
- Kein Pointer, kein Personalvorschlag-Button

---

## 10. Szenario H — Drilldown Heute / Woche

**Ziel:** Spec 012 · 5.x

1. Dashboard → Woche → **Restaurant**-Karte → Tag **Heute** anklicken (Drilldown).
2. Schalter **Heute** / **Woche** umschalten.
3. Header-Zahlen und Statusliste müssen zum gewählten Scope passen (ein Tag vs. ganze KW).

---

## 11. Empfohlene Test-Matrix (Copy-Paste)

Nach Setup diese Kombination abhaken:

```
Organisation: _______________   KW: _______________   Tester: _______________

[ ] Reset + Schichtbestätigung + Simulation erledigt (§ 1)
[ ] A  Restaurant unterbesetzt (heute Mittag)
[ ] B  Restaurant gedeckt (anderer Tag oder nach A aufgefüllt)
[ ] C  Restaurant überbesetzt (morgen Mittag)
[ ] D  Küche Qualifikations-Hinweis (Profil 8+ am Koch-Slot)
[ ] E  requested / pending / rejected / canceled / unresolved (Restaurant, Abend)
[ ] F  ≥ 6 Header-Zeilen + Scroll sichtbar
[ ] G  Vergangene Woche: graue unbesetzte Schichten
[ ] H  Drilldown Heute/Woche konsistent
[ ] Smoke-Liste Spec 012 § 9
```

---

## 12. Typische Stolpersteine

| Problem | Lösung |
|---------|--------|
| Zuweisung schlägt fehl | **App-Registrierungs-Gate lockern** (§ 1) oder MA mit App/E-Mail-Fallback |
| Keine Bestätigungszeilen | Org-Flag **und** Simulation **Schichtbestätigung** prüfen |
| Nur `pending`, kein `requested` | Anfrage ist älter als 3 h — neue Schicht anfragen oder `requested_at` zurücksetzen |
| Donnerstag leer | Restaurant/Küche geschlossen — anderen Wochentag wählen |
| Header zeigt weniger Zeilen als erwartet | Aggregation ist **pro Bereich pro Woche**; Status auf verschiedene Tage verteilen |
| `proposed` erscheint nicht im Header | Normal — Header zählt nur **actionable** Status (`requested` … `unresolved`) |

---

## 13. Verwandte Dokumente

- [012-dashboard-area-header-test-scenarios.md](./012-dashboard-area-header-test-scenarios.md) — Erwartungen & Smoke-Checkliste
- [docs/shift-statuses.md](../docs/shift-statuses.md) — `requested` vs. `pending`, `unresolved`
- [010-shift-status-actions-specification.md](./010-shift-status-actions-specification.md) — Klick- und Menü-Verhalten
