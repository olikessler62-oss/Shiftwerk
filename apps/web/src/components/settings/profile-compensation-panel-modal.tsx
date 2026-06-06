"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  deleteProfileHourlyRate,
  fetchProfileHourlyRates,
} from "@/app/actions/profile-hourly-rates";
import { isMutableHourlyRate } from "@schichtwerk/database";
import type { Profile, ProfileHourlyRate } from "@schichtwerk/types";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import {
  formatAmountLabel,
  formatDateLabel,
} from "@/lib/profile-hourly-rate-display";
import { ProfileHourlyRateFormModal } from "./profile-hourly-rate-form-modal";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  SETTINGS_PROFILES_LIST_SCROLL_CLASS,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
  settingsListItemAttrs,
  useScrollToSettingsListItem,
  settingsColumnHeaderClass,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
} from "./settings-list-ui";
import {
  Alert,
  Button,
  CloseIcon,
  IconButton,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui";
import { cn } from "@/lib/cn";

const MAX_NAME_DISPLAY = 25;
const EMPTY_STATE_CLASS = "min-h-full";

export type ProfileCompensationCacheEntry = {
  currentRate: ProfileHourlyRate | null;
  rates: ProfileHourlyRate[];
  serverToday: string;
};

type HourlyRateFormMode =
  | null
  | { type: "create" }
  | { type: "edit"; rate: ProfileHourlyRate };

function truncateLabel(name: string, max = MAX_NAME_DISPLAY): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function resolveDefaultSelectedRateId(rates: ProfileHourlyRate[]): string | null {
  const openRate = rates.find((rate) => rate.valid_to === null);
  return openRate?.id ?? rates[0]?.id ?? null;
}

type Props = {
  profile: Profile;
  cachedCompensation?: ProfileCompensationCacheEntry;
  onClose: () => void;
  onCacheUpdate: (profileId: string, entry: ProfileCompensationCacheEntry) => void;
};

export function ProfileCompensationPanelModal({
  profile,
  cachedCompensation,
  onClose,
  onCacheUpdate,
}: Props) {
  const { locale } = useLocale();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(cachedCompensation === undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rates, setRates] = useState<ProfileHourlyRate[]>(
    cachedCompensation?.rates ?? []
  );
  const [currentRate, setCurrentRate] = useState<ProfileHourlyRate | null>(
    cachedCompensation?.currentRate ?? null
  );
  const [selectedRateId, setSelectedRateId] = useState<string | null>(() =>
    cachedCompensation
      ? resolveDefaultSelectedRateId(cachedCompensation.rates)
      : null
  );
  const [serverToday, setServerToday] = useState(
    cachedCompensation?.serverToday ?? ""
  );
  const [formMode, setFormMode] = useState<HourlyRateFormMode>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);

  const syncLocalCompensation = useCallback(
    (entry: ProfileCompensationCacheEntry, preferredSelectedId?: string | null) => {
      setRates(entry.rates);
      setCurrentRate(entry.currentRate);
      setServerToday(entry.serverToday);
      setSelectedRateId((current) => {
        const nextId =
          preferredSelectedId ??
          (current && entry.rates.some((rate) => rate.id === current)
            ? current
            : resolveDefaultSelectedRateId(entry.rates));
        return nextId;
      });
    },
    []
  );

  const applyCompensation = useCallback(
    (entry: ProfileCompensationCacheEntry, preferredSelectedId?: string | null) => {
      syncLocalCompensation(entry, preferredSelectedId);
      onCacheUpdate(profile.id, entry);
    },
    [onCacheUpdate, profile.id, syncLocalCompensation]
  );

  const selectedRate = useMemo(
    () => rates.find((rate) => rate.id === selectedRateId) ?? null,
    [rates, selectedRateId]
  );
  const openRate = useMemo(
    () => rates.find((rate) => rate.valid_to === null) ?? null,
    [rates]
  );
  const defaultCurrency = rates[0]?.currency ?? "EUR";
  const openRateMutable =
    !!openRate && !!serverToday && isMutableHourlyRate(openRate.valid_from, serverToday);
  const selectedRateMutable =
    !!selectedRate &&
    !!serverToday &&
    isMutableHourlyRate(selectedRate.valid_from, serverToday);
  const canCreate =
    !!serverToday &&
    (rates.length === 0 ||
      !openRate ||
      (!!openRate && !isMutableHourlyRate(openRate.valid_from, serverToday)));
  const canEdit = selectedRateMutable;
  const canDelete = selectedRateMutable;

  useScrollToSettingsListItem(rates, scrollToItemId, () =>
    setScrollToItemId(null)
  );

  useEffect(() => {
    if (cachedCompensation !== undefined) {
      syncLocalCompensation(cachedCompensation);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    void fetchProfileHourlyRates(profile.id).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setErrorMessage(result.error);
        applyCompensation({
          currentRate: null,
          rates: [],
          serverToday: "",
        });
        return;
      }
      applyCompensation({
        currentRate: result.currentRate ?? null,
        rates: result.rates ?? [],
        serverToday: result.serverToday ?? "",
      });
    });

    return () => {
      cancelled = true;
    };
  }, [applyCompensation, cachedCompensation, profile.id, syncLocalCompensation]);

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

  const anyFormOpen = !!formMode || confirmDelete;

  function handleSaved(
    entry: ProfileCompensationCacheEntry,
    selectedId: string,
    scrollToSelection = false
  ) {
    applyCompensation(entry, selectedId);
    if (scrollToSelection && selectedId) setScrollToItemId(selectedId);
  }

  function handleDelete() {
    if (!selectedRate || !canDelete) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteProfileHourlyRate({
        profileId: profile.id,
        rateId: selectedRate.id,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      applyCompensation({
        currentRate: result.currentRate ?? null,
        rates: result.rates ?? [],
        serverToday: result.serverToday ?? serverToday,
      });
      setConfirmDelete(false);
    });
  }

  const deleteConfirmLabel =
    selectedRate && serverToday
      ? `${formatAmountLabel(selectedRate.amount, selectedRate.currency, locale)} (${formatDateLabel(selectedRate.valid_from, locale)})`
      : "";

  const title = t("profiles.panelCompensationOf", {
    name: truncateLabel(profile.full_name, 40),
  });

  return (
    <div
      className={cn(
        "absolute inset-0 z-[60] flex items-center justify-center rounded-2xl bg-black/30 p-4",
        (loading || pending) && "cursor-wait"
      )}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !anyFormOpen) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-compensation-panel-title"
        aria-busy={loading || pending}
        aria-hidden={anyFormOpen}
        className={cn(
          "relative z-[61] flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl",
          (loading || pending) && "[&_*]:cursor-wait",
          anyFormOpen ? "pointer-events-none" : ""
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3
            id="profile-compensation-panel-title"
            className={SETTINGS_MODAL_TITLE_CLASS}
          >
            {title}
          </h3>
          <IconButton
            size="sm"
            onClick={onClose}
            disabled={loading || pending}
            aria-label={t("common.close")}
            className="border-transparent bg-transparent hover:bg-subtle"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        {errorMessage && (
          <div className="mx-4 mt-3 shrink-0">
            <Alert variant="error">{errorMessage}</Alert>
          </div>
        )}

        <div className="min-h-0 bg-background px-4 py-3">
          <div
            className={cn(
              "min-h-0 overflow-y-auto rounded-md border border-border bg-surface",
              SETTINGS_PROFILES_LIST_SCROLL_CLASS
            )}
          >
            {loading ? (
              <SettingsEmptyState
                message={t("common.loading")}
                className={EMPTY_STATE_CLASS}
              />
            ) : rates.length === 0 ? (
              <SettingsEmptyState
                message={t("profiles.noHourlyRate")}
                hint={t("common.emptyHintCreate")}
                className={EMPTY_STATE_CLASS}
              />
            ) : (
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-[1] bg-subtle">
                  <tr className="border-b border-border bg-subtle">
                    <th className="w-1 p-0" aria-hidden />
                    <th className={settingsColumnHeaderClass("right")}>
                      {t("profiles.hourlyRateColumnAmount")}
                    </th>
                    <th className={settingsColumnHeaderClass()}>
                      {t("profiles.hourlyRateColumnValidFrom")}
                    </th>
                    <th className={settingsColumnHeaderClass()}>
                      {t("profiles.hourlyRateColumnValidTo")}
                    </th>
                    <th className={settingsColumnHeaderClass()}>
                      {t("profiles.hourlyRateColumnCreatedBy")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((rate) => {
                    const isSelected = rate.id === selectedRateId;
                    return (
                      <tr
                        key={rate.id}
                        {...settingsListItemAttrs(rate.id)}
                        onClick={() => {
                          setSelectedRateId(rate.id);
                          setFormMode(null);
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          window.getSelection()?.removeAllRanges();
                          if (
                            !serverToday ||
                            !isMutableHourlyRate(rate.valid_from, serverToday)
                          ) {
                            return;
                          }
                          setFormMode({ type: "edit", rate });
                        }}
                        className={settingsDataRowClass(isSelected)}
                      >
                        <td
                          className={settingsIndicatorCellClass(isSelected)}
                          aria-hidden
                        />
                        <td
                          className={settingsDataCellClass(isSelected, {
                            align: "right",
                            className: "whitespace-nowrap tabular-nums",
                          })}
                        >
                          {formatAmountLabel(rate.amount, rate.currency, locale)}
                        </td>
                        <td className={settingsDataCellClass(isSelected)}>
                          {formatDateLabel(rate.valid_from, locale)}
                        </td>
                        <td className={settingsDataCellClass(isSelected)}>
                          {rate.valid_to
                            ? formatDateLabel(rate.valid_to, locale)
                            : t("profiles.hourlyRateOpen")}
                        </td>
                        <td
                          className={settingsDataCellClass(isSelected, {
                            className: "max-w-[8rem] truncate text-muted",
                          })}
                          title={rate.created_by_name ?? undefined}
                        >
                          {rate.created_by_name
                            ? truncateLabel(rate.created_by_name, 18)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border px-4 py-3">
          <SettingsActionBar
            primary={
              <SettingsPrimaryActionButton
                label={t("profiles.new")}
                icon={<PlusIcon />}
                disabled={loading || pending || !canCreate}
                onClick={() => {
                  setFormMode({ type: "create" });
                  setErrorMessage(null);
                }}
              />
            }
            secondary={
              <SettingsIconActionButton
                label={t("profiles.edit")}
                icon={<PencilIcon />}
                disabled={loading || pending || !canEdit}
                onClick={() => {
                  if (!selectedRate || !canEdit) return;
                  setFormMode({ type: "edit", rate: selectedRate });
                  setConfirmDelete(false);
                  setErrorMessage(null);
                }}
              />
            }
            destructive={
              <SettingsIconActionButton
                label={t("profiles.delete")}
                icon={<TrashIcon />}
                disabled={loading || pending || !canDelete}
                onClick={() => {
                  setFormMode(null);
                  setConfirmDelete(true);
                }}
              />
            }
          />
        </div>

        <div className="flex shrink-0 justify-end border-t border-border px-5 py-3">
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

      {formMode?.type === "create" && serverToday && (
        <ProfileHourlyRateFormModal
          mode="create"
          profileId={profile.id}
          serverToday={serverToday}
          currentOpenRate={openRateMutable ? null : currentRate}
          defaultCurrency={defaultCurrency}
          onClose={() => setFormMode(null)}
          onSaved={handleSaved}
        />
      )}
      {formMode?.type === "edit" && serverToday && (
        <ProfileHourlyRateFormModal
          mode="edit"
          profileId={profile.id}
          serverToday={serverToday}
          editingRate={formMode.rate}
          defaultCurrency={defaultCurrency}
          onClose={() => setFormMode(null)}
          onSaved={handleSaved}
        />
      )}
      {confirmDelete && selectedRate && (
        <DeleteConfirmModal
          name={deleteConfirmLabel}
          pending={pending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
