# Schichtwerk

Schichtplanung für Teams bis 20 Personen — **Web** für Inhaber/Manager, **Mobile** (iOS & Android) für Mitarbeiter.

## Projektstruktur

```
schichtwerk/
├── apps/
│   ├── web/          # Next.js — Dashboard & Planung
│   └── mobile/       # Expo — Mitarbeiter-App (nutzt @schichtwerk/database)
├── packages/
│   ├── types/        # Gemeinsame TypeScript-Typen
│   ├── database/     # **Einzige SQL-Datei** + Schnittstelle SchichtwerkDatabase
│   ├── api-client/   # Supabase-Helfer
│   └── ui-tokens/    # Farben & Abstände (Web + Mobile)
└── supabase/         # Nur Supabase-CLI-Konfiguration (kein Schema mehr hier)
```

## Hinweis Monorepo

Falls der Web-Build mit `useContext`-Fehlern abbricht, liegt oft ein **doppeltes React** in `apps/web/node_modules` vor. Ordner löschen und erneut `npm install` im Projektroot ausführen.

## Voraussetzungen

- Node.js 20+
- Supabase-Projekt (leer → Migration ausführen)
- Optional: [Expo Go](https://expo.dev/go) auf dem Handy zum Testen

## 1. Supabase einrichten

1. Im [Supabase Dashboard](https://supabase.com/dashboard) → **SQL Editor**
2. Inhalt von `packages/database/schema.sql` einfügen und ausführen (einzige SQL-Quelle im Repo)
3. **Authentication** → **Providers** → E-Mail aktivieren
4. Für lokale Entwicklung: **Authentication** → **Sign In / Providers** → E-Mail → **Confirm email** deaktivieren (sonst schlägt die Registrierung beim Anlegen von Organisation/Profil fehl, bis die E-Mail bestätigt ist)
5. **Authentication** → **URL Configuration** → Site URL: `http://localhost:3000`, Redirect URLs: `http://localhost:3000/auth/callback`

## 2. Umgebungsvariablen

Kopiere `.env.example` nach `apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Pflicht für Mitarbeiter-Einladungen
SUPERADMIN_EMAILS=deine@email.de   # Nur diese E-Mail(s) sehen den Menüpunkt Superadmin
```

Für Mobile `apps/mobile/.env` (optional — liest sonst automatisch `apps/web/.env.local`):

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## 3. Installation & Start

```bash
npm install
npm run dev:web      # http://localhost:3000
npm run dev:mobile   # Expo — QR-Code scannen
```

Oder alles parallel:

```bash
npm run dev
```

## Erste Schritte

1. **Web:** `/register` — Betrieb anlegen; es werden automatisch **Früh-, Spät- und Nachtschicht** angelegt
2. Nach Login → **Dashboard** unter `/dashboard`
3. **Profile:** Dashboard → Einstellungen → Profile — Mitarbeiter anlegen oder per E-Mail einladen (benötigt `SUPABASE_SERVICE_ROLE_KEY` + E-Mail-Versand in Supabase)
4. **Planung:** `/planung` — Wochenkalender: Zelle `+` → Schichttyp wählen; farbige Zelle entfernen
5. **App:** Mitarbeiter melden sich mit Einladungs-E-Mail und gesetztem Passwort an

### Supabase für Einladungen & Passwort-Reset

- **Project Settings → API** → `service_role` in `apps/web/.env.local`
- **Authentication → Email** → SMTP konfigurieren oder Supabase-Mail nutzen
- **Authentication → URL Configuration** → Redirect URLs um `…/auth/callback` ergänzen (für Einladungen und „Passwort vergessen“)
- Einladungs-Link führt zunächst ins Web (`/auth/callback`); Mitarbeiter loggen sich danach in der **App** ein
- **Passwort vergessen:** `/login` → Link → E-Mail mit Reset-Link → `/reset-password`
- **Security Linter:** Migration `packages/database/migrations/20250617_security_linter_fixes.sql` in Supabase ausführen; unter **Authentication → Email** *Prevent use of leaked passwords* aktivieren

Mitarbeiter mit Rolle `employee`, die sich am Web anmelden, werden nach `/app-only` umgeleitet.

## Scripts

| Befehl | Beschreibung |
|--------|----------------|
| `npm run dev` | Turbo: Web + Mobile |
| `npm run dev:web` | Nur Next.js |
| `npm run dev:mobile` | Nur Expo |
| `npm run build` | Production-Build Web |

## Nächste Features

- [x] Team anlegen + Supabase Invite (Service Role)
- [x] Wochenkalender / Planung
- [x] Schichttypen-Seed bei Registrierung
- [ ] Verfügbarkeit & Tausch in der App
- [ ] Push (Expo Notifications)
- [ ] Drag & Drop im Kalender

## Lizenz

Privates Projekt — BOOTCAMP.
