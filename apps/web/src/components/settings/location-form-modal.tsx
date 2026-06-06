"use client";

import { useState, useTransition } from "react";
import { createLocation, updateLocation } from "@/app/actions/locations";
import {
  validateLocationInput,
  validateLocationUniqueness,
} from "@schichtwerk/database";
import type { Location } from "@schichtwerk/types";
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
  location?: Location;
  existingLocations: Location[];
  onClose: () => void;
  onSaved: (createdId?: string) => void;
};

export function LocationFormModal({
  mode,
  location,
  existingLocations,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(location?.name ?? "");

  function handleSubmit() {
    setError(null);
    const payload = { name: name.trim() };

    const validated = validateLocationInput(payload);
    if (!validated.ok) {
      setError(validated.error);
      return;
    }

    const unique = validateLocationUniqueness(existingLocations, {
      name: validated.data.name,
      excludeId: mode === "edit" ? location?.id : undefined,
    });
    if (!unique.ok) {
      setError(unique.error);
      return;
    }

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createLocation(validated.data)
          : await updateLocation({ id: location!.id, ...validated.data });

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
        aria-labelledby="location-form-title"
        className="relative z-[71] flex max-h-[min(90vh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 id="location-form-title" className={SETTINGS_MODAL_TITLE_CLASS}>
            {mode === "create"
              ? t("locations.createTitle")
              : t("locations.editTitle")}
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

        <div className="space-y-5 overflow-y-auto px-5 py-4">
          {error && <Alert variant="error">{error}</Alert>}

          <div>
            <LabelMuted>{t("locations.siteName")}</LabelMuted>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={25}
              placeholder={t("locations.siteNamePlaceholder")}
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
