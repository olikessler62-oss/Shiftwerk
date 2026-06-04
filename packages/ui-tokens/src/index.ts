/** Shared design tokens for Web + Mobile */
export const colors = {
  primary: "#0D9488",
  primaryForeground: "#FFFFFF",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  foreground: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  destructive: "#DC2626",
  warning: "#D97706",
  success: "#16A34A",
} as const;

export const shiftColors = {
  early: "#F59E0B",
  late: "#6366F1",
  night: "#475569",
  off: "#94A3B8",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
} as const;
