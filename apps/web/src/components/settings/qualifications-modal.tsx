"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteQualification } from "@/app/actions/qualifications";
import type { Qualification } from "@schichtwerk/types";
import { QualificationFormModal } from "./qualification-form-modal";
import {
  Alert,
  Button,
  CloseIcon,
  IconButton,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";

type Props = {
  qualifications: Qualification[];
  onClose: () => void;
};

type FormMode =
  | null
  | { type: "create" }
  | { type: "edit"; qualification: Qualification };

/** Kopfzeile + max. 6 Datenzeilen; bei wenig Viewport-Höhe früher scrollen */
const LIST_SCROLL_MAX_CLASS =
  "max-h-[min(calc(1.75rem+12rem),calc(100dvh-18rem))] overflow-y-auto";

export function QualificationsModal({ qualifications, onClose }: Props) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [list, setList] = useState(qualifications);
  const [selectedId, setSelectedId] = useState<string | null>(
    qualifications[0]?.id ?? null
  );
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setList(qualifications);
    setSelectedId((current) => {
      if (current && qualifications.some((q) => q.id === current)) return current;
      return qualifications[0]?.id ?? null;
    });
  }, [qualifications]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (formMode) {
        setFormMode(null);
        return;
      }
      if (confirmDelete) {
        setConfirmDelete(false);
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDelete, formMode, onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const selected = list.find((q) => q.id === selectedId);

  function refreshList() {
    router.refresh();
  }

  function openEdit(qualification: Qualification) {
    setFormMode({ type: "edit", qualification });
    setConfirmDelete(false);
    setErrorMessage(null);
  }

  function handleDelete() {
    if (!selected) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteQualification(selected.id);
      if (!result.ok) {
        setErrorMessage(result.error);
        setConfirmDelete(false);
        return;
      }
      setList((prev) => {
        const remaining = prev.filter((q) => q.id !== selected.id);
        setSelectedId(remaining[0]?.id ?? null);
        return remaining;
      });
      setConfirmDelete(false);
      refreshList();
    });
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/25 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !formMode && !confirmDelete) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qualifications-modal-title"
          aria-hidden={!!formMode}
          className={cn(
            "flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl",
            formMode ? "pointer-events-none" : ""
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2
              id="qualifications-modal-title"
              className="text-lg font-semibold text-foreground"
            >
              {t("qualifications.title")}
            </h2>
            <IconButton
              size="sm"
              onClick={onClose}
              aria-label={t("common.close")}
              className="border-transparent bg-transparent hover:bg-subtle"
            >
              <CloseIcon className="h-[18px] w-[18px]" />
            </IconButton>
          </div>

          {errorMessage && (
            <div className="mx-6 mt-4 shrink-0">
              <Alert variant="error">{errorMessage}</Alert>
            </div>
          )}

          <div className="bg-background px-6 py-4">
            <div className="flex flex-col overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60">
              <h3 className="shrink-0 border-b border-border bg-subtle px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-foreground">
                {t("qualifications.column")}
              </h3>

              <div className={cn("bg-background px-2 py-2", LIST_SCROLL_MAX_CLASS)}>
                <div className="min-w-0 rounded-md border border-border bg-surface">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-subtle text-center">
                        <th className="px-2 pb-2 text-xs font-semibold text-muted">
                          {t("qualifications.designation")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.length === 0 ? (
                        <tr>
                          <td className="py-8 text-center text-muted">
                            {t("qualifications.emptyList")}
                          </td>
                        </tr>
                      ) : (
                        list.map((item) => {
                          const isSelected = item.id === selectedId;
                          return (
                            <tr
                              key={item.id}
                              onClick={() => {
                                setSelectedId(item.id);
                                setConfirmDelete(false);
                                setErrorMessage(null);
                              }}
                              onDoubleClick={(e) => {
                                e.preventDefault();
                                window.getSelection()?.removeAllRanges();
                                openEdit(item);
                              }}
                              className={cn(
                                "h-9 cursor-pointer select-none border-b border-border last:border-0",
                                isSelected
                                  ? "bg-subtle ring-1 ring-inset ring-border"
                                  : "hover:bg-hover"
                              )}
                            >
                              <td
                                className={cn(
                                  "h-9 border-l-4 px-2 py-0 text-center font-medium text-foreground",
                                  isSelected
                                    ? "border-l-foreground"
                                    : "border-l-transparent"
                                )}
                              >
                                {item.name}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {confirmDelete && selected && (
                <div className="mx-2 mb-1 rounded-[var(--radius-control)] border border-border bg-subtle px-3 py-2 text-sm">
                  <span className="block text-center">
                    <strong>{selected.name}</strong> {t("qualifications.confirmDelete")}
                  </span>
                  <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 gap-1 whitespace-nowrap px-2 text-xs"
                      disabled={pending}
                      onClick={() => setConfirmDelete(false)}
                    >
                      <CloseIcon />
                      {t("qualifications.no")}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      className="h-7 shrink-0 gap-1 whitespace-nowrap px-2 text-xs"
                      disabled={pending}
                      onClick={handleDelete}
                    >
                      <TrashIcon />
                      {t("qualifications.yesDelete")}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex shrink-0 flex-wrap items-center justify-start gap-1.5 border-t border-border bg-subtle px-2 py-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-auto shrink-0 gap-1 whitespace-nowrap px-2 text-xs"
                  disabled={pending}
                  onClick={() => {
                    setFormMode({ type: "create" });
                    setConfirmDelete(false);
                  }}
                >
                  <PlusIcon />
                  {t("qualifications.new")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-auto shrink-0 gap-1 whitespace-nowrap px-2 text-xs"
                  disabled={pending || !selected}
                  onClick={() => {
                    if (!selected) return;
                    openEdit(selected);
                  }}
                >
                  <PencilIcon />
                  {t("qualifications.edit")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-auto shrink-0 gap-1 whitespace-nowrap px-2 text-xs"
                  disabled={pending || !selected}
                  onClick={() => {
                    setConfirmDelete(true);
                    setErrorMessage(null);
                  }}
                >
                  <TrashIcon />
                  {t("qualifications.delete")}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 justify-end border-t border-border px-6 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-7 shrink-0 whitespace-nowrap px-2 text-xs"
            >
              <CloseIcon />
              {t("common.close")}
            </Button>
          </div>
        </div>

        {formMode?.type === "create" && (
          <QualificationFormModal
            mode="create"
            existingQualifications={list}
            onClose={() => setFormMode(null)}
            onSaved={refreshList}
          />
        )}
        {formMode?.type === "edit" && (
          <QualificationFormModal
            mode="edit"
            qualification={formMode.qualification}
            existingQualifications={list}
            onClose={() => setFormMode(null)}
            onSaved={refreshList}
          />
        )}
      </div>
    </div>
  );
}
