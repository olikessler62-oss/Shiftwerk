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
} from "@schichtwerk/types";
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
  SettingsListRowDeleteButton,
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

const MAX_NAME_DISPLAY = 25;
const EMPTY_STATE_CLASS = "min-h-full";

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
  const [currentSurcharges, setCurrentSurcharges] = useState<
    EffectiveProfileCompensationSurcharge[]
  >(cachedCompensation?.currentSurcharges ?? []);
  const [surchargeEntries, setSurchargeEntries] = useState<
    ProfileCompensationSurcharge[]
  >(cachedCompensation?.surchargeEntries ?? []);
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
        currentSurcharges: result.currentSurcharges ?? currentSurcharges,
        surchargeEntries: result.surchargeEntries ?? surchargeEntries,
        serverToday: result.serverToday ?? serverToday,
      });
      setConfirmDelete(false);
    });
  }

  const deleteConfirmLabel =
    selectedRate && serverToday
      ? `${formatAmountLabel(selectedRate.amount, selectedRate.currency, locale)} (${formatDateLabel(selectedRate.valid_from, locale)})`
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
        aria-labelledby="profile-compensation-panel-title"
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
            id="profile-compensation-panel-title"
            className={SETTINGS_MODAL_TITLE_CLASS}
          >
            <span className="text-foreground">
              {t("profiles.panelCompensationOfPrefix")}{" "}
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
                  <th
                    className={settingsListRowDeleteHeaderClass()}
                    aria-hidden
                  />
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => {
                  const isSelected = rate.id === selectedRateId;
                  const rateMutable =
                    !!serverToday &&
                    isMutableHourlyRate(rate.valid_from, serverToday);
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
                      >
                        <span className="block max-w-full truncate">
                          {rate.created_by_name
                            ? truncateLabel(rate.created_by_name, 18)
                            : "—"}
                        </span>
                      </td>
                      <td className={settingsListRowDeleteCellClass(isSelected)}>
                        <SettingsListRowDeleteButton
                          label={t("profiles.delete")}
                          disabled={loading || pending || !rateMutable}
                          showTooltip={false}
                          onClick={() => {
                            setSelectedRateId(rate.id);
                            setFormMode(null);
                            setConfirmDelete(true);
                            setErrorMessage(null);
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

        <div className="shrink-0 border-t border-border px-4 py-2">
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
                disabled={loading || pending || !selectedRate || !canEdit}
                onClick={() => {
                  if (!selectedRate || !canEdit) return;
                  setFormMode({ type: "edit", rate: selectedRate });
                  setConfirmDelete(false);
                  setErrorMessage(null);
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
