# Responsive Layout — Rollback-Referenz

Stand: Juni 2025. Bei Bedarf die unten genannten **Originalwerte** wiederherstellen
(oder `git checkout --` auf die betroffenen Dateien).

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/app/layout.tsx` | `viewport` export |
| `src/components/areacalendar/app-shell.tsx` | Mobile Top-Bar, Padding, **Mobile-Scroll (Jun 2025)** |
| `src/lib/app-shell-layout.ts` | **Mobile-Scroll-Klassen (max-md only)** |
| `src/components/dashboard/dashboard-view.tsx` | Negative Margins / Höhe, **Mobile-Scroll** |
| `src/components/areacalendar/areacalendar-view.tsx` | **Mobile-Scroll / Legend-Stack** |

**Nicht geändert (bewusst):** `dashboard-calendar.tsx` — Grid, minWidth, Scroll-Verhalten.

---

## Originalwerte

### `app-shell.tsx`

```tsx
// Root
<div className="flex h-dvh min-h-0 overflow-hidden">

// Sidebar
className="relative flex w-56 shrink-0 flex-col border-r border-border bg-surface"

// Main
<main className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
```

### `dashboard-view.tsx`

```tsx
<div className="-mx-6 -mt-6 -mb-6 flex h-[calc(100%+48px)] min-h-0 flex-col bg-background pb-[10px]">
<section className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-4">
```

### `dashboard-header.tsx`

```tsx
<header className="flex h-20 max-h-20 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-6">

// Wochenanzeige
"!w-[340px] shrink-0 justify-center px-2 py-0"

// Standort
<div className="ml-5 flex shrink-0 items-center gap-3">
// LocationSelect
className="!mt-0 w-[11rem] shrink-0 font-semibold"
```

### `dashboard-view.tsx`

```tsx
<div className="-m-6 flex min-h-[calc(100vh-4.5rem)] flex-col bg-subtle">
<header className="border-b border-border bg-surface px-6 py-5">
// Main layout
<div className="flex flex-1 gap-0 overflow-hidden">
<aside className="w-56 shrink-0 overflow-y-auto border-r border-border bg-surface p-4">
<aside className="w-72 shrink-0 overflow-y-auto border-l border-border bg-surface p-4">
```

### `layout.tsx`

Kein `export const viewport` (Next.js-Default).

---

## Schnell zurücksetzen

```powershell
git checkout -- apps/web/src/app/layout.tsx `
  apps/web/src/components/dashboard/app-shell.tsx `
  apps/web/src/components/dashboard/dashboard-view.tsx `
  apps/web/src/components/dashboard/dashboard-header.tsx `
  apps/web/src/components/dashboard/dashboard-view.tsx
Remove-Item apps/web/RESPONSIVE_ROLLBACK.md
```
