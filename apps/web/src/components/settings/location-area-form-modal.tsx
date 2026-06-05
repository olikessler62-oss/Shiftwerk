"use client";

import { useState, useTransition } from "react";
import {
  createLocationArea,
  updateLocationArea,
} from "@/app/actions/location-areas";
import {
  validateLocationAreaName,
  validateLocationAreaUniqueness,
} from "@schichtwerk/database";
import type { LocationArea } from "@schichtwerk/types";
import { useTranslations } from "@/i18n/locale-provider";
import { SETTINGS_MODAL_TITLE_CLASS } from "./settings-list-ui";
import {
  Alert,
  Button,
  CheckIcon,
  CloseIcon,
  IconButton,
  Input,
  LabelMuted,
} from "@/components/ui";

type Props = {
  mode: "create" | "edit";
  locationId: string;
  area?: LocationArea;
  existingAreas: LocationArea[];
  onClose: () => void;
  onSaved: () => void;
};

export function LocationAreaFormModal({
  mode,
  locationId,
  area,
  existingAreas,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(area?.name ?? "");

  function handleSubmit() {
    setError(null);
    const nameCheck = validateLocationAreaName(name);
    if (!nameCheck.ok) {
      setError(nameCheck.error);
      return;
    }

    const unique = validateLocationAreaUniqueness(existingAreas, {
      name: nameCheck.value,
      excludeId: mode === "edit" ? area?.id : undefined,
    });
    if (!unique.ok) {
      setError(unique.error);
      return;
    }

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createLocationArea({ locationId, name: nameCheck.value })
          : await updateLocationArea({
              id: area!.id,
              locationId,
              name: nameCheck.value,
            });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
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
        aria-labelledby="location-area-form-title"
        className="relative z-[71] flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3
            id="location-area-form-title"
            className={SETTINGS_MODAL_TITLE_CLASS}
          >
            {mode === "create"
              ? t("locations.areaCreateTitle")
              : t("locations.areaEditTitle")}
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
            <LabelMuted>{t("locations.areaName")}</LabelMuted>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={25}
              placeholder={t("locations.areaNamePlaceholder")}
            />
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
