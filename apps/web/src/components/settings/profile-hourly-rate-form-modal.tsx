"use client";

import { useMemo, useState, useTransition } from "react";
import {
  saveProfileHourlyRate,
  updateProfileHourlyRate,
} from "@/app/actions/profile-hourly-rates";
import type { ProfileHourlyRate } from "@schichtwerk/types";
import { isMutableHourlyRate } from "@schichtwerk/database";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import {
  formatAmountForInput,
  minValidFromForRateChange,
  parseAmountInput,
} from "@/lib/profile-hourly-rate-display";
import { SETTINGS_MODAL_TITLE_CLASS } from "./settings-list-ui";
import type { ProfileCompensationCacheEntry } from "./profile-compensation-panel-modal";
import {
  Alert,
  Button,
  CheckIcon,
  CloseIcon,
  IconButton,
  Input,
  LabelMuted,
} from "@/components/ui";
import { cn } from "@/lib/cn";

type Props = {
  mode: "create" | "edit";
  profileId: string;
  serverToday: string;
  editingRate?: ProfileHourlyRate;
  currentOpenRate?: ProfileHourlyRate | null;
  defaultCurrency?: string;
  onClose: () => void;
  onSaved: (
    entry: ProfileCompensationCacheEntry,
    selectedRateId: string,
    scrollToSelection?: boolean
  ) => void;
};

export function ProfileHourlyRateFormModal({
  mode,
  profileId,
  serverToday,
  editingRate,
  currentOpenRate,
  defaultCurrency = "EUR",
  onClose,
  onSaved,
}: Props) {
  const { locale } = useLocale();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hourlyRate, setHourlyRate] = useState(() =>
    mode === "edit" && editingRate
      ? formatAmountForInput(editingRate.amount, locale)
      : ""
  );
  const [validFrom, setValidFrom] = useState(() => {
    if (mode === "edit" && editingRate) return editingRate.valid_from;
    if (
      currentOpenRate &&
      !isMutableHourlyRate(currentOpenRate.valid_from, serverToday)
    ) {
      return minValidFromForRateChange(currentOpenRate.valid_from, serverToday);
    }
    return serverToday;
  });
  const initialHourlyAmount =
    mode === "edit" && editingRate ? editingRate.amount : null;
  const initialValidFrom =
    mode === "edit" && editingRate ? editingRate.valid_from : null;
  const hourlyCurrency =
    editingRate?.currency ?? currentOpenRate?.currency ?? defaultCurrency;

  const minValidFrom = useMemo(() => {
    if (mode === "edit") return serverToday;
    if (
      currentOpenRate &&
      !isMutableHourlyRate(currentOpenRate.valid_from, serverToday)
    ) {
      return minValidFromForRateChange(currentOpenRate.valid_from, serverToday);
    }
    return serverToday;
  }, [currentOpenRate, mode, serverToday]);

  function applySavedResult(
    result: {
      ok: true;
      rates?: ProfileHourlyRate[];
      currentRate?: ProfileHourlyRate | null;
      serverToday?: string;
      rate?: ProfileHourlyRate;
    },
    scrollToSelection: boolean
  ) {
    const entry: ProfileCompensationCacheEntry = {
      currentRate: result.currentRate ?? null,
      rates: result.rates ?? [],
      serverToday: result.serverToday ?? serverToday,
    };
    const selectedRateId =
      result.rate?.id ??
      entry.currentRate?.id ??
      entry.rates[0]?.id ??
      "";
    onSaved(entry, selectedRateId, scrollToSelection);
    onClose();
  }

  function handleSubmit() {
    setError(null);
    const parsedAmount = parseAmountInput(hourlyRate);
    if (parsedAmount === null) {
      setError(t("profiles.enterHourlyRate"));
      return;
    }

    startTransition(async () => {
      if (mode === "edit" && editingRate) {
        if (
          parsedAmount === initialHourlyAmount &&
          validFrom === initialValidFrom
        ) {
          onClose();
          return;
        }

        const result = await updateProfileHourlyRate({
          profileId,
          rateId: editingRate.id,
          amount: hourlyRate.trim(),
          valid_from: validFrom,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        applySavedResult(result, false);
        return;
      }

      const result = await saveProfileHourlyRate({
        profileId,
        amount: hourlyRate.trim(),
        valid_from: validFrom,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      applySavedResult(result, true);
    });
  }

  const parsedAmount = parseAmountInput(hourlyRate);
  const hasChanges =
    parsedAmount !== null &&
    (mode === "create" ||
      parsedAmount !== initialHourlyAmount ||
      validFrom !== initialValidFrom);

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
        aria-labelledby="profile-hourly-rate-form-title"
        className="relative z-[71] flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3
            id="profile-hourly-rate-form-title"
            className={SETTINGS_MODAL_TITLE_CLASS}
          >
            {mode === "create"
              ? t("profiles.hourlyRateCreateTitle")
              : t("profiles.hourlyRateEditTitle")}
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

          <div className="grid max-w-full grid-cols-[1fr_11rem] items-end gap-4">
            <div>
              <LabelMuted>{t("profiles.currentHourlyRate")}</LabelMuted>
              <div
                className={cn(
                  "mt-1 flex w-full overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
                  pending && "opacity-50"
                )}
              >
                <input
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder={t("profiles.hourlyRatePlaceholder")}
                  disabled={pending}
                  inputMode="decimal"
                  autoFocus
                  className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted disabled:cursor-not-allowed"
                />
                <span
                  className="flex shrink-0 items-center border-l border-border bg-subtle px-2 text-sm font-medium text-muted"
                  aria-hidden
                >
                  {hourlyCurrency}
                </span>
              </div>
            </div>

            <div>
              <LabelMuted>{t("profiles.validFrom")}</LabelMuted>
              <Input
                type="date"
                value={validFrom}
                min={minValidFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                disabled={pending || !hourlyRate.trim()}
                className="min-w-0"
              />
            </div>
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
            disabled={pending || !hasChanges}
          >
            <CheckIcon />
            {t("common.ok")}
          </Button>
        </div>
      </div>
    </div>
  );
}
