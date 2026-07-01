# AGENTS.md — Schichtwerk

Leitfaden für KI-Agenten und Entwickler:innen in diesem Monorepo. Lies diese Datei zuerst, bevor du größere Änderungen machst.

## Produkt & Ziel

**Schichtwerk** ist Schichtplanung für kleine Teams (bis ca. 20 Personen):

- **Web** (`apps/web`) — Next.js für Inhaber/Manager: Dashboard, Bereichs- und Mitarbeiter-Kalender, Einstellungen
- **Mobile** (`apps/mobile`) — Expo-App für Mitarbeiter

Sprache der UI: **Deutsch** (primär), Englisch über i18n. Domain-Begriffe konsistent halten (z. B. „angefragt“, „offen“, „bestätigt“ bei Schichtbestätigung).

## Monorepo-Struktur

```
schichtwerk/
├── apps/web/              # Next.js 15, App Router, React 19
├── apps/mobile/           # Expo
├── packages/
│   ├── types/             # Gemeinsame TypeScript-Typen
│   ├── database/          # SchichtwerkDatabase + SQL-Migrationen
│   ├── api-client/        # Supabase-Helfer
│   ├── compliance/        # Arbeitszeit-/Compliance-Logik
│   ├── i18n/              # de.ts + en.ts
│   └── ui-tokens/         # Design-Tokens
├── supabase/              # Nur CLI-Konfiguration (kein Schema)
└── .cursor/rules/         # Dateispezifische Cursor-Regeln
```

Workspaces: `npm` + **Turbo**. Node **≥ 20**.

## Arbeitsweise für Agenten

### Scope & Qualität

1. **Kleinstmögliche, korrekte Änderung** — keine Refactors „nebenbei“.
2. **Bestehende Konventionen lesen und übernehmen** — Namen, Imports, Patterns im umgebenden Code.
3. **Kein Over-Engineering** — keine Hilfsfunktionen für Einzeiler, keine unnötigen Abstraktionen.
4. **Kommentare sparsam** — nur für nicht-offensichtliche Fachlogik.
5. **Tests** nur hinzufügen, wenn sie echtes Verhalten absichern (nicht auf Anfrage des Users trotzdem trivial testen).

### Git & PRs

- **Nicht committen**, es sei denn, der User verlangt es ausdrücklich.
- Kein `git config` ändern, kein Force-Push auf `main`/`master`.
- PRs über `gh` erstellen, wenn der User das möchte (siehe User-Regeln im Cursor-Projekt).

### Vor dem Implementieren

1. Relevante Dateien **lesen** (nicht raten).
2. **`.cursor/rules/`** prüfen, wenn du an passenden Dateien arbeitest (Comboboxen, Tooltips, Settings-Modals).
3. **`.cursor/skills/`** lesen, wenn das Thema passt (z. B. Edit-Validierung mit `excludeId`).
4. Bei DB-Änderungen: Typen in `packages/types`, Logik in `packages/database`, Migration in `packages/database/migrations/`.

## Tech Stack (Web)

| Bereich | Technologie |
|--------|-------------|
| Framework | Next.js App Router, RSC-first |
| Sprache | TypeScript strict, Interfaces für Props/APIs, kein `any` |
| Styling | Tailwind CSS, Tokens aus `@schichtwerk/ui-tokens` |
| Daten | Supabase über `getDatabase()` → `SchichtwerkDatabase` |
| Auth (Manager) | `requireManager()` in Server Actions |
| i18n | `packages/i18n` — Keys in **de.ts und en.ts** parallel pflegen |
| Tests | Vitest (`apps/web/src/lib/**/*.test.ts`, Packages) |

### Server vs. Client

- **Standard: Server Components** — Daten dort laden.
- `"use client"` nur bei State, Events, Browser-APIs.
- Parallele DB-Calls mit `Promise.all()` statt Wasserfall.
- Schwere Client-Bundles: `next/dynamic`.

### Web-Pfade (apps/web)

| Pfad | Zweck |
|------|--------|
| `src/app/(manager)/` | Manager-UI (Planung, Dashboard, Einstellungen) |
| `src/app/actions/` | Server Actions (`"use server"`) |
| `src/components/` | UI-Komponenten (nach Feature gruppiert) |
| `src/lib/` | Domänenlogik, reine Funktionen, Tests |

Import-Alias: `@/` → `apps/web/src/`.

## Datenbank & Migrationen

