"use client";

import { useState, useTransition } from "react";
import {
  createCompensationSurchargeType,
  updateCompensationSurchargeType,
} from "@/app/actions/compensation-surcharge-types";
import {
  COMPENSATION_SURCHARGE_TRIGGERS,
  COMPENSATION_SURCHARGE_UNITS,
  parseSurchargeAmount,
  validateCompensationSurchargeTypeUniqueness,
} from "@schichtwerk/database";
import type { CompensationSurchargeType } from "@schichtwerk/types";
import { useTranslations } from "@/i18n/locale-provider";
import {
  formatSurchargeTriggerLabel,
  formatSurchargeUnitLabel,
} from "@/lib/profile-surcharge-display";
import { formatAmountForInput } from "@/lib/profile-hourly-rate-display";
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
  surchargeType?: CompensationSurchargeType;
  existingTypes: CompensationSurchargeType[];
  onClose: () => void;
  onSaved: (createdId?: string) => void;
};

export function CompensationSurchargeTypeFormModal({
  mode,
  surchargeType,
  existingTypes,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(surchargeType?.name ?? "");
  const [trigger, setTrigger] = useState(
    surchargeType?.trigger ?? COMPENSATION_SURCHARGE_TRIGGERS[0]
  );
  const [unit, setUnit] = useState(
    surchargeType?.unit ?? COMPENSATION_SURCHARGE_UNITS[0]
  );
  const [amount, setAmount] = useState(() =>
    surchargeType ? formatAmountForInput(surchargeType.amount, "de") : ""
  );

  function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError(t("surcharges.enterDesignation"));
      return;
    }

    const unique = validateCompensationSurchargeTypeUniqueness(existingTypes, {
      name: name.trim(),
      excludeId: mode === "edit" ? surchargeType?.id : undefined,
    });
    if (!unique.ok) {
      setError(unique.error);
      return;
    }

    const parsedAmount = parseSurchargeAmount(amount, unit);
    if (!parsedAmount.ok) {
      setError(parsedAmount.error);
      return;
    }

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createCompensationSurchargeType({
              name: name.trim(),
              trigger,
              amount,
              unit,
            })
          : await updateCompensationSurchargeType({
              id: surchargeType!.id,
              name: name.trim(),
              trigger,
              amount,
              unit,
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
        aria-labelledby="compensation-surcharge-type-form-title"
        className="relative z-[71] flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3
            id="compensation-surcharge-type-form-title"
            className={SETTINGS_MODAL_TITLE_CLASS}
          >
            {mode === "create"
              ? t("surcharges.createTitle")
              : t("surcharges.editTitle")}
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
            <LabelMuted>{t("surcharges.designation")}</LabelMuted>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("surcharges.designationPlaceholder")}
            />
          </div>

          <div>
            <LabelMuted>{t("surcharges.trigger")}</LabelMuted>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as typeof trigger)}
              disabled={pending}
              className="mt-1 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2.5 text-sm"
            >
              {COMPENSATION_SURCHARGE_TRIGGERS.map((value) => (
                <option key={value} value={value}>
                  {formatSurchargeTriggerLabel(value, t)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <LabelMuted>{t("surcharges.unit")}</LabelMuted>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as typeof unit)}
                disabled={pending}
                className="mt-1 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2.5 text-sm"
              >
                {COMPENSATION_SURCHARGE_UNITS.map((value) => (
                  <option key={value} value={value}>
                    {formatSurchargeUnitLabel(value, t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <LabelMuted>{t("surcharges.amount")}</LabelMuted>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={
                  unit === "percent_of_base"
                    ? t("surcharges.amountPlaceholderPercent")
                    : t("surcharges.amountPlaceholderEur")
                }
                inputMode="decimal"
              />
            </div>
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
