# Testszenarien: Dashboard · Bereichskarten-Header & Statusliste

Strukturiert nach **Anzeige**, **Klick-Verhalten**, **Modals**, **Scroll** und **Begriffe**.  
Gilt für **Wochenübersicht** (Bereichskarten-Grid) und **Tages-Drilldown** (Heute/Woche-Schalter).

**Voraussetzungen für die meisten Fälle**

- Organisation mit aktiviertem **Personalbedarf**
- Optional: **Schichtbestätigung** aktiv (für Bestätigungszeilen)
- Testdaten: mindestens zwei Bereiche (z. B. Restaurant, Küche), aktuelle Kalenderwoche

**Automatisierte Unit-Tests** (Vitest):

```bash
npm test -- --run apps/web/src/lib/dashboard-area-header-actions.test.ts apps/web/src/lib/dashboard-staffing-window-issues.test.ts apps/web/src/lib/dashboard-area-week-stats.test.ts
```

---

## 1. Header-Statusliste · Anzeige

| # | Szenario | Erwartung |
|---|----------|-----------|
| 1.1 | Bereich vollständig besetzt (grün) | Eine Zeile **„Gedeckt“** (grüner Punkt) |
| 1.2 | Bereich mit offenen Schichten (aktuell) | **„Noch unbesetzte Schichten“** (roter Punkt) |
| 1.3 | Vergangener Tag/Woche mit Lücken | **„unbesetzte Schichten“** (grauer Punkt, nicht rot) |
| 1.4 | Schichtbestätigung an, `pending` + `rejected` in der Woche | Zwei Zeilen: **„Ausstehende Anfragen“**, **„Abgelehnte Anfragen“** (je ein Punkt, keine Doppelung pro Typ) |
| 1.5 | Überbesetzung oder Qualifikations-Hinweis in der Woche | Zusätzliche Zeile **„Hinweise zur Einteilung“** (ocker Punkt) |
| 1.6 | Alle fünf Bestätigungstypen gleichzeitig | Max. 5 Bestätigungszeilen + ggf. Besetzung + Hinweise zur Einteilung |
| 1.7 | Personalbedarf deaktiviert | Keine Besetzungszeile; nur Bestätigung/Hinweise falls relevant |

---

## 2. Header-Statusliste · Klick & Cursor

| # | Szenario | Erwartung |
|---|----------|-----------|
| 2.1 | Hover über **„Noch unbesetzte Schichten“** (aktuell, mit offener Zeile) | `cursor: pointer`, dezenter Hover-Hintergrund |
| 2.2 | Klick auf **„Noch unbesetzte Schichten“** | Modal **„Vorschlag: Personal“** für erste passende Schichtzeile (unterbesetzt/geplant, nicht Vergangenheit) |
| 2.3 | Klick auf **„Gedeckt“** | Kein Pointer, kein Klick, kein Modal |
| 2.4 | Vergangener Scope + **„unbesetzte Schichten“** | Kein Pointer, kein Klick |
| 2.5 | Klick auf **„Hinweise zur Einteilung“** | Modal **„Hinweise zur Einteilung · {Bereich}“** mit Überbesetzung/Qualifikations-Liste |
| 2.6 | Klick auf **„Ausstehende Anfragen“** (Bestätigung an) | Modal **„Offene Punkte“**, gefiltert auf `pending`, mit Aktionen (z. B. Stornieren, Bestätigung anfragen) |
| 2.7 | Klick auf weiteren Bestätigungstyp (`rejected`, `canceled`, …) | Modal **„Offene Punkte“**, nur Einträge dieses Typs |
| 2.8 | Schichtbestätigung aus | Bestätigungszeilen fehlen; Klick auf Bestätigung nicht möglich |

---

## 3. Schichtliste in der Bereichskarte (Tabellenzeilen)

| # | Szenario | Erwartung |
|---|----------|-----------|
| 3.1 | Zeile unterbesetzt, heute/zukünftig | Drei-Punkt-Button → **„Vorschlag: Personal“** |
| 3.2 | Zeile mit Einteilungs-Hinweis (ocker `besetzt/bedarf`) | Drei-Punkt → **„Hinweise zur Einteilung anzeigen“** → Einteilungs-Modal |
| 3.3 | Zeile nur mit Bestätigungsstatus (ocker, keine Einteilungs-Hinweise) | Zweiter Drei-Punkt → **„Offene Punkte für Schichtfenster anzeigen“** |
| 3.4 | Zeile vollständig besetzt, kein Hinweis | Kein Drei-Punkt-Button |
| 3.5 | Vergangener Tag in der Liste | Zeile grau (`bg-muted/14`); kein Personalvorschlag-Button |
| 3.6 | Zeilen mit und ohne Button | **Gleiche Zeilenhöhe** (kompakter Drei-Punkt, `h-6`) |

