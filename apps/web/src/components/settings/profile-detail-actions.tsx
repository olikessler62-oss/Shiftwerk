"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Profile,
  ProfileRecurringAvailability,
  ProfileShiftPreference,
} from "@schichtwerk/types";
import type { ProfileCompensationCacheEntry } from "./profile-compensation-panel-modal";
import { formatHourlyRateLabel } from "@/lib/profile-hourly-rate-display";
import { formatEffectiveSurchargeSummary } from "@/lib/profile-surcharge-display";
import { COMPENSATION_SURCHARGES_UI_ENABLED } from "@/lib/compensation-surcharges-feature";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { useOrgFeatures } from "@/lib/org-features-provider";
import { SettingsActionRow } from "./settings-list-ui";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

const COMMA_LIST_SUFFIX = ", ...";

type DetailPanel =
  | "qualifications"
  | "availability"
  | "shiftPreferences"
  | "absences"
  | "compensation"
  | "surcharges"
  | "invite";

type Props = {
  selectedProfile: Profile | null;
  /** Geladen: [] = keine Funktion; undefined = noch nicht geladen */
  profileQualifications?: { name: string }[];
  /** Geladen: [] = keine Verfügbarkeiten; undefined = noch nicht geladen */
  profileAvailability?: ProfileRecurringAvailability[];
  /** Geladen: [] = keine Wunschzeiten; undefined = noch nicht geladen */
  profileShiftPreferences?: ProfileShiftPreference[];
  /** Geladen: currentRate null = kein aktueller Stundensatz; undefined = noch nicht geladen */
  profileCompensation?: ProfileCompensationCacheEntry;
  disabled?: boolean;
  onOpen: (panel: DetailPanel) => void;
};

function FittingCommaList({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapMeasureRef = useRef<HTMLSpanElement>(null);
  const singleMeasureRef = useRef<HTMLSpanElement>(null);
  const fullText = items.join(", ");
  const [display, setDisplay] = useState(fullText);
  const [isTruncated, setIsTruncated] = useState(false);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    const wrapMeasure = wrapMeasureRef.current;
    const singleMeasure = singleMeasureRef.current;
    if (!container || !wrapMeasure || !singleMeasure || items.length === 0) {
      setDisplay("");
      setIsTruncated(false);
      return;
    }

    const maxWidth = container.clientWidth;
    if (maxWidth <= 0) return;

    wrapMeasure.style.width = `${maxWidth}px`;
    wrapMeasure.textContent = fullText;
    const lineHeight =
      Number.parseFloat(getComputedStyle(wrapMeasure).lineHeight) || 16;
    const maxWrappedHeight = lineHeight * 2 + 1;

    if (wrapMeasure.scrollHeight <= maxWrappedHeight) {
      setDisplay(fullText);
      setIsTruncated(false);
      return;
    }

    const measure = (text: string) => {
      singleMeasure.textContent = text;
      return singleMeasure.offsetWidth;
    };

    if (measure(fullText) <= maxWidth) {
      setDisplay(fullText);
      setIsTruncated(false);
      return;
    }

    for (let count = items.length - 1; count >= 1; count--) {
      const candidate = items.slice(0, count).join(", ") + COMMA_LIST_SUFFIX;
      if (measure(candidate) <= maxWidth) {
        setDisplay(candidate);
        setIsTruncated(true);
        return;
      }
    }

    const first = items[0] ?? "";
    if (items.length > 1 && measure(first + COMMA_LIST_SUFFIX) <= maxWidth) {
      setDisplay(first + COMMA_LIST_SUFFIX);
      setIsTruncated(true);
      return;
    }

    let trimmed = first;
    while (trimmed.length > 0 && measure(`${trimmed}…`) > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    setDisplay(trimmed.length > 0 ? `${trimmed}…` : first);
    setIsTruncated(true);
  }, [fullText, items]);

  useLayoutEffect(() => {
    recompute();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => recompute());
    observer.observe(container);
    return () => observer.disconnect();
  }, [recompute]);

  return (
    <div ref={containerRef} className="relative min-w-0">
      <Tooltip content={fullText} disabled={!isTruncated}>
        <span
          className={cn(
            "block min-w-0 text-xs",
            isTruncated
              ? "truncate"
              : "whitespace-normal break-words leading-snug",
            className
          )}
        >
          {display}
        </span>
      </Tooltip>
      <span
        ref={wrapMeasureRef}
        className="pointer-events-none invisible absolute left-0 top-0 block text-xs leading-snug"
        aria-hidden
      />
      <span
        ref={singleMeasureRef}
        className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap text-xs"
        aria-hidden
      />
    </div>
  );
}

function QualificationsIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4z" />
      <path d="M9.5 12.5l2 2 4-4" />
    </svg>
  );
}

function AvailabilityIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function ShiftPreferenceIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6L12 2z" />
    </svg>
  );
}

function AbsencesIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 11h-6" />
    </svg>
  );
}

function SurchargesIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 2v20" />
      <path d="M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" />
      <path d="M19 5v4M21 7h-4" />
    </svg>
  );
}

function CompensationIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 2v20" />
      <path d="M17 6H9.5a3.5 3.5 0 100 7H14a3.5 3.5 0 110 7H6" />
    </svg>
  );
}

function InviteIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </svg>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2 pb-1 pt-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted first:pt-0">
      {children}
    </p>
  );
}

