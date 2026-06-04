# @schichtwerk/database

**Einzige SQL-Quelle:** [`schema.sql`](./schema.sql)

Der gesamte App-Code (Web, Mobile, Scripts) nutzt nur die TypeScript-Schnittstelle `SchichtwerkDatabase` — keine direkten Tabellenzugriffe außerhalb des Supabase-Adapters.

## Datenbankwechsel

1. `schema.sql` für die neue Datenbank anpassen oder übersetzen
2. Neuen Adapter unter `src/adapters/` implementieren (`implements SchichtwerkDatabase`)
3. Factory in `src/index.ts` auf den neuen Adapter umstellen

## Schema anwenden (Supabase)

Dashboard → SQL → Inhalt von `schema.sql` einfügen → Run

## Nutzung in der Web-App

```ts
import { getDatabase, getAdminDatabase } from "@schichtwerk/database";

const db = await getDatabase();
const types = await db.loadShiftTypesWithBreaks(orgId);
```

## Nutzung in der Mobile-App

```ts
import { getDatabase } from "@/lib/db";

const db = getDatabase();
const profile = await db.getCurrentUserProfile();
const shifts = await db.listMyShifts(from, to);
```

Supabase-Verbindung (SecureStore) liegt in `apps/mobile/lib/supabase.ts` — nur Infrastruktur, kein Schema-SQL.
```