---

## 4. Scroll-Verhalten (Header)

| # | Szenario | Erwartung |
|---|----------|-----------|
| 4.1 | ≤ 3 Statuszeilen | Alles sichtbar, kein Scroll nötig |
| 4.2 | ≥ 6 Statuszeilen (z. B. alle Bestätigungstypen + Besetzung + Hinweise) | Rechte Spalte **scrollbar**; keine abgeschnittenen Texte |
| 4.3 | Scroll bei Hover/Klick | Klickbare Zeilen bleiben bedienbar; Pointer auf allen klickbaren Einträgen |

**Tipp zum Erzwingen von 4.2:** In einer Testwoche Schichten mit `pending`, `requested`, `rejected`, `canceled`, `unresolved` anlegen + Unterbesetzung + Überbesetzung im selben Bereich.

---

## 5. Drilldown · Heute / Woche

| # | Szenario | Erwartung |
|---|----------|-----------|
| 5.1 | Tages-Drilldown, Schalter **Heute** | Header + Liste nur für **diesen Tag** |
| 5.2 | Schalter **Woche** | Header + Liste für **gesamte KW** |
| 5.3 | Andere Kalenderwoche (nicht aktuell) | Schalter zeigt z. B. **„Sa 13.Jun“** / **„KW 24 (…)"** |
| 5.4 | Klick Header-Zeile im Drilldown | Gleiches Modal-Verhalten wie in Wochenübersicht |

---

## 6. Begriffe (Regression nach Umbenennung)

| # | UI-Stelle | Erwarteter Text (DE) |
|---|-----------|----------------------|
| 6.1 | Header, Einteilung | **Hinweise zur Einteilung** (nicht „Personal-Konflikte“) |
| 6.2 | Einteilungs-Modal Titel | **Hinweise zur Einteilung · {Bereich}** |
| 6.3 | Schichtfenster-Modal (Bestätigung + gemischt) | **Offene Punkte** |
| 6.4 | Personalvorschlag | **Vorschlag: Personal** + Hinweis **(gepr.: Planungskonflikte)** |
| 6.5 | Besetzungszeile | Weiterhin **Schichten** (nicht „Stellen“) |

---

## 7. Modals · Aktionen (Offene Punkte)

| # | Szenario | Erwartung |
|---|----------|-----------|
| 7.1 | `pending`-Schicht im Modal | Buttons z. B. **Schicht stornieren**, **Bestätigung anfragen** |
| 7.2 | `rejected`-Schicht | **Neu zuweisen** (→ Bereichskalender), **Löschen** |
| 7.3 | Escape / X / Klick auf Overlay | Modal schließt |
| 7.4 | Aktion erfolgreich | Seite aktualisiert sich; Modal schließt; Header-Liste passt sich an |

---

## 8. Negativ- & Randfälle

| # | Szenario | Erwartung |
|---|----------|-----------|
| 8.1 | Bereich ohne Schichtfenster-Zeilen | Nur Header-Metriken; Statusliste je nach Daten |
| 8.2 | Nur Bestätigung, kein Personalbedarf-Mismatch | Keine Zeile „Hinweise zur Einteilung“ |
| 8.3 | Read-only-Woche | Aktionen in „Offene Punkte“ deaktiviert |
| 8.4 | Mehrere unterbesetzte Zeilen | Header-Klick öffnet Vorschlag für **erste** passende Zeile (Reihenfolge der Tabelle) |

---

## 9. Kurz-Checkliste (Smoke, ~5 Min.)

- [ ] Wochenübersicht: Bereichskarte mit „Noch unbesetzte Schichten“ → Klick → Vorschlag Personal
- [ ] Bereich mit ocker `besetzt/bedarf` → Header „Hinweise zur Einteilung“ → Modal
- [ ] Bestätigung `pending` → Header-Zeile → „Offene Punkte“
- [ ] Drilldown: Heute/Woche umschalten → Header passt sich an
- [ ] Viele Statuszeilen → Scroll in rechter Spalte
- [ ] „Gedeckt“ nicht klickbar

---

## 10. Testdaten-Vorschläge

Kurzüberblick — **Schritt-für-Schritt-Anleitung:** [013-dashboard-area-header-test-data-setup.md](./013-dashboard-area-header-test-data-setup.md)

| Ziel | Was anlegen |
|------|-------------|
| Unterbesetzung | Bedarf 2/2, nur 1 MA zugewiesen |
| Einteilungs-Hinweis | MA ohne passende Quali oder Überbesetzung laut Bedarf |
| `pending` | Schicht zuweisen, Bestätigung angefragt, noch keine Antwort |
| `rejected` | MA lehnt ab |
| `canceled` | Schicht abgesagt |
| Scroll-Test | Kombination aus 5 Bestätigungstypen + Unterbesetzung + Einteilungs-Hinweis |