function ProfileSummary({ profile }: { profile: Profile }) {
  const t = useTranslations();

  return (
    <div className="rounded-lg border border-border/80 bg-background px-3 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">
          {profile.full_name}
        </p>
        <span
          className={cn(
            "shrink-0 text-xs font-medium",
            profile.is_active ? "text-emerald-600" : "text-red-600"
          )}
        >
          {profile.is_active ? t("profiles.activeYes") : t("profiles.activeNo")}
        </span>
        <span
          className={cn(
            "shrink-0 text-xs font-medium",
            profile.schedulable ? "text-emerald-600" : "text-red-600"
          )}
        >
          {profile.schedulable
            ? t("profiles.columnSchedulable")
            : t("profiles.notSchedulable")}
        </span>
      </div>
    </div>
  );
}

export function ProfileDetailActions({
  selectedProfile,
  profileQualifications,
  profileAvailability,
  profileShiftPreferences,
  profileCompensation,
  disabled = false,
  onOpen,
}: Props) {
  const { locale } = useLocale();
  const localeKey = locale === "en" ? "en" : "de";
  const t = useTranslations();
  const features = useOrgFeatures();
  const profileActionsDisabled = disabled || !selectedProfile;
  const qualificationNames =
    profileQualifications?.map((item) => item.name) ?? [];
  const qualificationsHint =
    qualificationNames.length > 0 ? (
      <FittingCommaList
        items={qualificationNames}
        className="text-primary"
      />
    ) : (
      t("profiles.actionQualificationsHint")
    );
  const availabilityHint =
    (profileAvailability?.length ?? 0) > 0 ? (
      <span className="block truncate text-xs text-primary">
        {t("profiles.actionAvailabilityConfigured")}
      </span>
    ) : (
      t("profiles.actionAvailabilityHint")
    );
  const shiftPreferencesHint =
    (profileShiftPreferences?.length ?? 0) > 0 ? (
      <span className="block truncate text-xs text-primary">
        {t("profiles.actionShiftPreferencesConfigured")}
      </span>
    ) : (
      t("profiles.actionShiftPreferencesHint")
    );
  const currentHourlyRate = profileCompensation?.currentRate ?? null;
  const currentSurcharges = profileCompensation?.currentSurcharges ?? [];
  const compensationHint = currentHourlyRate ? (
    <span className="block truncate text-xs text-primary">
      {t("profiles.actionCompensationCurrent", {
        rate: formatHourlyRateLabel(currentHourlyRate, localeKey),
      })}
    </span>
  ) : (
    t("profiles.actionCompensationHint")
  );
  const surchargesHint =
    currentSurcharges.length > 0 ? (
      <span className="block truncate text-xs text-primary">
        {formatEffectiveSurchargeSummary(currentSurcharges, localeKey)}
      </span>
    ) : (
      t("profiles.actionSurchargesHint")
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3 pt-2">
      {selectedProfile ? (
        <ProfileSummary profile={selectedProfile} />
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-background px-3 py-6 text-center text-sm text-muted">
          {t("profiles.selectProfileHint")}
        </p>
      )}

      <div className="mt-2 rounded-lg border border-border/80 bg-background px-1 py-1">
        {features.qualifications ? (
          <>
            <SettingsActionRow
              icon={<QualificationsIcon />}
              label={t("profiles.panelQualifications")}
              hint={qualificationsHint}
              disabled={profileActionsDisabled}
              onClick={() => onOpen("qualifications")}
            />
            <div className="mx-2 border-t border-border/60" />
          </>
        ) : null}
        <div className="grid grid-cols-2 divide-x divide-border/60">
          <SettingsActionRow
            icon={<AvailabilityIcon />}
            label={t("profiles.panelAvailability")}
            hint={availabilityHint}
            disabled={profileActionsDisabled}
            onClick={() => onOpen("availability")}
          />
          <SettingsActionRow
            icon={<ShiftPreferenceIcon />}
            label={t("profiles.panelShiftPreferences")}
            hint={shiftPreferencesHint}
            disabled={profileActionsDisabled}
            onClick={() => onOpen("shiftPreferences")}
          />
        </div>
        <div className="mx-2 border-t border-border/60" />
        <SettingsActionRow
          icon={<AbsencesIcon />}
          label={t("profiles.panelAbsences")}
          hint={t("profiles.actionAbsencesHint")}
          disabled={profileActionsDisabled}
          onClick={() => onOpen("absences")}
        />
        <div className="mx-2 border-t border-border/60" />
        <div
          className={cn(
            COMPENSATION_SURCHARGES_UI_ENABLED
              ? "grid grid-cols-2 divide-x divide-border/60"
              : undefined
          )}
        >
          <SettingsActionRow
            icon={<CompensationIcon />}
            label={t("profiles.panelCompensation")}
            hint={compensationHint}
            disabled={profileActionsDisabled}
            onClick={() => onOpen("compensation")}
          />
          {COMPENSATION_SURCHARGES_UI_ENABLED ? (
            <SettingsActionRow
              icon={<SurchargesIcon />}
              label={t("profiles.surchargesSection")}
              hint={surchargesHint}
              disabled={profileActionsDisabled}
              onClick={() => onOpen("surcharges")}
            />
          ) : null}
        </div>
      </div>

      <SectionLabel>{t("profiles.sectionOrganization")}</SectionLabel>
      <div className="rounded-lg border border-border/80 bg-background px-1 py-1">
        <SettingsActionRow
          icon={<InviteIcon />}
          label={t("profiles.inviteEmployee")}
          hint={t("profiles.actionInviteHint")}
          disabled={disabled}
          onClick={() => onOpen("invite")}
        />
      </div>
    </div>
  );
}
