"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  deleteProfileHourlyRate,
  fetchProfileHourlyRates,
} from "@/app/actions/profile-hourly-rates";
import { isMutableHourlyRate } from "@schichtwerk/database";
import type {
  Profile,
  ProfileHourlyRate,
  ProfileCompensationSurcharge,
  EffectiveProfileCompensationSurcharge,
  CompensationSurchargeType,
} from "@schichtwerk/types";
import { fetchCompensationSurchargeTypes } from "@/app/actions/compensation-surcharge-types";
import { deleteProfileCompensationSurcharge } from "@/app/actions/profile-compensation-surcharges";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import {
  formatAmountLabel,
  formatDateLabel,
} from "@/lib/profile-hourly-rate-display";
import { ProfileHourlyRateFormModal } from "./profile-hourly-rate-form-modal";
import { ProfileCompensationSurchargeFormModal } from "./profile-compensation-surcharge-form-modal";
import {
  formatSurchargeAmountLabel,
} from "@/lib/profile-compensation-calculation";
import {
  formatSurchargeTriggerLabel,
  resolveProfileSurchargeAmount,
} from "@/lib/profile-surcharge-display";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  SETTINGS_PROFILES_HALF_LIST_SCROLL_CLASS,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
  settingsListItemAttrs,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsScrollableTableListClass,
  settingsSubModalDialogClass,
  settingsSubModalOverlayClass,
  useScrollToSettingsListItem,
  settingsStickyColumnHeaderClass,
  settingsStickyIndicatorHeaderClass,
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
import { COMPENSATION_SURCHARGES_UI_ENABLED } from "@/lib/compensation-surcharges-feature";

const MAX_NAME_DISPLAY = 25;
const EMPTY_STATE_CLASS = "flex min-h-[8.8rem] items-center justify-center";

export type ProfileCompensationCacheEntry = {
  currentRate: ProfileHourlyRate | null;
  rates: ProfileHourlyRate[];
  currentSurcharges: EffectiveProfileCompensationSurcharge[];
  surchargeEntries: ProfileCompensationSurcharge[];
  serverToday: string;
};

type HourlyRateFormMode =
  | null
  | { type: "create" }
  | { type: "edit"; rate: ProfileHourlyRate };

type SurchargeFormMode =
  | null
  | { type: "create" }
  | { type: "edit"; entry: ProfileCompensationSurcharge };

function truncateLabel(name: string, max = MAX_NAME_DISPLAY): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function resolveDefaultSelectedRateId(rates: ProfileHourlyRate[]): string | null {
  const openRate = rates.find((rate) => rate.valid_to === null);
  return openRate?.id ?? rates[0]?.id ?? null;
}

