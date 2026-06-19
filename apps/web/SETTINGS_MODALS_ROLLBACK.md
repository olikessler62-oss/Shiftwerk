# Einstellungs-Modale auf aktueller Seite — Rollback

Seit dieser Änderung öffnen sich Einstellungs-Modale über dem **aktuellen** Hintergrund (Dashboard, Schichtplan erstellen, …) statt immer über dem Dashboard-Kalender.

## Schnell zurück zum alten Verhalten

1. In `apps/web/src/lib/settings-modal-config.ts` setzen:
   ```ts
   export const SETTINGS_MODALS_ON_CURRENT_PAGE = false;
   ```
2. Optional: `SettingsModalsLayer` aus `dashboard-view.tsx` und `SettingsModalsAppShellFallback` aus `app-shell.tsx` entfernen (bei `false` reicht Schritt 1 — Sidebar und Schließen-Logik leiten wieder nach `/dashboard`).

## Betroffene Dateien

- `src/lib/settings-modal-config.ts` — Feature-Flag
- `src/lib/settings-modal-navigation.ts` — URL bauen / schließen
- `src/components/settings/settings-modals-layer.tsx` — gemeinsame Modal-Schicht
- `src/components/dashboard/dashboard-view.tsx` — nutzt Layer statt Inline-Modals
- `src/components/dashboard/dashboard-view.tsx` — Layer auf Planung
- `src/components/dashboard/sidebar-nav.tsx` — Links behalten aktuelle Route
- `src/components/dashboard/app-shell.tsx` — Fallback für andere Seiten (z. B. Berichte)
- `src/app/actions/settings-modals-data.ts` — Lazy-Laden für Fallback
- `src/app/(manager)/planung/page.tsx` — Settings-Daten bei geöffnetem Modal
