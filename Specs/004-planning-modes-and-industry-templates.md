# Spec 004: Planungsmodi auf Organisationsebene & Branchen-Templates

## Ziel

SHIFTWERK soll für einfache Unternehmen (z. B. Kiosk, kleines Café) radikal einfach nutzbar sein und gleichzeitig für komplexe Branchen (Gastronomie, Pflege) die volle Funktionstiefe behalten. Dafür wird ein **Planungsmodus auf Organisationsebene** eingeführt, der die UI und die Pflichtfelder steuert, sowie ein **Onboarding mit Branchenauswahl**, das passende Stammdaten als Vorlage anlegt.

**Kernprinzip:** Eine Codebasis, ein Datenmodell. Branchenunterschiede leben ausschließlich in Daten (Templates, Modus), niemals in branchenspezifischen Code-Verzweigungen (`if gastronomie ...` ist verboten).

## Nicht-Ziele (Out of Scope)

- Keine Trennung in mehrere Apps oder Repos.
- Keine Änderung an Push-Benachrichtigungen, Schichttausch oder der Mobile-App.
- Keine Änderung an der Compliance-Engine (`@schichtwerk/compliance`).
- Keine KI-Planung (separates Spec).
- Bestehende Organisationen dürfen nicht in ihrem Verhalten verändert werden (siehe Migration).

## Ist-Zustand (relevant)

- `location_areas.planning_mode` existiert bereits mit `check (planning_mode in ('simple', 'advanced'))`, Default `'simple'` (schema.sql, Zeile ~198).
- `shifts.location_id` und `shifts.location_area_id` sind bereits nullable — eine Schicht ohne Bereich ist im Datenmodell schon möglich.
- Bei der Registrierung wird eine Organisation angelegt und Default-Schichttypen werden geseedet.
- Bereiche tragen Funktionen (Qualifikationen), Personalbedarf (`location_area_staffing`), Servicezeiten und Schichtvorlagen.

## Soll-Zustand

### 1. Datenmodell

Neue Migration in `packages/database/migrations/` (Schema-Datei `packages/database/schema.sql` synchron halten):

```sql
alter table public.organizations
  add column planning_mode text not null default 'simple'
    check (planning_mode in ('simple', 'advanced')),
  add column industry text
    check (industry in ('gastronomy', 'care', 'retail', 'other'));
```

- `organizations.planning_mode` ist der **führende** Modus. `location_areas.planning_mode` bleibt bestehen und wirkt als Override pro Bereich, ist aber nur im `advanced`-Modus der Organisation relevant.
- `industry` ist rein informativ (steuert nur das Seeding beim Onboarding und ggf. spätere Auswertungen).

**Migration für Bestandsdaten:** Alle existierenden Organisationen erhalten `planning_mode = 'advanced'` (sie nutzen bereits Bereiche/Bedarf — nichts darf für sie verschwinden). Nur neue Organisationen starten je nach Onboarding-Auswahl.

```sql
update public.organizations set planning_mode = 'advanced';
```

(Als Teil derselben Migration, nach dem `alter table`.)

TypeScript-Typen in `packages/types` und das Datenbank-Interface in `packages/database/src/interface.ts` entsprechend erweitern (`PlanningMode = 'simple' | 'advanced'`, `Industry = 'gastronomy' | 'care' | 'retail' | 'other'`).

### 2. Bedeutung der Modi

| Aspekt | `simple` | `advanced` |
|---|---|---|
| Standorte & Bereiche | versteckt; es existiert genau ein automatisch angelegter Standort ohne sichtbare Bereiche | sichtbar & pflegbar |
| Funktionen/Qualifikationen | versteckt | sichtbar & pflegbar |
| Personalbedarf (`location_area_staffing`) | versteckt | sichtbar & pflegbar |
| Servicezeiten | versteckt | sichtbar & pflegbar |
| Schichtvorlagen | optional, vereinfacht (nur Name + Zeit) | voll (an Bereich gebunden) |
| Schicht anlegen | Mitarbeiter + Datum + Start/Ende (+ Notiz) | wie bisher inkl. Bereich, Vorlage, Qualifikationsprüfung |
| Mitarbeiterprofil | Name, Kontakt, Verfügbarkeiten, Stundenziel | wie bisher inkl. Qualifikationen, Zuschläge |

**Simple-Modus, technische Umsetzung:** Beim Anlegen einer `simple`-Organisation wird genau ein Standort (Name = Organisationsname) angelegt. Schichten werden mit `location_id` dieses Standorts und `location_area_id = null` gespeichert. So bleibt das Datenmodell konsistent und ein späteres Upgrade auf `advanced` ist verlustfrei.

**Moduswechsel:** In den Einstellungen kann ein Admin von `simple` auf `advanced` wechseln (einfach: zusätzliche Felder werden sichtbar, bestehende Schichten bleiben gültig). Der Wechsel `advanced` → `simple` wird in dieser Iteration **nicht** angeboten (Datenverlust-Risiko); der Menüpunkt zeigt einen Hinweis.

### 3. Onboarding mit Branchenauswahl

Registrierungsflow (`/register`) erweitern um einen Schritt **„Was für ein Unternehmen seid ihr?"** mit vier Karten:

