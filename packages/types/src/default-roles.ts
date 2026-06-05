export type RolePermissionLevel = "admin" | "manager" | "basic";

export type DefaultOrgRole = {
  key: string;
  name: string;
  permission_level: RolePermissionLevel;
  is_system: boolean;
  sort_order: number;
};

export const DEFAULT_ORG_ROLES: DefaultOrgRole[] = [
  {
    key: "admin",
    name: "Administrator",
    permission_level: "admin",
    is_system: true,
    sort_order: 0,
  },
  {
    key: "manager",
    name: "Manager",
    permission_level: "manager",
    is_system: true,
    sort_order: 1,
  },
  {
    key: "basic",
    name: "Mitarbeiter",
    permission_level: "basic",
    is_system: true,
    sort_order: 2,
  },
];