function resolveDefaultSelectedSurchargeId(
  entries: ProfileCompensationSurcharge[]
): string | null {
  const openEntry = entries.find((entry) => entry.valid_to === null);
  return openEntry?.id ?? entries[0]?.id ?? null;
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
  const [currentSurcharges, setCurrentSurcharges] = useState<
    EffectiveProfileCompensationSurcharge[]
  >(cachedCompensation?.currentSurcharges ?? []);
  const [surchargeEntries, setSurchargeEntries] = useState<
    ProfileCompensationSurcharge[]
  >(cachedCompensation?.surchargeEntries ?? []);
  const [availableSurchargeTypes, setAvailableSurchargeTypes] = useState<
    CompensationSurchargeType[]
  >([]);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(() =>
    cachedCompensation
      ? resolveDefaultSelectedRateId(cachedCompensation.rates)
      : null
  );
  const [selectedSurchargeId, setSelectedSurchargeId] = useState<string | null>(
    () =>
      cachedCompensation
        ? resolveDefaultSelectedSurchargeId(cachedCompensation.surchargeEntries)
        : null
  );
  const [serverToday, setServerToday] = useState(
    cachedCompensation?.serverToday ?? ""
  );
  const [formMode, setFormMode] = useState<HourlyRateFormMode>(null);
  const [surchargeFormMode, setSurchargeFormMode] =
    useState<SurchargeFormMode>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteSurcharge, setConfirmDeleteSurcharge] = useState(false);
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);
  const [scrollToSurchargeId, setScrollToSurchargeId] = useState<string | null>(
    null
  );

  const syncLocalCompensation = useCallback(
    (entry: ProfileCompensationCacheEntry, preferredSelectedId?: string | null) => {
      setRates(entry.rates);
      setCurrentRate(entry.currentRate);
      setCurrentSurcharges(entry.currentSurcharges);
      setSurchargeEntries(entry.surchargeEntries);
      setServerToday(entry.serverToday);
      setSelectedRateId((current) => {
        const nextId =
          preferredSelectedId ??
          (current && entry.rates.some((rate) => rate.id === current)
            ? current
            : resolveDefaultSelectedRateId(entry.rates));
        return nextId;
      });
      setSelectedSurchargeId((current) => {
        const nextId =
          current &&
          entry.surchargeEntries.some((entryRow) => entryRow.id === current)
            ? current
            : resolveDefaultSelectedSurchargeId(entry.surchargeEntries);
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
  const selectedSurcharge = useMemo(
    () =>
      surchargeEntries.find((entry) => entry.id === selectedSurchargeId) ?? null,
    [surchargeEntries, selectedSurchargeId]
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
  const selectedSurchargeMutable =
    !!selectedSurcharge &&
    !!serverToday &&
    isMutableHourlyRate(selectedSurcharge.valid_from, serverToday);
  const canCreateSurcharge =
    !!serverToday && availableSurchargeTypes.length > 0;
  const canEditSurcharge = selectedSurchargeMutable;
  const canDeleteSurcharge = selectedSurchargeMutable;

  const localeKey = locale === "en" ? "en" : "de";
  const currentCompensationEntry = useMemo(
    (): ProfileCompensationCacheEntry => ({
      currentRate,
      rates,
      currentSurcharges,
      surchargeEntries,
      serverToday,
    }),
    [currentRate, currentSurcharges, rates, serverToday, surchargeEntries]
  );

  useScrollToSettingsListItem(rates, scrollToItemId, () =>
    setScrollToItemId(null)
  );
  useScrollToSettingsListItem(surchargeEntries, scrollToSurchargeId, () =>
    setScrollToSurchargeId(null)
  );

  useEffect(() => {
    if (cachedCompensation !== undefined) {
      syncLocalCompensation(cachedCompensation);
      setLoading(false);
    } else {
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
            currentSurcharges: [],
            surchargeEntries: [],
            serverToday: "",
          });
          return;
        }
        applyCompensation({
          currentRate: result.currentRate ?? null,
          rates: result.rates ?? [],
          currentSurcharges: result.currentSurcharges ?? [],
          surchargeEntries: result.surchargeEntries ?? [],
          serverToday: result.serverToday ?? "",
        });
      });

      return () => {
        cancelled = true;
      };
    }
  }, [applyCompensation, cachedCompensation, profile.id, syncLocalCompensation]);

  useEffect(() => {
    if (!COMPENSATION_SURCHARGES_UI_ENABLED) return;
    let cancelled = false;
    void fetchCompensationSurchargeTypes().then((result) => {
      if (cancelled || !result.ok) return;
      setAvailableSurchargeTypes(result.types);
    });
    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (formMode) {
        setFormMode(null);
        return;
      }
      if (surchargeFormMode) {
        setSurchargeFormMode(null);
        return;
      }
      if (confirmDelete) {
        setConfirmDelete(false);
        return;
      }
      if (confirmDeleteSurcharge) {
        setConfirmDeleteSurcharge(false);
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDelete, confirmDeleteSurcharge, formMode, onClose, surchargeFormMode]);

  const anyFormOpen =
    !!formMode || !!surchargeFormMode || confirmDelete || confirmDeleteSurcharge;

  function handleSaved(
    entry: ProfileCompensationCacheEntry,
    selectedId: string,
    scrollToSelection = false
  ) {
    applyCompensation(entry, selectedId);
    if (scrollToSelection && selectedId) setScrollToItemId(selectedId);
  }

  function handleSurchargeSaved(
    entry: ProfileCompensationCacheEntry,
    selectedId: string,
    scrollToSelection = false
  ) {
    applyCompensation(entry, undefined);
    if (selectedId) setSelectedSurchargeId(selectedId);
    if (scrollToSelection && selectedId) setScrollToSurchargeId(selectedId);
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
        currentSurcharges: result.currentSurcharges ?? currentSurcharges,
        surchargeEntries: result.surchargeEntries ?? surchargeEntries,
        serverToday: result.serverToday ?? serverToday,
      });
      setConfirmDelete(false);
    });
  }

  function handleDeleteSurcharge() {
    if (!selectedSurcharge || !canDeleteSurcharge) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteProfileCompensationSurcharge({
        profileId: profile.id,
        entryId: selectedSurcharge.id,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      applyCompensation({
        currentRate,
        rates,
        currentSurcharges: result.currentSurcharges ?? [],
        surchargeEntries: result.surchargeEntries ?? [],
        serverToday: result.serverToday ?? serverToday,
      });
      setConfirmDeleteSurcharge(false);
    });
  }

  const deleteConfirmLabel =
    selectedRate && serverToday
      ? `${formatAmountLabel(selectedRate.amount, selectedRate.currency, locale)} (${formatDateLabel(selectedRate.valid_from, locale)})`
      : "";

  const deleteSurchargeConfirmLabel =
    selectedSurcharge && serverToday
      ? `${selectedSurcharge.surcharge_type_name} (${formatDateLabel(selectedSurcharge.valid_from, locale)})`
      : "";

  const title = t("profiles.panelCompensationOf", {
    name: truncateLabel(profile.full_name, 40),
  });

  return (
    <div
      className={cn(settingsSubModalOverlayClass(), (loading || pending) && "cursor-wait")}
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
          settingsSubModalDialogClass("3xl"),
          (loading || pending) && "[&_*]:cursor-wait",
          anyFormOpen ? "pointer-events-none" : ""
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "flex items-center justify-between border-b border-border",
            settingsModalHeaderPaddingClass()
          )}
        >
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

        <div className="shrink-0 space-y-3 bg-background px-4 py-3">
          <section className="overflow-hidden rounded-[var(--radius-control)] border border-border">
            <h4 className="border-b border-border bg-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {t("profiles.compensationSection")}
            </h4>
            <div
              className={cn(
                settingsScrollableTableListClass("rounded-none border-0"),
                SETTINGS_PROFILES_HALF_LIST_SCROLL_CLASS
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
                <table className="w-full min-w-[28rem] border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th
                        className={settingsStickyIndicatorHeaderClass()}
                        aria-hidden
                      />
                      <th className={settingsStickyColumnHeaderClass("right")}>
                        {t("profiles.hourlyRateColumnAmount")}
                      </th>
                      <th className={settingsStickyColumnHeaderClass()}>
                        {t("profiles.hourlyRateColumnValidFrom")}
                      </th>
                      <th className={settingsStickyColumnHeaderClass()}>
                        {t("profiles.hourlyRateColumnValidTo")}
                      </th>
                      <th className={settingsStickyColumnHeaderClass()}>
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
                            setSurchargeFormMode(null);
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
            <div className="shrink-0 border-t border-border px-3 py-2">
              <SettingsActionBar
                primary={
                  <SettingsPrimaryActionButton
                    label={t("profiles.new")}
                    icon={<PlusIcon />}
                    disabled={loading || pending || !canCreate}
                    onClick={() => {
                      setFormMode({ type: "create" });
                      setSurchargeFormMode(null);
                      setErrorMessage(null);
                    }}
                  />
                }
                secondary={
                  <SettingsIconActionButton
                    label={t("profiles.edit")}
                    icon={<PencilIcon />}
                    disabled={loading || pending || !selectedRate || !canEdit}
                    onClick={() => {
                      if (!selectedRate || !canEdit) return;
                      setFormMode({ type: "edit", rate: selectedRate });
                      setSurchargeFormMode(null);
                      setConfirmDelete(false);
                      setErrorMessage(null);
                    }}
                  />
                }
                destructive={
                  <SettingsIconActionButton
                    label={t("profiles.delete")}
                    icon={<TrashIcon />}
                    disabled={loading || pending || !selectedRate || !canDelete}
                    onClick={() => {
                      setFormMode(null);
                      setConfirmDelete(true);
                    }}
                  />
                }
              />
            </div>
          </section>

          <section className="overflow-hidden rounded-[var(--radius-control)] border border-border">
            <h4 className="border-b border-border bg-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {t("profiles.surchargesSection")}
            </h4>
            <div
              className={cn(
                settingsScrollableTableListClass("rounded-none border-0"),
                SETTINGS_PROFILES_HALF_LIST_SCROLL_CLASS
              )}
            >
              {loading ? (
                <SettingsEmptyState
                  message={t("common.loading")}
                  className={EMPTY_STATE_CLASS}
                />
              ) : surchargeEntries.length === 0 ? (
                <SettingsEmptyState
                  message={t("profiles.noSurcharges")}
                  hint={t("common.emptyHintCreate")}
                  className={EMPTY_STATE_CLASS}
                />
              ) : (
                <table className="w-full min-w-[36rem] border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th
                        className={settingsStickyIndicatorHeaderClass()}
                        aria-hidden
                      />
                      <th className={settingsStickyColumnHeaderClass()}>
                        {t("profiles.surchargeColumnName")}
                      </th>
                      <th className={settingsStickyColumnHeaderClass()}>
                        {t("profiles.surchargeColumnTrigger")}
                      </th>
                      <th className={settingsStickyColumnHeaderClass("right")}>
                        {t("profiles.surchargeColumnAmount")}
                      </th>
                      <th className={settingsStickyColumnHeaderClass()}>
                        {t("profiles.hourlyRateColumnValidFrom")}
                      </th>
                      <th className={settingsStickyColumnHeaderClass()}>
                        {t("profiles.hourlyRateColumnValidTo")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {surchargeEntries.map((entry) => {
                      const isSelected = entry.id === selectedSurchargeId;
                      const resolvedAmount = resolveProfileSurchargeAmount(entry);
                      return (
                        <tr
                          key={entry.id}
                          {...settingsListItemAttrs(entry.id)}
                          onClick={() => {
                            setSelectedSurchargeId(entry.id);
                            setSurchargeFormMode(null);
                            setFormMode(null);
                          }}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            window.getSelection()?.removeAllRanges();
                            if (!COMPENSATION_SURCHARGES_UI_ENABLED) return;
                            if (
                              !serverToday ||
                              !isMutableHourlyRate(entry.valid_from, serverToday)
                            ) {
                              return;
                            }
                            setSurchargeFormMode({ type: "edit", entry });
                          }}
                          className={settingsDataRowClass(isSelected)}
                        >
                          <td
                            className={settingsIndicatorCellClass(isSelected)}
                            aria-hidden
                          />
                          <td
                            className={settingsDataCellClass(isSelected, {
                              className: "font-medium",
                            })}
                          >
                            {entry.surcharge_type_name}
                          </td>
                          <td className={settingsDataCellClass(isSelected)}>
                            {formatSurchargeTriggerLabel(entry.trigger, t)}
                          </td>
                          <td
                            className={settingsDataCellClass(isSelected, {
                              align: "right",
                              className: "whitespace-nowrap tabular-nums",
                            })}
                          >
                            {formatSurchargeAmountLabel(
                              resolvedAmount,
                              entry.type_default_unit,
                              localeKey
                            )}
                            {entry.amount === null ? (
                              <span className="ml-1 text-xs text-muted">
                                ({t("profiles.orgDefaultShort")})
                              </span>
                            ) : null}
                          </td>
                          <td className={settingsDataCellClass(isSelected)}>
                            {formatDateLabel(entry.valid_from, locale)}
                          </td>
                          <td className={settingsDataCellClass(isSelected)}>
                            {entry.valid_to
                              ? formatDateLabel(entry.valid_to, locale)
                              : t("profiles.hourlyRateOpen")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="shrink-0 border-t border-border px-3 py-2">
              <SettingsActionBar
                primary={
                  <SettingsPrimaryActionButton
                    label={t("profiles.assignSurcharge")}
                    icon={<PlusIcon />}
                    disabled={
                      !COMPENSATION_SURCHARGES_UI_ENABLED ||
                      loading ||
                      pending ||
                      !canCreateSurcharge
                    }
                    onClick={() => {
                      if (!COMPENSATION_SURCHARGES_UI_ENABLED) return;
                      setSurchargeFormMode({ type: "create" });
                      setFormMode(null);
                      setErrorMessage(null);
                    }}
                  />
                }
                secondary={
                  <SettingsIconActionButton
                    label={t("profiles.edit")}
                    icon={<PencilIcon />}
                    disabled={
                      !COMPENSATION_SURCHARGES_UI_ENABLED ||
                      loading ||
                      pending ||
                      !selectedSurcharge ||
                      !canEditSurcharge
                    }
                    onClick={() => {
                      if (!COMPENSATION_SURCHARGES_UI_ENABLED) return;
                      if (!selectedSurcharge || !canEditSurcharge) return;
                      setSurchargeFormMode({
                        type: "edit",
                        entry: selectedSurcharge,
                      });
                      setFormMode(null);
                      setConfirmDeleteSurcharge(false);
                      setErrorMessage(null);
                    }}
                  />
                }
                destructive={
                  <SettingsIconActionButton
                    label={t("profiles.delete")}
                    icon={<TrashIcon />}
                    disabled={
                      !COMPENSATION_SURCHARGES_UI_ENABLED ||
                      loading ||
                      pending ||
                      !selectedSurcharge ||
                      !canDeleteSurcharge
                    }
                    onClick={() => {
                      if (!COMPENSATION_SURCHARGES_UI_ENABLED) return;
                      setSurchargeFormMode(null);
                      setConfirmDeleteSurcharge(true);
                    }}
                  />
                }
              />
            </div>
          </section>
        </div>

        <div className={settingsModalFooterClass("shrink-0")}>
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
      {COMPENSATION_SURCHARGES_UI_ENABLED &&
        surchargeFormMode?.type === "create" &&
        serverToday && (
        <ProfileCompensationSurchargeFormModal
          mode="create"
          profileId={profile.id}
          serverToday={serverToday}
          currentEntry={currentCompensationEntry}
          availableTypes={availableSurchargeTypes}
          onClose={() => setSurchargeFormMode(null)}
          onSaved={handleSurchargeSaved}
        />
      )}
      {COMPENSATION_SURCHARGES_UI_ENABLED &&
        surchargeFormMode?.type === "edit" &&
        serverToday && (
        <ProfileCompensationSurchargeFormModal
          mode="edit"
          profileId={profile.id}
          serverToday={serverToday}
          currentEntry={currentCompensationEntry}
          availableTypes={availableSurchargeTypes}
          editingEntry={surchargeFormMode.entry}
          onClose={() => setSurchargeFormMode(null)}
          onSaved={handleSurchargeSaved}
        />
      )}
      {COMPENSATION_SURCHARGES_UI_ENABLED &&
        confirmDeleteSurcharge &&
        selectedSurcharge && (
        <DeleteConfirmModal
          name={deleteSurchargeConfirmLabel}
          pending={pending}
          onCancel={() => setConfirmDeleteSurcharge(false)}
          onConfirm={handleDeleteSurcharge}
        />
      )}
    </div>
  );
}
