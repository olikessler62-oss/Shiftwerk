"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Profile, ProfileRecurringAvailability } from "@schichtwerk/types";
import type { ProfileCompensationCacheEntry } from "./profile-compensation-panel-modal";
import { formatHourlyRateLabel } from "@/lib/profile-hourly-rate-display";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { formatProfileAvailabilitySummaryLabels } from "@/lib/profile-availability-label";
import { SettingsActionRow } from "./settings-list-ui";
import { cn } from "@/lib/cn";

const COMMA_LIST_SUFFIX = ", ...";

type DetailPanel = "qualifications" | "availability" | "compensation" | "invite";

type Props = {
  selectedProfile: Profile | null;
  /** Geladen: [] = keine Funktionen; undefined = noch nicht geladen */
  profileQualifications?: { name: string }[];
  /** Geladen: [] = keine Verfügbarkeiten; undefined = noch nicht geladen */
  profileAvailability?: ProfileRecurringAvailability[];
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
  const containerRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(() => items.join(", "));

  const recompute = useCallback(() => {
    const container = containerRef.current;
    const measureEl = measureRef.current;
    if (!container || !measureEl || items.length === 0) {
      setDisplay("");
      return;
    }

    const maxWidth = container.clientWidth;
    if (maxWidth <= 0) return;

    const measure = (text: string) => {
      measureEl.textContent = text;
      return measureEl.offsetWidth;
    };

    const full = items.join(", ");
    if (measure(full) <= maxWidth) {
      setDisplay(full);
      return;
    }

    for (let count = items.length - 1; count >= 1; count--) {
      const candidate = items.slice(0, count).join(", ") + COMMA_LIST_SUFFIX;
      if (measure(candidate) <= maxWidth) {
        setDisplay(candidate);
        return;
      }
    }

    const first = items[0];
    if (items.length > 1 && measure(first + COMMA_LIST_SUFFIX) <= maxWidth) {
      setDisplay(first + COMMA_LIST_SUFFIX);
      return;
    }

    let trimmed = first;
    while (trimmed.length > 0 && measure(`${trimmed}…`) > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    setDisplay(trimmed.length > 0 ? `${trimmed}…` : first);
  }, [items]);

  useLayoutEffect(() => {
    recompute();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => recompute());
    observer.observe(container);
    return () => observer.disconnect();
  }, [recompute]);

  const fullTitle = items.join(", ");

  return (
    <span className="relative block min-w-0">
      <span
        ref={containerRef}
        className={cn("block truncate text-xs", className)}
        title={fullTitle}
      >
        {display}
      </span>
      <span
        ref={measureRef}
        className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap text-xs"
        aria-hidden
      />
    </span>
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
  profileCompensation,
  disabled = false,
  onOpen,
}: Props) {
  const { locale } = useLocale();
  const localeKey = locale === "en" ? "en" : "de";
  const t = useTranslations();
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
  const availabilityLabels =
    profileAvailability !== undefined
      ? formatProfileAvailabilitySummaryLabels(profileAvailability, localeKey)
      : [];
  const availabilityHint =
    availabilityLabels.length > 0 ? (
      <FittingCommaList items={availabilityLabels} className="text-primary" />
    ) : (
      t("profiles.actionAvailabilityHint")
    );
  const currentHourlyRate = profileCompensation?.currentRate ?? null;
  const compensationHint = currentHourlyRate ? (
    <span className="block truncate text-xs text-primary">
      {formatHourlyRateLabel(currentHourlyRate, localeKey)}
    </span>
  ) : (
    t("profiles.actionCompensationHint")
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
        <SettingsActionRow
          icon={<QualificationsIcon />}
          label={t("profiles.panelQualifications")}
          hint={qualificationsHint}
          disabled={profileActionsDisabled}
          onClick={() => onOpen("qualifications")}
        />
        <div className="mx-2 border-t border-border/60" />
        <SettingsActionRow
          icon={<AvailabilityIcon />}
          label={t("profiles.panelAvailability")}
          hint={availabilityHint}
          disabled={profileActionsDisabled}
          onClick={() => onOpen("availability")}
        />
        <div className="mx-2 border-t border-border/60" />
        <SettingsActionRow
          icon={<CompensationIcon />}
          label={t("profiles.panelCompensation")}
          hint={compensationHint}
          disabled={profileActionsDisabled}
          onClick={() => onOpen("compensation")}
        />
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
