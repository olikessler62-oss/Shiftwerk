"use client";

import { useState } from "react";
import type { ShiftTypeWithBreaks } from "@schichtwerk/types";
import { ShiftTypesModal } from "./shift-types-modal";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

const SETTINGS_OPTIONS = [
  { id: "schichtarten", label: "Schichtarten" },
] as const;

type Props = {
  shiftTypes: ShiftTypeWithBreaks[];
};

export function EinstellungenView({ shiftTypes }: Props) {
  const [activeOption, setActiveOption] = useState<string | null>(null);
  const showShiftTypesModal = activeOption === "schichtarten";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Einstellungen</h1>
        <p className="mt-1 text-sm text-muted">
          Schichtarten, Zeitzone und weitere Optionen für Ihren Betrieb.
        </p>
      </div>

      <div className="flex min-h-[480px] gap-8">
        <nav className="w-52 shrink-0 space-y-0.5">
          {SETTINGS_OPTIONS.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant="ghost"
              onClick={() => setActiveOption(option.id)}
              className={cn(
                "h-auto w-full justify-start px-3 py-2 text-sm font-normal",
                activeOption === option.id && "bg-subtle font-medium"
              )}
            >
              {option.label}
            </Button>
          ))}
        </nav>

        <div className="relative min-h-[480px] flex-1 rounded-xl border border-dashed border-border bg-hover">
          {!showShiftTypesModal && (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted">
              Wählen Sie links eine Option — z. B. Schichtarten — um sie zu
              bearbeiten.
            </p>
          )}

          {showShiftTypesModal && (
            <ShiftTypesModal
              shiftTypes={shiftTypes}
              onClose={() => setActiveOption(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