- **Einzige Schema-Quelle für Neuanlage:** `packages/database/schema.sql`
- **Inkrementelle Änderungen:** `packages/database/migrations/YYYYMMDD_beschreibung.sql`
- Nach Schema-Änderung: Interface `SchichtwerkDatabase` und ggf. `packages/types` anpassen.
- Migrationen manuell im Supabase SQL Editor ausführen (Projekt-Workflow).

## i18n

- Texte **nicht hardcoden** in UI-Komponenten, die bereits `useTranslations()` nutzen.
- Neue Keys unter `areaCalendar.*`, `dashboard.*`, `locations.*` etc. in:
  - `packages/i18n/src/messages/de.ts`
  - `packages/i18n/src/messages/en.ts`
- Deutsche UI-Texte sind maßgeblich; Englisch sinnvoll übersetzen.

## Tests ausführen

```bash
# Gesamte Vitest-Suite (Root)
npm test

# Einzelne Datei
npx vitest run apps/web/src/lib/bulk-staffing-header.test.ts
```

Tests liegen bevorzugt neben der Logik in `src/lib/*.test.ts` (reine Funktionen, leicht testbar).

## UI-Konventionen (wichtig)

Diese Regeln stehen ausführlicher in `.cursor/rules/`:

| Thema | Regel |
|-------|--------|
| **Tooltips** | Kein natives HTML `title` — `@/components/ui/tooltip` verwenden |
| **Modal-Scrollbars** | Dialog-Container über Shell-Klassen + `MODAL_SCROLLBAR_CLASS` (enthält `modal-scrollbar-inline`) — kein weißer Rand rechts |
| **Comboboxen** | `useComboboxCloseOnPointerDistance` für Schließen bei Mausabstand |
| **Edit-Validierung** | Beim Bearbeiten Datensatz aus Duplikat-/Overlap-Checks ausschließen (Skill: `edit-validation-exclude-self`) |
| **Textauswahl** | Global `user-select: none` — Eingabefelder bleiben selektierbar |

## Domänen-Bereiche (Orientierung)

### Planung & Kalender

- **Bereich-Kalender:** `apps/web/src/components/areacalendar/`
- **Mitarbeiter-Kalender / Dashboard:** `apps/web/src/components/dashboard/`
- Personalbedarf (Füllstandsanzeigen): `bulk-staffing-header.ts`, `tag-area-header-staffing-display.ts`, `location-staffing-client.ts`
- Schichtbestätigung: Status `confirmed`, `proposed`, `requested`, `pending`, `unresolved`, `rejected`, `canceled` — Filter in `staffing-shift-confirmation.ts`

### Ampel-Logik Füllstandsanzeigen

- **Grün:** Bedarf bestätigt gedeckt
- **Gelb (gefüllt):** Geplant/angefragt würde Bedarf decken, noch nicht voll bestätigt
- **Rot:** Echter Engpass (auch mit geplanten Schichten)
- **Gelb-Orange:** Überbesetzung oder falsche Qualifikation

Tooltip-Zeilen pro Qualifikation: `buildStaffingEntryTooltipCoverageLines` in `bulk-staffing-header.ts`.

### Server Actions (Muster)

```typescript
"use server";

import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export async function exampleAction() {
  const { organizationId } = await requireManager();
  const db = await getDatabase();
  // ...
  return { ok: true as const, data: ... };
}
```

Fehler: `{ ok: false, error: string }` — im Projekt etabliertes Result-Pattern.

## Lokale Entwicklung

```bash
npm install          # Im Repo-Root
npm run dev:web      # http://localhost:3000
npm run dev:mobile   # Expo
```

Env: `apps/web/.env.local` (siehe `README.md`). Bei React-Duplikat-Fehlern: `apps/web/node_modules` löschen, erneut `npm install` im Root.

## Checkliste vor Abschluss

- [ ] Nur angefragte Dateien geändert?
- [ ] i18n DE + EN bei neuen UI-Strings?
- [ ] DB-Typen/Migration bei Schema-Änderung?
- [ ] Vitest für neue Lib-Logik (wenn sinnvoll)?
- [ ] Keine Secrets (.env) committed?
- [ ] Linter/Tests für betroffene Bereiche grün?

## Weitere Dokumentation

- `README.md` — Setup, Supabase, erste Schritte
- `.cursor/rules/*.mdc` — detaillierte UI-/Code-Regeln
- `.cursor/skills/*/SKILL.md` — spezialisierte Workflows

Bei Unklarheit: **im Code nach ähnlichen Stellen suchen** und dasselbe Muster verwenden — nicht neu erfinden.
