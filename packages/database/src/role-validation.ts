import type { Role, RolePermissionLevel } from "@schichtwerk/types";
import { DEFAULT_ORG_ROLES } from "@schichtwerk/types";

export type RoleUniquenessInput = {
  name: string;
  key?: string;
  excludeId?: string;
};

const SYSTEM_KEYS = new Set(DEFAULT_ORG_ROLES.map((r) => r.key));

export function slugifyRoleKey(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "role";
}

export function validateRoleUniqueness(
  existing: Pick<Role, "id" | "name" | "key">[],
  input: RoleUniquenessInput
): { ok: true } | { ok: false; error: string } {
  const name = input.name.trim();
  const key = input.key?.trim();

  if (!name) {
    return { ok: false, error: "Bitte eine Bezeichnung eingeben." };
  }

  const nameTaken = existing.some(
    (r) =>
      r.id !== input.excludeId &&
      r.name.localeCompare(name, undefined, { sensitivity: "accent" }) === 0
  );
  if (nameTaken) {
    return { ok: false, error: "Diese Bezeichnung existiert bereits." };
  }

  if (key) {
    const keyTaken = existing.some(
      (r) => r.id !== input.excludeId && r.key === key
    );
    if (keyTaken) {
      return { ok: false, error: "Dieser Schlüssel existiert bereits." };
    }
    if (SYSTEM_KEYS.has(key) && !existing.some((r) => r.id === input.excludeId && r.key === key)) {
      const isEditingSystem = existing.some(
        (r) => r.id === input.excludeId && SYSTEM_KEYS.has(r.key)
      );
      if (!isEditingSystem) {
        return { ok: false, error: "Dieser Schlüssel ist reserviert." };
      }
    }
  }

  return { ok: true };
}

export function validateRoleArchive(role: Pick<Role, "is_system" | "key">): {
  ok: true;
} | { ok: false; error: string } {
  if (role.is_system || SYSTEM_KEYS.has(role.key)) {
    return { ok: false, error: "Systemrollen können nicht archiviert werden." };
  }
  return { ok: true };
}

export function isValidPermissionLevel(
  value: string
): value is RolePermissionLevel {
  return value === "admin" || value === "manager" || value === "basic";
}
