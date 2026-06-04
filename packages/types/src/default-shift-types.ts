/** Standard-Schichttypen beim Anlegen eines Betriebs */
export const DEFAULT_SHIFT_TYPES = [
  {
    name: "Frühschicht",
    color: "#F59E0B",
    start_time: "06:00:00",
    end_time: "14:00:00",
    sort_order: 0,
  },
  {
    name: "Spätschicht",
    color: "#6366F1",
    start_time: "14:00:00",
    end_time: "22:00:00",
    sort_order: 1,
  },
  {
    name: "Nachtschicht",
    color: "#475569",
    start_time: "22:00:00",
    end_time: "06:00:00",
    sort_order: 2,
  },
] as const;
