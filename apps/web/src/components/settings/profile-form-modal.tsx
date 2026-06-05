"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createProfile, updateProfile } from "@/app/actions/profiles";
import { fetchProfileHourlyRates } from "@/app/actions/profile-hourly-rates";
import {
  getProfileColorLabel,
  PROFILE_COLOR_PALETTE,
  type ProfileColorOption,
} from "@schichtwerk/database";
import { cn } from "@/lib/cn";
import type { Profile } from "@schichtwerk/types";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
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
  profile?: Profile;
  allProfiles: Profile[];
  onClose: () => void;
  onSaved: (profile: Profile) => void;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayAfter(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function minValidFromForRateChange(currentValidFrom: string | null): string {
  const today = todayIso();
  if (!currentValidFrom) return today;
  const next = dayAfter(currentValidFrom);
  return today > next ? today : next;
}

function formatAmountForInput(amount: number, locale: string): string {
  const fixed = amount.toFixed(2);
  return locale === "en" ? fixed : fixed.replace(".", ",");
}

function parseAmountInput(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

function initialEmail(email?: string): string {
  if (!email) return "";
  if (email.endsWith("@pending.schichtwerk.local")) return "";
  return email;
}

function ColorDot({ hex }: { hex: string }) {
  return (
    <span
      className="size-3 shrink-0 rounded-full border border-border/60"
      style={{ backgroundColor: hex }}
      aria-hidden
    />
  );
}

function ProfileColorCombobox({
  value,
  options,
  onChange,
  disabled,
  localeKey,
  placeholder,
}: {
  value: string;
  options: readonly ProfileColorOption[];
  onChange: (hex: string) => void;
  disabled?: boolean;
  localeKey: "de" | "en";
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find(
    (option) => option.hex.toUpperCase() === value.toUpperCase()
  );

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm",
          disabled ? "cursor-not-allowed opacity-60" : "hover:bg-subtle"
        )}
      >
        {selected ? (
          <>
            <ColorDot hex={selected.hex} />
            <span className="min-w-0 flex-1 truncate text-left text-foreground">
              {getProfileColorLabel(selected.hex, localeKey)}
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-left text-muted">
            {placeholder}
          </span>
        )}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={cn(
            "shrink-0 text-muted transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && !disabled ? (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          {options.map((option) => {
            const isSelected = option.hex.toUpperCase() === value.toUpperCase();
            return (
              <li key={option.hex} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.hex);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-subtle",
                    isSelected && "bg-primary/5"
                  )}
                >
                  <ColorDot hex={option.hex} />
                  <span className="truncate">
                    {getProfileColorLabel(option.hex, localeKey)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function ProfileFormModal({
  mode,
  profile,
  allProfiles,
  onClose,
  onSaved,
}: Props) {
  const { locale } = useLocale();
  const localeKey = locale === "en" ? "en" : "de";
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [isActive, setIsActive] = useState(profile?.is_active ?? true);
  const [schedulable, setSchedulable] = useState(profile?.schedulable ?? true);
  const [email, setEmail] = useState(() => initialEmail(profile?.email));
  const [mobilePhone, setMobilePhone] = useState(profile?.mobile_phone ?? "");
  const [color, setColor] = useState(profile?.color ?? "");
  const [hourlyRate, setHourlyRate] = useState("");
  const [validFrom, setValidFrom] = useState(todayIso());
  const [initialHourlyAmount, setInitialHourlyAmount] = useState<number | null>(
    null
  );
  const [initialValidFrom, setInitialValidFrom] = useState<string | null>(null);
  const [hourlyCurrency, setHourlyCurrency] = useState("EUR");
  const [ratesLoading, setRatesLoading] = useState(mode === "edit");

  const usedColors = useMemo(() => {
    const set = new Set<string>();
    for (const item of allProfiles) {
      if (item.id === profile?.id || !item.color) continue;
      set.add(item.color.toUpperCase());
    }
    return set;
  }, [allProfiles, profile?.id]);

  const availableColors = useMemo(
    () =>
      PROFILE_COLOR_PALETTE.filter(
        (option) =>
          !usedColors.has(option.hex.toUpperCase()) ||
          option.hex.toUpperCase() === color.toUpperCase()
      ),
    [usedColors, color]
  );

  useEffect(() => {
    if (color) return;
    const first = availableColors[0]?.hex;
    if (first) setColor(first);
  }, [availableColors, color]);

  useEffect(() => {
    if (mode !== "edit" || !profile?.id) {
      setRatesLoading(false);
      return;
    }

    let cancelled = false;
    setRatesLoading(true);
    void fetchProfileHourlyRates(profile.id).then((result) => {
      if (cancelled) return;
      setRatesLoading(false);
      if (!result.ok) return;
      const current = result.currentRate ?? null;
      if (current) {
        setHourlyRate(formatAmountForInput(current.amount, locale));
        setValidFrom(current.valid_from);
        setInitialHourlyAmount(current.amount);
        setInitialValidFrom(current.valid_from);
        setHourlyCurrency(current.currency);
      } else {
        setInitialHourlyAmount(null);
        setInitialValidFrom(null);
        setHourlyCurrency("EUR");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [mode, profile?.id, locale]);

  function handleSubmit() {
    setError(null);
    if (!fullName.trim()) {
      setError(t("profiles.enterName"));
      return;
    }
    if (!color) {
      setError(t("profiles.noColorsAvailable"));
      return;
    }

    const parsedAmount = parseAmountInput(hourlyRate);
    const rateChanged =
      parsedAmount !== null &&
      (mode === "create" || parsedAmount !== initialHourlyAmount);
    const hourlyPayload =
      rateChanged && parsedAmount !== null
        ? { amount: hourlyRate.trim(), valid_from: validFrom }
        : undefined;

    startTransition(async () => {
      const payload = {
        full_name: fullName.trim(),
        is_active: isActive,
        schedulable,
        email,
        mobile_phone: mobilePhone,
        color,
        hourly_rate: hourlyPayload,
      };

      const result =
        mode === "create"
          ? await createProfile(payload)
          : await updateProfile({
              id: profile!.id,
              ...payload,
            });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.profile) {
        onSaved(result.profile);
      }
      onClose();
    });
  }

  return (
    <div
      className="absolute inset-0 z-[70] flex min-w-0 items-center justify-center rounded-2xl bg-black/30 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-form-title"
        className="relative z-[71] flex w-full max-w-[calc(100%-80px)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 id="profile-form-title" className={SETTINGS_MODAL_TITLE_CLASS}>
            {mode === "create"
              ? t("profiles.createTitle")
              : t("profiles.editTitle")}
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

        <div className="max-h-[min(75vh,36rem)] overflow-x-hidden overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-4">
              <Alert variant="error">{error}</Alert>
            </div>
          )}

          <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,calc((100%-1.5rem)*4/9+70px))_minmax(0,calc((100%-1.5rem)*5/9-70px))] md:items-start">
            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={isActive}
                    disabled={pending}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  {t("profiles.columnActive")}
                </label>

                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={schedulable}
                    disabled={pending}
                    onChange={(e) => setSchedulable(e.target.checked)}
                  />
                  {t("profiles.columnSchedulable")}
                </label>
              </div>

              <div>
                <LabelMuted>{t("profiles.columnName")}</LabelMuted>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("profiles.namePlaceholder")}
                  disabled={pending}
                />
              </div>

              <div>
                <LabelMuted>{t("profiles.color")}</LabelMuted>
                {availableColors.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">
                    {t("profiles.noColorsAvailable")}
                  </p>
                ) : (
                  <div className="mt-1">
                    <ProfileColorCombobox
                      value={color}
                      options={availableColors}
                      onChange={setColor}
                      disabled={pending}
                      localeKey={localeKey}
                      placeholder={t("profiles.selectColor")}
                    />
                  </div>
                )}
              </div>

              <div>
                <LabelMuted>{t("profiles.mobilePhone")}</LabelMuted>
                <Input
                  value={mobilePhone}
                  maxLength={20}
                  inputMode="numeric"
                  onChange={(e) =>
                    setMobilePhone(e.target.value.replace(/\D/g, "").slice(0, 20))
                  }
                  placeholder={t("profiles.mobilePhonePlaceholder")}
                  disabled={pending}
                  autoComplete="tel"
                />
              </div>

              <div>
                <LabelMuted>{t("profiles.email")}</LabelMuted>
                <Input
                  type="email"
                  value={email}
                  maxLength={60}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("profiles.emailPlaceholder")}
                  disabled={pending}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="min-w-0 space-y-4 md:border-l md:border-border md:pl-6">
              <h4 className="text-sm font-medium text-foreground">
                {t("profiles.compensationSection")}
              </h4>

              <div className="grid max-w-full grid-cols-[9.5rem_11rem] items-end gap-4">
                <div>
                  <LabelMuted>{t("profiles.currentHourlyRate")}</LabelMuted>
                  <div
                    className={cn(
                      "mt-1 flex w-full overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
                      (pending || ratesLoading) && "opacity-50"
                    )}
                  >
                    <input
                      value={ratesLoading ? "" : hourlyRate}
                      onChange={(e) => {
                        const next = e.target.value;
                        setHourlyRate(next);
                        const parsed = parseAmountInput(next);
                        if (
                          parsed !== null &&
                          mode === "edit" &&
                          parsed !== initialHourlyAmount
                        ) {
                          setValidFrom(
                            minValidFromForRateChange(initialValidFrom)
                          );
                        } else if (
                          parsed !== null &&
                          mode === "edit" &&
                          parsed === initialHourlyAmount &&
                          initialValidFrom
                        ) {
                          setValidFrom(initialValidFrom);
                        }
                      }}
                      placeholder={t("profiles.hourlyRatePlaceholder")}
                      disabled={pending || ratesLoading}
                      inputMode="decimal"
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
                    onChange={(e) => setValidFrom(e.target.value)}
                    disabled={pending || ratesLoading || !hourlyRate.trim()}
                    className="min-w-0"
                  />
                </div>
              </div>
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
            disabled={pending || availableColors.length === 0}
          >
            <CheckIcon />
            {t("common.ok")}
          </Button>
        </div>
      </div>
    </div>
  );
}
