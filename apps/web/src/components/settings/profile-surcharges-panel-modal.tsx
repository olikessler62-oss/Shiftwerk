"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { fetchProfileHourlyRates } from "@/app/actions/profile-hourly-rates";
import { isMutableHourlyRate } from "@schichtwerk/database";
import type {
  Profile,
  ProfileCompensationSurcharge,
  CompensationSurchargeType,
} from "@schichtwerk/types";
import { fetchCompensationSurchargeTypes } from "@/app/actions/compensation-surcharge-types";
import { deleteProfileCompensationSurcharge } from "@/app/actions/profile-compensation-surcharges";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { formatDateLabel } from "@/lib/profile-hourly-rate-display";
import { ProfileCompensationSurchargeFormModal } from "./profile-compensation-surcharge-form-modal";
import type { ProfileCompensationCacheEntry } from "./profile-compensation-panel-modal";
import { formatSurchargeAmountLabel } from "@/lib/profile-compensation-calculation";
import {
  formatSurchargeTriggerLabel,
  resolveProfileSurchargeAmount,
  resolveProfileSurchargeUnit,
} from "@/lib/profile-surcharge-display";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  SETTINGS_PROFILES_LIST_SCROLL_CLASS,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
  SettingsListRowDeleteButton,
  SettingsListRowCheckbox,
  SettingsBulkDeleteActionButton,
  settingsListItemAttrs,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsScrollableTableListClass,
  settingsSubModalDialogClass,
  settingsSubModalOverlayClass,
  useScrollToSettingsListItem,
  settingsStickyColumnHeaderClass,
  settingsStickyIndicatorHeaderClass,
  settingsListRowDeleteCellClass,
  settingsListRowDeleteHeaderClass,
  settingsListRowCheckboxCellClass,
  settingsListRowCheckboxHeaderClass,
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
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { useSettingsListBulkSelection } from "@/lib/use-settings-list-bulk-selection";
import { COMPENSATION_SURCHARGES_UI_ENABLED } from "@/lib/compensation-surcharges-feature";

const MAX_NAME_DISPLAY = 25;
const EMPTY_STATE_CLASS = "min-h-full";

type SurchargeFormMode =
  | null
  | { type: "create" }
  | { type: "edit"; entry: ProfileCompensationSurcharge };

function truncateLabel(name: string, max = MAX_NAME_DISPLAY): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
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

