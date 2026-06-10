"use client";

import { useMemo, useState, useTransition } from "react";
import {
  saveProfileCompensationSurcharge,
  updateProfileCompensationSurcharge,
} from "@/app/actions/profile-compensation-surcharges";
import { isMutableHourlyRate, parseSurchargeAmount } from "@schichtwerk/database";
import type {
  CompensationSurchargeType,
  ProfileCompensationSurcharge,
} from "@schichtwerk/types";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import {
  formatAmountForInput,
  minValidFromForRateChange,
} from "@/lib/profile-hourly-rate-display";
import { formatSurchargeAmountLabel } from "@/lib/profile-compensation-calculation";
import { resolveProfileSurchargeAmount } from "@/lib/profile-surcharge-display";
import type { ProfileCompensationCacheEntry } from "./profile-compensation-panel-modal";
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
  Input,
  LabelMuted,
} from "@/components/ui";
import { cn } from "@/lib/cn";

type Props = {
  mode: "create" | "edit";
  profileId: string;
  serverToday: string;
  currentEntry: ProfileCompensationCacheEntry;
  availableTypes: CompensationSurchargeType[];
  editingEntry?: ProfileCompensationSurcharge;
  onClose: () => void;
  onSaved: (
    entry: ProfileCompensationCacheEntry,
    selectedEntryId: string,
    scrollToSelection?: boolean
  ) => void;
};

