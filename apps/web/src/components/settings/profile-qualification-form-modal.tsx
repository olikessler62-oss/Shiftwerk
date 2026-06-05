"use client";

import { useState, useTransition } from "react";
import {
  assignProfileQualification,
  removeProfileQualification,
} from "@/app/actions/profile-qualifications";
import type { Qualification } from "@schichtwerk/types";
import { useTranslations } from "@/i18n/locale-provider";
import { SETTINGS_MODAL_TITLE_CLASS } from "./settings-list-ui";
import {
  Alert,
  Button,
  CheckIcon,
  CloseIcon,
  IconButton,
  LabelMuted,
} from "@/components/ui";

type Props = {
  mode: "create" | "edit";
  profileId: string;
  currentQualification?: Qualification;
  availableQualifications: Qualification[];
  onClose: () => void;
  onSaved: (
    qualifications: Qualification[],
    assignedQualificationId: string
  ) => void;
};

export function ProfileQualificationFormModal({
  mode,
  profileId,
  currentQualification,
  availableQualifications,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [qualificationId, setQualificationId] = useState(
    () => currentQualification?.id ?? availableQualifications[0]?.id ?? ""
  );

  function handleSubmit() {
    setError(null);
    if (!qualificationId) {
      setError(t("profiles.selectQualificationRequired"));
      return;
    }

    startTransition(async () => {
      if (
        mode === "edit" &&
        currentQualification &&
        qualificationId !== currentQualification.id
      ) {
        const removeResult = await removeProfileQualification({
          profileId,
          qualificationId: currentQualification.id,
        });
        if (!removeResult.ok) {
          setError(removeResult.error);
          return;
        }
      }

      if (
        mode === "create" ||
        (mode === "edit" &&
          currentQualification &&
          qualificationId !== currentQualification.id)
      ) {
        const assignResult = await assignProfileQualification({
          profileId,
          qualificationId,
        });
        if (!assignResult.ok) {
          setError(assignResult.error);
          return;
        }
        onSaved(assignResult.qualifications ?? [], qualificationId);
        onClose();
        return;
      }

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
        aria-labelledby="profile-qualification-form-title"
        className="relative z-[71] flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3
            id="profile-qualification-form-title"
            className={SETTINGS_MODAL_TITLE_CLASS}
          >
            {mode === "create"
              ? t("profiles.assignCreateTitle")
              : t("profiles.assignEditTitle")}
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

        <div className="space-y-4 px-5 py-4">
          {error && <Alert variant="error">{error}</Alert>}

          <div>
            <LabelMuted>{t("profiles.columnQualification")}</LabelMuted>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={qualificationId}
              disabled={pending || availableQualifications.length === 0}
              onChange={(e) => setQualificationId(e.target.value)}
            >
              {availableQualifications.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
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
