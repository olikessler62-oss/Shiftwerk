"use client";

import { useState, useTransition } from "react";
import { createRole, updateRole } from "@/app/actions/roles";
import { validateRoleUniqueness } from "@schichtwerk/database";
import type { Role, RolePermissionLevel } from "@schichtwerk/types";
import { useTranslations } from "@/i18n/locale-provider";
import { MODAL_SCROLLBAR_CLASS, SETTINGS_MODAL_TITLE_CLASS } from "./settings-list-ui";
import { cn } from "@/lib/cn";
import {
  Alert,
  Button,
  CheckIcon,
  CloseIcon,
  IconButton,
  Input,
  LabelMuted,
  Select,
} from "@/components/ui";

type Props = {
  mode: "create" | "edit";
  role?: Role;
  existingRoles: Role[];
  onClose: () => void;
  onSaved: (createdId?: string) => void;
};

const PERMISSION_LEVELS: RolePermissionLevel[] = ["admin", "manager", "basic"];

export function RoleFormModal({
  mode,
  role,
  existingRoles,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(role?.name ?? "");
  const [permissionLevel, setPermissionLevel] = useState<RolePermissionLevel>(
    role?.permission_level ?? "basic"
  );

  const isSystemRole = mode === "edit" && !!role?.is_system;

  function permissionLabel(level: RolePermissionLevel): string {
    if (level === "admin") return t("roles.permissionAdmin");
    if (level === "manager") return t("roles.permissionManager");
    return t("roles.permissionBasic");
  }

  function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError(t("roles.enterDesignation"));
      return;
    }

    const unique = validateRoleUniqueness(existingRoles, {
      name: name.trim(),
      excludeId: mode === "edit" ? role?.id : undefined,
    });
    if (!unique.ok) {
      setError(unique.error);
      return;
    }

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createRole({
              name: name.trim(),
              permission_level: permissionLevel,
            })
          : await updateRole({
              id: role!.id,
              name: name.trim(),
              permission_level: isSystemRole ? undefined : permissionLevel,
            });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved(mode === "create" ? result.id : undefined);
      onClose();
    });
  }

  return (
    <div
      className="absolute inset-0 z-[70] flex items-center justify-center rounded-2xl bg-black/30 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-form-title"
        className={cn(
          "relative z-[71] flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl",
          MODAL_SCROLLBAR_CLASS
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 id="role-form-title" className={SETTINGS_MODAL_TITLE_CLASS}>
            {mode === "create" ? t("roles.createTitle") : t("roles.editTitle")}
          </h3>
          <IconButton
            size="sm"
            onClick={onClose}
            disabled={pending}
            aria-label={t("common.close")}
            className="border-transparent bg-transparent hover:bg-subtle"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        <div className="space-y-5 px-5 py-4">
          {error && <Alert variant="error">{error}</Alert>}

          <div>
            <LabelMuted>{t("roles.designation")}</LabelMuted>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("roles.designationPlaceholder")}
            />
          </div>

          <div>
            <LabelMuted>{t("roles.permission")}</LabelMuted>
            {isSystemRole ? (
              <p className="mt-1 rounded-[var(--radius-control)] border border-border bg-subtle px-3 py-2 text-sm text-foreground">
                {permissionLabel(role!.permission_level)}
              </p>
            ) : (
              <Select
                value={permissionLevel}
                onChange={(e) =>
                  setPermissionLevel(e.target.value as RolePermissionLevel)
                }
              >
                {PERMISSION_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {permissionLabel(level)}
                  </option>
                ))}
              </Select>
            )}
            {isSystemRole && (
              <p className="mt-1 text-xs text-muted">{t("roles.systemPermissionHint")}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            <CloseIcon />
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="primary" onClick={handleSubmit} disabled={pending}>
            <CheckIcon />
            {t("common.ok")}
          </Button>
        </div>
      </div>
    </div>
  );
}
