"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteShiftType } from "@/app/actions/shift-types";
import { MAX_SHIFT_TYPES_PER_ORGANIZATION } from "@schichtwerk/database";
import type { ShiftTypeWithBreaks } from "@schichtwerk/types";
import {
  formatBreakTotal,
  formatClock,
  shiftTypeDuration,
} from "@/lib/shift-type-display";
import { ShiftTypeFormModal } from "./shift-type-form-modal";
import { Alert, Button, IconButton } from "@/components/ui";
import { cn } from "@/lib/cn";

type Props = {
  shiftTypes: ShiftTypeWithBreaks[];
  onClose: () => void;
};

type FormMode = null | { type: "create" } | { type: "edit"; shiftType: ShiftTypeWithBreaks };

function sortedBreaks(type: ShiftTypeWithBreaks) {
  return [...(type.shift_type_breaks ?? [])].sort((a, b) => a.sort_order - b.sort_order);
}

export function ShiftTypesModal({ shiftTypes, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [list, setList] = useState(shiftTypes);
  const [selectedId, setSelectedId] = useState<string | null>(shiftTypes[0]?.id ?? null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setList(shiftTypes);
    setSelectedId((current) => {
      if (current && shiftTypes.some((t) => t.id === current)) return current;
      return shiftTypes[0]?.id ?? null;
    });
  }, [shiftTypes]);

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

  const selected = list.find((t) => t.id === selectedId);
  const atShiftTypeLimit = list.length >= MAX_SHIFT_TYPES_PER_ORGANIZATION;

  function refreshList() {
    router.refresh();
  }

  function handleDelete() {
    if (!selected) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteShiftType(selected.id);
      if (!result.ok) {
        setErrorMessage(result.error);
        setConfirmDelete(false);
        return;
      }
      setList((prev) => {
        const remaining = prev.filter((t) => t.id !== selected.id);
        setSelectedId(remaining[0]?.id ?? null);
        return remaining;
      });
      setConfirmDelete(false);
      setStatusMessage(`„${selected.name}" wurde gelöscht.`);
      refreshList();
    });
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/25 p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !formMode && !confirmDelete) onClose();
      }}
    >
      <div
        className="relative w-full max-w-3xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="shift-types-modal-title"
          aria-hidden={!!formMode}
          className={`flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl ${
            formMode ? "pointer-events-none" : ""
          }`}
        >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2
            id="shift-types-modal-title"
            className="text-lg font-semibold text-foreground"
          >
            Schichtarten
          </h2>
          <IconButton
            size="sm"
            onClick={onClose}
            aria-label="Schließen"
            className="border-transparent bg-transparent hover:bg-subtle"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </IconButton>
        </div>

        {(statusMessage || errorMessage) && (
          <div className="mx-6 mt-4">
            <Alert variant={errorMessage ? "error" : "neutral"}>
              {errorMessage ?? statusMessage}
            </Alert>
          </div>
        )}

        <div className="overflow-x-auto px-6 py-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-center">
                {["Name", "Uhrzeit von", "Uhrzeit bis", "Dauer", "Pausen"].map(
                  (label) => (
                    <th
                      key={label}
                      className="px-2 pb-3 text-xs font-semibold uppercase tracking-wide text-muted"
                    >
                      {label}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
                    Noch keine Schichtarten angelegt.
                  </td>
                </tr>
              ) : (
                list.map((type) => {
                  const isSelected = type.id === selectedId;
                  const breaks = sortedBreaks(type);
                  return (
                    <tr
                      key={type.id}
                      onClick={() => {
                        setSelectedId(type.id);
                        setConfirmDelete(false);
                        setStatusMessage(null);
                        setErrorMessage(null);
                      }}
                      className={cn(
                        "cursor-pointer border-b border-border last:border-0",
                        isSelected
                          ? "bg-subtle ring-1 ring-inset ring-border"
                          : "hover:bg-hover"
                      )}
                    >
                      <td
                        className={cn(
                          "px-2 py-3 text-center font-medium text-foreground",
                          isSelected && "border-l-4 border-l-foreground"
                        )}
                      >
                        {type.name}
                      </td>
                      <td className="px-2 py-3 text-center tabular-nums text-foreground">
                        {formatClock(type.start_time)}
                      </td>
                      <td className="px-2 py-3 text-center tabular-nums text-foreground">
                        {formatClock(type.end_time)}
                      </td>
                      <td className="px-2 py-3 text-center tabular-nums text-foreground">
                        {shiftTypeDuration(type.start_time, type.end_time)}
                      </td>
                      <td className="px-2 py-3 text-center tabular-nums text-foreground">
                        {breaks.length > 0 ? formatBreakTotal(breaks) : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {confirmDelete && selected && (
          <div className="mx-6 mb-2 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border bg-subtle px-4 py-3 text-sm">
            <span>
              <strong>{selected.name}</strong> wirklich löschen?
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setConfirmDelete(false)}
              >
                Nein
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={pending}
                onClick={handleDelete}
              >
                Ja, löschen
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || atShiftTypeLimit}
              title={
                atShiftTypeLimit
                  ? `Maximal ${MAX_SHIFT_TYPES_PER_ORGANIZATION} Schichtarten erlaubt`
                  : undefined
              }
              onClick={() => {
                setFormMode({ type: "create" });
                setConfirmDelete(false);
              }}
            >
              + Neu
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || !selected}
              onClick={() => {
                if (!selected) return;
                setFormMode({ type: "edit", shiftType: selected });
                setConfirmDelete(false);
              }}
            >
              Ändern
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || !selected}
              onClick={() => {
                setConfirmDelete(true);
                setStatusMessage(null);
                setErrorMessage(null);
              }}
            >
              Löschen
            </Button>
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            Schließen
          </Button>
        </div>
        </div>

        {formMode?.type === "create" && (
          <ShiftTypeFormModal
            mode="create"
            existingShiftTypes={list}
            onClose={() => setFormMode(null)}
            onSaved={() => {
              setStatusMessage("Schichtart wurde angelegt.");
              refreshList();
            }}
          />
        )}
        {formMode?.type === "edit" && (
          <ShiftTypeFormModal
            mode="edit"
            shiftType={formMode.shiftType}
            existingShiftTypes={list}
            onClose={() => setFormMode(null)}
            onSaved={() => {
              setStatusMessage("Schichtart wurde gespeichert.");
              refreshList();
            }}
          />
        )}
      </div>
    </div>
  );
}
