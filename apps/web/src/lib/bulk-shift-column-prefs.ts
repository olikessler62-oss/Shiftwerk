export type BulkShiftSortColumn =
  | "template"
  | "qualification"
  | "startTime"
  | "endTime"
  | "employee";

export type BulkShiftSortDirection = "asc" | "desc";

export type BulkShiftColumnPrefs = {
  sort: {
    column: BulkShiftSortColumn | null;
    direction: BulkShiftSortDirection | null;
  };
  prefill: {
    template: boolean;
    qualification: boolean;
    employee: boolean;
  };
};

export const BULK_SHIFT_COLUMN_PREFS_STORAGE_KEY = "schichtwerk.bulkShiftColumnPrefs";

export const DEFAULT_BULK_SHIFT_COLUMN_PREFS: BulkShiftColumnPrefs = {
  sort: { column: null, direction: null },
  prefill: {
    template: true,
    qualification: true,
    employee: true,
  },
};

function isSortColumn(value: unknown): value is BulkShiftSortColumn {
  return (
    value === "template" ||
    value === "qualification" ||
    value === "startTime" ||
    value === "endTime" ||
    value === "employee"
  );
}

function isSortDirection(value: unknown): value is BulkShiftSortDirection {
  return value === "asc" || value === "desc";
}

export function loadBulkShiftColumnPrefs(): BulkShiftColumnPrefs {
  if (typeof window === "undefined") return DEFAULT_BULK_SHIFT_COLUMN_PREFS;

  try {
    const raw = window.localStorage.getItem(BULK_SHIFT_COLUMN_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_BULK_SHIFT_COLUMN_PREFS;

    const parsed = JSON.parse(raw) as Partial<BulkShiftColumnPrefs>;
    const sortColumn = parsed.sort?.column ?? null;
    const sortDirection = parsed.sort?.direction ?? null;

    return {
      sort: {
        column: isSortColumn(sortColumn) ? sortColumn : null,
        direction:
          sortColumn && isSortDirection(sortDirection) ? sortDirection : null,
      },
      prefill: {
        template:
          parsed.prefill?.template ??
          DEFAULT_BULK_SHIFT_COLUMN_PREFS.prefill.template,
        qualification:
          parsed.prefill?.qualification ??
          DEFAULT_BULK_SHIFT_COLUMN_PREFS.prefill.qualification,
        employee:
          parsed.prefill?.employee ??
          DEFAULT_BULK_SHIFT_COLUMN_PREFS.prefill.employee,
      },
    };
  } catch {
    return DEFAULT_BULK_SHIFT_COLUMN_PREFS;
  }
}

export function saveBulkShiftColumnPrefs(prefs: BulkShiftColumnPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    BULK_SHIFT_COLUMN_PREFS_STORAGE_KEY,
    JSON.stringify(prefs)
  );
}

export function cycleBulkShiftSortPrefs(
  prefs: BulkShiftColumnPrefs,
  column: BulkShiftSortColumn
): BulkShiftColumnPrefs {
  const current = prefs.sort;

  if (current.column !== column) {
    return {
      ...prefs,
      sort: { column, direction: "asc" },
    };
  }

  if (current.direction === "asc") {
    return {
      ...prefs,
      sort: { column, direction: "desc" },
    };
  }

  return {
    ...prefs,
    sort: { column: null, direction: null },
  };
}

export function toggleBulkShiftPrefillColumn(
  prefs: BulkShiftColumnPrefs,
  column: keyof BulkShiftColumnPrefs["prefill"]
): BulkShiftColumnPrefs {
  return {
    ...prefs,
    prefill: {
      ...prefs.prefill,
      [column]: !prefs.prefill[column],
    },
  };
}