export function ProfileCompensationSurchargeFormModal({
  mode,
  profileId,
  serverToday,
  currentEntry,
  availableTypes,
  editingEntry,
  onClose,
  onSaved,
}: Props) {
  const { locale } = useLocale();
  const localeKey = locale === "en" ? "en" : "de";
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [surchargeTypeId, setSurchargeTypeId] = useState(
    editingEntry?.surcharge_type_id ?? availableTypes[0]?.id ?? ""
  );
  const selectedType = useMemo(
    () => availableTypes.find((entry) => entry.id === surchargeTypeId) ?? null,
    [availableTypes, surchargeTypeId]
  );
  const initialUsesDefault =
    mode === "edit" && editingEntry ? editingEntry.amount === null : true;
  const [useOrgDefault, setUseOrgDefault] = useState(initialUsesDefault);
  const [amount, setAmount] = useState(() => {
    if (mode === "edit" && editingEntry) {
      const value = resolveProfileSurchargeAmount(editingEntry);
      return formatAmountForInput(value, localeKey);
    }
    if (availableTypes[0]) {
      return formatAmountForInput(availableTypes[0].amount, localeKey);
    }
    return "";
  });
  const [validFrom, setValidFrom] = useState(() => {
    if (mode === "edit" && editingEntry) return editingEntry.valid_from;
    return serverToday;
  });

  const openForSelectedType = useMemo(
    () =>
      currentEntry.surchargeEntries.find(
        (entry) =>
          entry.surcharge_type_id === surchargeTypeId && entry.valid_to === null
      ) ?? null,
    [currentEntry.surchargeEntries, surchargeTypeId]
  );

  const minValidFrom = useMemo(() => {
    if (mode === "edit") return serverToday;
    if (
      openForSelectedType &&
      !isMutableHourlyRate(openForSelectedType.valid_from, serverToday)
    ) {
      return minValidFromForRateChange(
        openForSelectedType.valid_from,
        serverToday
      );
    }
    return serverToday;
  }, [mode, openForSelectedType, serverToday]);

  function handleTypeChange(nextTypeId: string) {
    setSurchargeTypeId(nextTypeId);
    const nextType = availableTypes.find((entry) => entry.id === nextTypeId);
    if (nextType) {
      setAmount(formatAmountForInput(nextType.amount, localeKey));
      setUseOrgDefault(true);
    }
    const openForType = currentEntry.surchargeEntries.find(
      (entry) => entry.surcharge_type_id === nextTypeId && entry.valid_to === null
    );
    if (
      openForType &&
      !isMutableHourlyRate(openForType.valid_from, serverToday)
    ) {
      setValidFrom(minValidFromForRateChange(openForType.valid_from, serverToday));
    } else {
      setValidFrom(serverToday);
    }
  }

  function handleSubmit() {
    setError(null);
    if (mode === "create" && !surchargeTypeId) {
      setError(t("profiles.selectSurchargeRequired"));
      return;
    }
    if (!selectedType) {
      setError(t("profiles.noSurchargesAvailable"));
      return;
    }

    let parsedAmount: number | null = null;
    if (!useOrgDefault) {
      const parsed = parseSurchargeAmount(amount, selectedType.unit);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      parsedAmount = parsed.amount;
    }

    startTransition(async () => {
      if (mode === "edit" && editingEntry) {
        const result = await updateProfileCompensationSurcharge({
          profileId,
          entryId: editingEntry.id,
          amount: parsedAmount,
          valid_from: validFrom,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        const nextEntry: ProfileCompensationCacheEntry = {
          ...currentEntry,
          currentSurcharges:
            result.currentSurcharges ?? currentEntry.currentSurcharges,
          surchargeEntries:
            result.surchargeEntries ?? currentEntry.surchargeEntries,
          serverToday: result.serverToday ?? currentEntry.serverToday,
        };
        onSaved(
          nextEntry,
          result.entry?.id ?? editingEntry.id,
          false
        );
        onClose();
        return;
      }

      const result = await saveProfileCompensationSurcharge({
        profileId,
        surcharge_type_id: surchargeTypeId,
        amount: parsedAmount,
        valid_from: validFrom,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const nextEntry: ProfileCompensationCacheEntry = {
        ...currentEntry,
        currentSurcharges:
          result.currentSurcharges ?? currentEntry.currentSurcharges,
        surchargeEntries:
          result.surchargeEntries ?? currentEntry.surchargeEntries,
        serverToday: result.serverToday ?? currentEntry.serverToday,
      };
      onSaved(
        nextEntry,
        result.entry?.id ?? nextEntry.surchargeEntries[0]?.id ?? "",
        true
      );
      onClose();
    });
  }

  if (mode === "create" && availableTypes.length === 0) {
    return (
      <div className={settingsNestedModalOverlayClass()} role="presentation">
        <div
          role="dialog"
          aria-modal="true"
          className={settingsNestedModalDialogClass("md")}
        >
          <div className={cn("space-y-4", settingsModalBodyPaddingClass())}>
            <Alert variant="error">{t("profiles.noSurchargesAvailable")}</Alert>
            <div className={settingsModalFooterClass()}>
              <Button type="button" variant="outline" onClick={onClose}>
                <CloseIcon />
                {t("common.close")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
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
        aria-labelledby="profile-compensation-surcharge-form-title"
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
            id="profile-compensation-surcharge-form-title"
            className={SETTINGS_MODAL_TITLE_CLASS}
          >
            {mode === "create"
              ? t("profiles.surchargeCreateTitle")
              : t("profiles.surchargeEditTitle")}
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

          {mode === "create" ? (
            <div>
              <LabelMuted>{t("profiles.surchargeType")}</LabelMuted>
              <select
                value={surchargeTypeId}
                onChange={(e) => handleTypeChange(e.target.value)}
                disabled={pending}
                className="mt-1 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2.5 text-sm"
              >
                {availableTypes.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <LabelMuted>{t("profiles.surchargeType")}</LabelMuted>
              <p className="mt-1 text-sm font-medium">
                {editingEntry?.surcharge_type_name}
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useOrgDefault}
              onChange={(e) => setUseOrgDefault(e.target.checked)}
              disabled={pending}
            />
            <span>{t("profiles.useOrgSurchargeDefault")}</span>
          </label>

          {selectedType && useOrgDefault ? (
            <p className="text-sm text-muted">
              {t("profiles.orgSurchargeDefaultHint", {
                amount: formatSurchargeAmountLabel(
                  selectedType.amount,
                  selectedType.unit,
                  localeKey
                ),
              })}
            </p>
          ) : (
            <div>
              <LabelMuted>{t("profiles.surchargeAmount")}</LabelMuted>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={pending}
                inputMode="decimal"
              />
            </div>
          )}

          <div>
            <LabelMuted>{t("profiles.validFrom")}</LabelMuted>
            <Input
              type="date"
              value={validFrom}
              min={minValidFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              disabled={pending}
              className="min-w-0"
            />
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
            disabled={pending}
          >
            <CheckIcon />
            {t("common.ok")}
          </Button>
        </div>
      </div>
    </div>
  );
}
