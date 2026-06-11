"use client";

import { useState, useTransition } from "react";
import { assignAreaQualificationTemplate } from "@/app/actions/area-qualification-templates";
import type { Qualification } from "@schichtwerk/types";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  settingsModalBodyPaddingClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsNestedModalDialogClass,
  settingsNestedModalOverlayClass,
} from "./settings-list-ui";
import {
  Alert,
  Button,
  CheckIcon,
  CloseIcon,
  IconButton,
  LabelMuted,
} from "@/components/ui";

type Props = {
  locationId: string;
  locationAreaId: string;
  availableQualifications: Qualification[];
  onClose: () => void;
  onSaved: () => void;
};

export function AreaQualificationTemplateFormModal({
  locationId,
  locationAreaId,
  availableQualifications,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [qualificationId, setQualificationId] = useState(
    () => availableQualifications[0]?.id ?? ""
  );

  function handleSubmit() {
    setError(null);
    if (!qualificationId) {
      setError(t("profiles.selectQualificationRequired"));
      return;
    }

    startTransition(async () => {
      const result = await assignAreaQualificationTemplate({
        locationId,
        locationAreaId,
        qualificationId,
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
      className={settingsNestedModalOverlayClass()}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="area-qualification-template-form-title"
        className={settingsNestedModalDialogClass("md")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "flex items-center justify-between border-b border-border",
            settingsModalHeaderPaddingClass()
          )}
        >
          <h3
            id="area-qualification-template-form-title"
            className={SETTINGS_MODAL_TITLE_CLASS}
          >
            {t("locations.areaQualificationTemplatesCreateTitle")}
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

        <div className={cn("space-y-4", settingsModalBodyPaddingClass())}>
          {error && <Alert variant="error">{error}</Alert>}

          <div>
            <LabelMuted>{t("profiles.columnQualification")}</LabelMuted>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={qualificationId}
              disabled={pending || availableQualifications.length === 0}
              onChange={(e) => setQualificationId(e.target.value)}
            >
              {availableQualifications.map((qualification) => (
                <option key={qualification.id} value={qualification.id}>
                  {qualification.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={settingsModalFooterClass()}>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            <CloseIcon />
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={pending || !qualificationId}
          >
            <CheckIcon />
            {t("common.ok")}
          </Button>
        </div>
      </div>
    </div>
  );
}