export function ProfileSurchargesPanelModal({
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
  const [currentRate, setCurrentRate] = useState(
    cachedCompensation?.currentRate ?? null
  );
  const [rates, setRates] = useState(cachedCompensation?.rates ?? []);
  const [currentSurcharges, setCurrentSurcharges] = useState(
    cachedCompensation?.currentSurcharges ?? []
  );
  const [surchargeEntries, setSurchargeEntries] = useState<
    ProfileCompensationSurcharge[]
  >(cachedCompensation?.surchargeEntries ?? []);
  const [availableSurchargeTypes, setAvailableSurchargeTypes] = useState<
    CompensationSurchargeType[]
  >([]);
  const [selectedSurchargeId, setSelectedSurchargeId] = useState<string | null>(
    () =>
      cachedCompensation
        ? resolveDefaultSelectedSurchargeId(cachedCompensation.surchargeEntries)
        : null
  );
  const [serverToday, setServerToday] = useState(
    cachedCompensation?.serverToday ?? ""
  );
  const [surchargeFormMode, setSurchargeFormMode] =
    useState<SurchargeFormMode>(null);
  const [confirmDeleteSurcharge, setConfirmDeleteSurcharge] = useState(false);
  const [confirmBulkDeleteSurcharge, setConfirmBulkDeleteSurcharge] =
    useState(false);
  const [scrollToSurchargeId, setScrollToSurchargeId] = useState<string | null>(
    null
  );

  const syncLocalCompensation = useCallback(
    (entry: ProfileCompensationCacheEntry) => {
      setCurrentRate(entry.currentRate);
      setRates(entry.rates);
      setCurrentSurcharges(entry.currentSurcharges);
      setSurchargeEntries(entry.surchargeEntries);
      setServerToday(entry.serverToday);
      setSelectedSurchargeId((current) => {
        if (
          current &&
          entry.surchargeEntries.some((entryRow) => entryRow.id === current)
        ) {
          return current;
        }
        return resolveDefaultSelectedSurchargeId(entry.surchargeEntries);
      });
    },
    []
  );

  const applyCompensation = useCallback(
    (entry: ProfileCompensationCacheEntry) => {
      syncLocalCompensation(entry);
      onCacheUpdate(profile.id, entry);
    },
    [onCacheUpdate, profile.id, syncLocalCompensation]
  );

  const selectedSurcharge = useMemo(
    () =>
      surchargeEntries.find((entry) => entry.id === selectedSurchargeId) ?? null,
    [surchargeEntries, selectedSurchargeId]
  );
  const selectedSurchargeMutable =
    !!selectedSurcharge &&
    !!serverToday &&
    isMutableHourlyRate(selectedSurcharge.valid_from, serverToday);
  const canCreateSurcharge =
    COMPENSATION_SURCHARGES_UI_ENABLED &&
    !!serverToday &&
    availableSurchargeTypes.length > 0;
  const canEditSurcharge =
    COMPENSATION_SURCHARGES_UI_ENABLED && selectedSurchargeMutable;
  const canDeleteSurcharge =
    COMPENSATION_SURCHARGES_UI_ENABLED && selectedSurchargeMutable;

  const surchargeEntryIds = useMemo(
    () => surchargeEntries.map((entry) => entry.id),
    [surchargeEntries]
  );
  const mutableSurchargeIds = useMemo(() => {
    if (!COMPENSATION_SURCHARGES_UI_ENABLED || !serverToday) {
      return new Set<string>();
    }
    return new Set(
      surchargeEntries
        .filter((entry) => isMutableHourlyRate(entry.valid_from, serverToday))
        .map((entry) => entry.id)
    );
  }, [serverToday, surchargeEntries]);
  const bulkSelection = useSettingsListBulkSelection(surchargeEntryIds, {
    selectableIds: mutableSurchargeIds,
  });

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
      if (surchargeFormMode) {
        setSurchargeFormMode(null);
        return;
      }
      if (confirmDeleteSurcharge) {
        setConfirmDeleteSurcharge(false);
        return;
      }
      if (confirmBulkDeleteSurcharge) {
        setConfirmBulkDeleteSurcharge(false);
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmBulkDeleteSurcharge, confirmDeleteSurcharge, onClose, surchargeFormMode]);

  const anyFormOpen =
    !!surchargeFormMode || confirmDeleteSurcharge || confirmBulkDeleteSurcharge;

  function handleSurchargeSaved(
    entry: ProfileCompensationCacheEntry,
    selectedId: string,
    scrollToSelection = false
  ) {
    applyCompensation(entry);
    if (selectedId) setSelectedSurchargeId(selectedId);
    if (scrollToSelection && selectedId) setScrollToSurchargeId(selectedId);
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

  function handleBulkDeleteSurcharge() {
    const ids = surchargeEntryIds.filter((id) => bulkSelection.isChecked(id));
    if (ids.length === 0) return;
    setErrorMessage(null);
    startTransition(async () => {
      let latestEntry: ProfileCompensationCacheEntry = {
        currentRate,
        rates,
        currentSurcharges,
        surchargeEntries,
        serverToday,
      };
      for (const entryId of ids) {
        const result = await deleteProfileCompensationSurcharge({
          profileId: profile.id,
          entryId,
        });
        if (!result.ok) {
          setErrorMessage(result.error);
          if (result.surchargeEntries) {
            applyCompensation({
              currentRate,
              rates,
              currentSurcharges: result.currentSurcharges ?? currentSurcharges,
              surchargeEntries: result.surchargeEntries ?? [],
              serverToday: result.serverToday ?? serverToday,
            });
          }
          bulkSelection.clear();
          setConfirmBulkDeleteSurcharge(false);
          return;
        }
        latestEntry = {
          currentRate,
          rates,
          currentSurcharges: result.currentSurcharges ?? [],
          surchargeEntries: result.surchargeEntries ?? [],
          serverToday: result.serverToday ?? serverToday,
        };
      }
      applyCompensation(latestEntry);
      bulkSelection.clear();
      setConfirmBulkDeleteSurcharge(false);
    });
  }

  const deleteSurchargeConfirmLabel =
    selectedSurcharge && serverToday
      ? `${selectedSurcharge.surcharge_type_name} (${formatDateLabel(selectedSurcharge.valid_from, locale)})`
      : "";

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
        aria-labelledby="profile-surcharges-panel-title"
        aria-busy={loading || pending}
        aria-hidden={anyFormOpen}
        className={cn(
          settingsSubModalDialogClass("2xl"),
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
            id="profile-surcharges-panel-title"
            className={SETTINGS_MODAL_TITLE_CLASS}
          >
            <span className="text-foreground">
              {t("profiles.panelSurchargesOfPrefix")}{" "}
            </span>
            <span className="text-cyan-600">{profile.full_name}</span>
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
              settingsScrollableTableListClass(),
              SETTINGS_PROFILES_LIST_SCROLL_CLASS
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
                  <th
                    className={settingsListRowCheckboxHeaderClass()}
                    aria-hidden
                  />
                  <th
                    className={settingsListRowDeleteHeaderClass()}
                    aria-hidden
                  />
                </tr>
              </thead>
              <tbody>
                {surchargeEntries.map((entry) => {
                  const isSelected = entry.id === selectedSurchargeId;
                  const resolvedAmount = resolveProfileSurchargeAmount(entry);
                  const entryMutable =
                    COMPENSATION_SURCHARGES_UI_ENABLED &&
                    !!serverToday &&
                    isMutableHourlyRate(entry.valid_from, serverToday);
                  return (
                    <tr
                      key={entry.id}
                      {...settingsListItemAttrs(entry.id)}
                      onClick={() => {
                        setSelectedSurchargeId(entry.id);
                        setSurchargeFormMode(null);
                        setConfirmDeleteSurcharge(false);
                        setConfirmBulkDeleteSurcharge(false);
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
                          resolveProfileSurchargeUnit(entry),
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
                      <td className={settingsListRowCheckboxCellClass(isSelected)}>
                        <SettingsListRowCheckbox
                          checked={bulkSelection.isChecked(entry.id)}
                          disabled={loading || pending || !entryMutable}
                          ariaLabel={t("common.selectRow")}
                          onChange={() => bulkSelection.toggle(entry.id)}
                        />
                      </td>
                      <td className={settingsListRowDeleteCellClass(isSelected)}>
                        <SettingsListRowDeleteButton
                          label={t("profiles.delete")}
                          disabled={loading || pending || !entryMutable}
                          onClick={() => {
                            setSelectedSurchargeId(entry.id);
                            setSurchargeFormMode(null);
                            setConfirmDeleteSurcharge(true);
                          }}
                        />
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
                label={t("profiles.assignSurcharge")}
                icon={<PlusIcon />}
                disabled={loading || pending || !canCreateSurcharge}
                onClick={() => {
                  if (!COMPENSATION_SURCHARGES_UI_ENABLED) return;
                  setSurchargeFormMode({ type: "create" });
                  setConfirmDeleteSurcharge(false);
                  setConfirmBulkDeleteSurcharge(false);
                  setErrorMessage(null);
                }}
              />
            }
            secondary={
              <SettingsIconActionButton
                label={t("profiles.edit")}
                icon={<PencilIcon />}
                disabled={
                  loading || pending || !selectedSurcharge || !canEditSurcharge
                }
                onClick={() => {
                  if (!COMPENSATION_SURCHARGES_UI_ENABLED) return;
                  if (!selectedSurcharge || !canEditSurcharge) return;
                  setSurchargeFormMode({
                    type: "edit",
                    entry: selectedSurcharge,
                  });
                  setConfirmDeleteSurcharge(false);
                  setConfirmBulkDeleteSurcharge(false);
                  setErrorMessage(null);
                }}
              />
            }
            destructive={
              <SettingsBulkDeleteActionButton
                label={t("common.deleteSelectedEntries")}
                disabled={loading || pending || !bulkSelection.canBulkDelete}
                onClick={() => {
                  setConfirmDeleteSurcharge(false);
                  setSurchargeFormMode(null);
                  setConfirmBulkDeleteSurcharge(true);
                }}
              />
            }
          />
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
      {COMPENSATION_SURCHARGES_UI_ENABLED &&
        confirmBulkDeleteSurcharge &&
        bulkSelection.checkedCount > 0 && (
          <DeleteConfirmModal
            name={t("common.deleteSelectedEntries")}
            count={bulkSelection.checkedCount}
            pending={pending}
            onCancel={() => setConfirmBulkDeleteSurcharge(false)}
            onConfirm={handleBulkDeleteSurcharge}
          />
        )}
    </div>
  );
}