| Auswahl | `industry` | `planning_mode` | Geseedete Daten |
|---|---|---|---|
| Gastronomie | `gastronomy` | `advanced` | Standort „Hauptstandort" mit Bereichen *Restaurant*, *Küche*, *Bar*; Qualifikationen *Koch/Köchin*, *Kellner/in*, *Spülkraft*, *Barkeeper/in* |
| Pflege | `care` | `advanced` | Standort „Hauptstandort" mit Bereich *Wohnbereich 1*; Qualifikationen *Pflegefachkraft (examiniert)*, *Pflegehilfskraft*, *Betreuungskraft* |
| Einzelhandel | `retail` | `advanced` | Standort „Hauptstandort" mit Bereichen *Verkauf*, *Lager*; Qualifikationen *Verkäufer/in*, *Lagerist/in* |
| Einfach / Sonstiges | `other` | `simple` | Ein unsichtbarer Standort (Name = Organisationsname), keine Bereiche, keine Qualifikationen |

Umsetzung als **Daten-Templates**, nicht als Code-Verzweigung: Ein Modul `packages/database/src/industry-templates.ts` (o. ä.) exportiert pro Branche ein deklaratives Objekt (`{ planningMode, locations: [{ name, areas: [...] }], qualifications: [...] }`). Die bestehende Server Action für die Registrierung iteriert generisch darüber. Neue Branchen = neues Template-Objekt, null Codeänderung im Flow.

Das bestehende Seeding der Default-Schichttypen bleibt für alle Branchen erhalten.

### 4. UI-Anpassungen (Web, `apps/web`)

Eine zentrale Ableitung, kein verstreutes Flag-Lesen:

- Helper/Hook, z. B. `getOrgFeatures(organization)` in einem geteilten Modul, der aus `planning_mode` ein Feature-Objekt ableitet: `{ areas: boolean, qualifications: boolean, staffing: boolean, serviceHours: boolean, shiftTemplates: 'simple' | 'full' }`. **Alle** UI-Bedingungen prüfen gegen dieses Objekt, niemals direkt gegen `planning_mode === 'simple'` in Komponenten.

Konkrete Stellen:

1. **Navigation/Sidebar (Manager-Layout):** Menüpunkte für Bereiche/Standorte-Verwaltung im `simple`-Modus ausblenden.
2. **Einstellungen (`/einstellungen`):** Tabs für Standorte, Bereiche, Qualifikationen, Servicezeiten im `simple`-Modus ausblenden. Neuer Abschnitt „Planungsmodus" mit Anzeige des Modus und Upgrade-Button (`simple` → `advanced`).
3. **Planung (`/planung`):** Im `simple`-Modus entfällt die Bereichs-/Standortauswahl komplett; der Schicht-Dialog zeigt nur Mitarbeiter, Datum, Start-/Endzeit, Notiz. Die Mitarbeiter-Auswahl filtert weiterhin nach Verfügbarkeit und Abwesenheit, aber **nicht** nach Qualifikation.
4. **Team (`/team`):** Qualifikations-Zuordnung und Zuschläge im `simple`-Modus ausblenden.
5. **Dashboard (`/dashboard`):** Standort-/Bereichsfilter im `simple`-Modus ausblenden.

### 5. Server-seitige Validierung

Die Validierungsfunktionen in `@schichtwerk/database` müssen den Modus respektieren:

- Im `simple`-Modus: Schicht-Validierung ohne Bereichs-/Qualifikations-/Bedarfsprüfung; Verfügbarkeits-, Abwesenheits- und Überschneidungsprüfung bleiben aktiv.
- Im `advanced`-Modus: unverändertes Verhalten.
- Server Actions dürfen sich nicht auf die UI verlassen: Eine `simple`-Organisation, die per API einen Bereich an eine Schicht hängt, ist kein Fehler (Daten sind valide), aber Pflichtprüfungen auf Bereich/Qualifikation entfallen.

### 6. i18n

Alle neuen Texte (Branchenauswahl, Modus-Einstellungen, vereinfachte Dialoge) in `packages/i18n` für `de` und `en` anlegen. Keine hartkodierten Strings.

## Akzeptanzkriterien

1. Neue Registrierung mit „Einfach/Sonstiges": Nach dem Login sieht der Inhaber **keine** Bereiche, Qualifikationen, Bedarfe oder Servicezeiten — nur Dashboard, Planung, Team, Abwesenheiten, Berichte, Einstellungen.
2. Im `simple`-Modus kann eine Schicht mit nur Mitarbeiter + Datum + Zeit angelegt werden; sie erscheint im Dashboard und in der Mobile-App des Mitarbeiters wie bisher.
3. Neue Registrierung mit „Gastronomie": Bereiche Restaurant/Küche/Bar und die vier Qualifikationen sind vorangelegt; Verhalten entspricht dem heutigen `advanced`-Funktionsumfang.
4. Alle **bestehenden** Organisationen verhalten sich nach der Migration exakt wie vorher (sind `advanced`).
5. Upgrade `simple` → `advanced` in den Einstellungen: bestehende Schichten bleiben sichtbar und gültig; Bereichs-/Qualifikationsverwaltung wird verfügbar.
6. `npm run lint` und `npm run build` laufen fehlerfrei durch alle Workspaces.
7. Kein Vorkommen von branchenspezifischen Bedingungen im Code (Suche nach `industry ===` außerhalb des Template-/Seeding-Moduls liefert nichts).

## Implementierungsreihenfolge

1. Migration + Schema + Typen (`organizations.planning_mode`, `industry`).
2. `getOrgFeatures`-Helper + Laden des Modus im Manager-Layout (Context/Props).
3. Onboarding-Schritt + Branchen-Templates + Seeding in der Register-Action.
4. UI-Ausblendungen (Navigation, Einstellungen, Planung, Team, Dashboard).
5. Validierungsanpassung in `@schichtwerk/database`.
6. Modus-Upgrade in den Einstellungen.
7. i18n-Texte vervollständigen.
