# Supabase-Konfiguration

**Das Datenbankschema liegt nicht mehr hier**, sondern ausschließlich in:

[`packages/database/schema.sql`](../packages/database/schema.sql)

Alle App-Zugriffe laufen über `@schichtwerk/database` (TypeScript-Schnittstelle `SchichtwerkDatabase`).

Dieser Ordner enthält nur noch Supabase-CLI-/Projekt-Konfiguration (`config.toml`).
