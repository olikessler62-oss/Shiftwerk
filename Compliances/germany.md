---
meta:
  id: germany
  countryCode: DE
  jurisdiction: Deutschland
  legalBasis:
    - ArbZG
  locale: de
  version: "2025-06-01"

rules:
  - id: standard_workday_max_hours
    type: max_shift_duration
    severity: error
    enforceAt:
      - shift_template
      - shift_assign
      - availability
      - staffing
    maxHours: 8
    workdayDefinition: mon_sat
    weekdays: [1, 2, 3, 4, 5, 6]

  - id: extended_workday_with_average
    type: rolling_average_hours
    severity: warning
    enforceAt:
      - shift_assign
      - shift_template
    temporaryMaxHours: 10
    averageMaxHoursPerWorkday: 8
    windowWeeks: 24
    workdayDefinition: mon_sat

  - id: break_requirements
    type: break_duration_tiers
    severity: error
    enforceAt:
      - shift_template
      - shift_assign
    tiers:
      - fromHours: 9
        requiredBreakMinutes: 45
        minBreakSegmentMinutes: 15
      - fromHours: 6
        upToHours: 9
        requiredBreakMinutes: 30
        minBreakSegmentMinutes: 15
      - upToHours: 6
        requiredBreakMinutes: 0

  - id: min_rest_between_shifts
    type: min_rest_period
    severity: error
    enforceAt:
      - shift_assign
      - availability
    minHours: 11

  - id: sunday_holiday_work
    type: restricted_work_days
    severity: warning
    enforceAt:
      - shift_assign
      - shift_template
      - staffing
    restrictedWeekdays: [0]
    publicHolidaysRestricted: true
    defaultAllowed: false
    requiresSubstituteRestDay: true
    exceptionIndustries:
      - gastronomy
      - healthcare
      - police
      - emergency_services

  - id: night_work
    type: night_work
    severity: warning
    enforceAt:
      - shift_template
      - shift_assign
      - availability
    nightStartHour: 23
    nightEndHour: 6
    maxShiftHoursUnlessCompensated: 8
    compensationRequired: substitute_days_or_surcharge
    industryOverrides:
      - industry: bakery
        nightStartHour: 22
---

# Deutschland — Arbeitszeit (ArbZG)

Kurzfassung der wichtigsten arbeitszeitrechtlichen Vorgaben für Schichtplanung, Verfügbarkeiten, Schichtvorlagen und Personalbedarf.

## Regelarbeitszeit

Die **reguläre Arbeitszeit** beträgt werktäglich (**Montag bis Samstag**) maximal **8 Stunden** pro Tag.

→ Regel `standard_workday_max_hours` (`max_shift_duration`, severity: **error**)

## Maximale Arbeitszeit (vorübergehend)

Die Tagesarbeitszeit kann **vorübergehend auf bis zu 10 Stunden** verlängert werden, wenn innerhalb von **6 Monaten (24 Wochen)** im Durchschnitt **8 Stunden pro Werktag** nicht überschritten werden.

→ Regel `extended_workday_with_average` (`rolling_average_hours`, severity: **warning** — erfordert Auswertung über mehrere Wochen pro Mitarbeiter)

## Pausen

| Schichtdauer | Pause |
|--------------|-------|
| bis 6 Stunden | keine gesetzliche Mindestpause |
| **mehr als 6 Stunden** | **30 Minuten** |
| **ab 9 Stunden** | **45 Minuten** insgesamt |

Pausen dürfen in Abschnitte von **mindestens 15 Minuten** unterteilt werden.

→ Regel `break_requirements` (`break_duration_tiers`, severity: **error**)

## Ruhezeit

Zwischen Feierabend und dem nächsten Arbeitsbeginn müssen mindestens **11 Stunden** ununterbrochene Ruhezeit liegen.

→ Regel `min_rest_between_shifts` (`min_rest_period`, severity: **error**)

## Sonntags- und Feiertagsarbeit

Grundsätzlich **verboten**; zahlreiche Ausnahmen (u. a. Gastronomie, Gesundheitswesen, Polizei). In Ausnahmefällen ist ein **Ersatzruhetag** zu gewähren.

→ Regel `sunday_holiday_work` (`restricted_work_days`, severity: **warning**)

## Nachtarbeit

**Nachtarbeit** ist Arbeit zwischen **23 und 6 Uhr** (in **Bäckereien ab 22 Uhr**). Die Arbeitszeit kann auf **8 Stunden** begrenzt werden, sofern sie nicht ausgeglichen wird. Nachtarbeitende haben Anspruch auf **besondere Ausgleichstage oder Zuschläge**.

→ Regel `night_work` (`night_work`, severity: **warning**)

## Hinweise zur Umsetzung in Schichtwerk

| Bereich | Relevante Regeln |
|---------|------------------|
| Schichtvorlagen | max. 8 h, Pausen, Nachtarbeit, Sonntag/Feiertag |
| Schichtzuweisung / Planung | alle Regeln inkl. Ruhezeit 11 h und 10-h-Durchschnitt |
| Verfügbarkeitszeiten | max. 8 h pro Block, Ruhezeit, Nachtfenster |
| Personalbedarf | keine Planung an gesperrten Tagen ohne Ausnahme |

**Rechtsgrundlage:** [Arbeitszeitgesetz (ArbZG)](https://www.gesetze-im-internet.de/arbzg/)
