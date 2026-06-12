# Arbeitszeit-Compliance pro Land

Jedes Land hat eine Markdown-Datei (`germany.md`, `austria.md`, …). Die Datei besteht aus zwei Teilen:

1. **YAML-Frontmatter** (`---` … `---`) — maschinenlesbare Regeln für Validierung in Schichtplanung, Verfügbarkeiten, Schichtvorlagen und Personalbedarf
2. **Markdown-Text** — menschenlesbare Erläuterung, Rechtsgrundlagen und Ausnahmen

## Dateiname und Zuordnung

| Datei         | `countryCode` | Hinweis                          |
|---------------|---------------|----------------------------------|
| `germany.md`  | `DE`          | Deutschland (ArbZG)              |

Später wird beim Anlegen der Organisation ein Land gewählt; der Code lädt dann `compliances/{id}.md` über `@schichtwerk/compliance`.

## Regel-Schema (Frontmatter)

```yaml
meta:
  id: germany              # Datei-ID ohne .md
  countryCode: DE          # ISO 3166-1 alpha-2
  jurisdiction: Deutschland
  legalBasis: [ArbZG]
  locale: de
  version: "2025-06-01"    # Stand der Regeln

rules:
  - id: eindeutige_regel_id
    type: <regeltyp>
    severity: error | warning | info
    enforceAt:
      - shift_template    # Schichtvorlagen
      - shift_assign      # Schichtplan / Zuweisung
      - availability      # Verfügbarkeitszeiten
      - staffing          # Personalbedarf
    # … typspezifische Felder
```

### Regeltypen

| `type`                    | Zweck |
|---------------------------|--------|
| `max_shift_duration`      | Maximale Schichtdauer an Werktagen (z. B. 8 h) |
| `rolling_average_hours`   | Vorübergehend höhere Tageshöchstzeit mit Durchschnittsgrenze |
| `break_duration_tiers`    | Pausenpflicht nach Schichtlänge |
| `min_rest_period`         | Mindestruhezeit zwischen zwei Schichten |
| `restricted_work_days`    | Sonntags-/Feiertagsarbeit |
| `night_work`              | Nachtarbeit, Begrenzung und Ausgleich |

### Severity

- **error** — Speichern/Zuweisen blockieren (harte Grenze)
- **warning** — Hinweis; Ausnahmen brauchen ggf. manuelle Freigabe
- **info** — Nur Anzeige / Dokumentation

## Einbindung im Code

```typescript
import { loadCompliance, getRule } from "@schichtwerk/compliance";
// Markdown vom Dateisystem (nur Node.js):
import { parseComplianceMarkdown } from "@schichtwerk/compliance/node";
```

Validatoren in `@schichtwerk/database` können schrittweise von fest codierten Werten (z. B. Pausenregeln) auf die Compliance-Regeln umgestellt werden, sobald `organizations.country_code` existiert.

## Neue Länder anlegen

1. `compliances/{land}.md` nach Vorlage von `germany.md` erstellen
2. Frontmatter mit korrektem `countryCode` ausfüllen
3. `npm run lint --workspace=@schichtwerk/compliance` ausführen
