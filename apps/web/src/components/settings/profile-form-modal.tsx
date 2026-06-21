"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createProfile, updateProfile } from "@/app/actions/profiles";
import {
  getProfileColorLabel,
  orderProfileColorsForDisplay,
  PROFILE_COLOR_PALETTE,
  validateProfileFullNameUniqueness,
  type ProfileColorOption,
} from "@schichtwerk/database";
import { cn } from "@/lib/cn";
import { useComboboxCloseOnPointerDistance } from "@/lib/use-combobox-close";
import type { Profile } from "@schichtwerk/types";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { useOrganization } from "@/lib/org-features-provider";
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

type Props = {
  mode: "create" | "edit";
  profile?: Profile;
  allProfiles: Profile[];
  onClose: () => void;
  onSaved: (profile: Profile) => void;
};

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
  const visibleColorRows = 3;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const closeCombobox = () => setOpen(false);
  useComboboxCloseOnPointerDistance(open, closeCombobox, [rootRef, listRef]);
  const selected = options.find(
    (option) => option.hex.toUpperCase() === value.toUpperCase()
  );

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
          ref={listRef}
          role="listbox"
          className={cn(
            "absolute z-20 mt-1 w-full rounded-md border border-border bg-surface py-1 shadow-lg",
            options.length > visibleColorRows &&
              "max-h-[calc(0.5rem+3*2.5rem)] overflow-y-auto"
          )}
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
  const organization = useOrganization();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [isActive, setIsActive] = useState(profile?.is_active ?? true);
  const [schedulable, setSchedulable] = useState(() => {
    const active = profile?.is_active ?? true;
    if (!active) return false;
    return profile?.schedulable ?? true;
  });
  const [email, setEmail] = useState(() => initialEmail(profile?.email));
  const [mobilePhone, setMobilePhone] = useState(profile?.mobile_phone ?? "");
  const [color, setColor] = useState(profile?.color ?? "");
  const [emailFallbackMode, setEmailFallbackMode] = useState(
    profile?.email_fallback_mode ?? false
  );
  const showEmailFallbackSetting =
    mode === "edit" &&
    profile?.role === "basic" &&
    organization.shift_confirmation_enabled;

  const usedColors = useMemo(() => {
    const set = new Set<string>();
    for (const item of allProfiles) {
      if (item.id === profile?.id || !item.color) continue;
      set.add(item.color.toUpperCase());
    }
    return set;
  }, [allProfiles, profile?.id]);

  const availableColors = useMemo(() => {
    const filtered = PROFILE_COLOR_PALETTE.filter(
      (option) =>
        !usedColors.has(option.hex.toUpperCase()) ||
        option.hex.toUpperCase() === color.toUpperCase()
    );
    return orderProfileColorsForDisplay(filtered);
  }, [usedColors, color]);

  useEffect(() => {
    if (color) return;
    const first = availableColors[0]?.hex;
    if (first) setColor(first);
  }, [availableColors, color]);

  function handleSubmit() {
    setError(null);
    if (!fullName.trim()) {
      setError(t("profiles.enterName"));
      return;
    }
    const nameCheck = validateProfileFullNameUniqueness(allProfiles, {
      full_name: fullName.trim(),
      excludeId: profile?.id,
    });
    if (!nameCheck.ok) {
      setError(t("profiles.duplicateFullName"));
      return;
    }
    if (!color) {
      setError(t("profiles.noColorsAvailable"));
      return;
    }

    startTransition(async () => {
      const payload = {
        full_name: fullName.trim(),
        is_active: isActive,
        schedulable: isActive ? schedulable : false,
        email,
        mobile_phone: mobilePhone,
        color,
        ...(showEmailFallbackSetting ? { email_fallback_mode: emailFallbackMode } : {}),
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
      className={settingsNestedModalOverlayClass()}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-form-title"
        className={settingsNestedModalDialogClass("lg")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "flex items-center justify-between border-b border-border",
            settingsModalHeaderPaddingClass()
          )}
        >
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

        <div
          className={cn(
            "max-h-[min(75dvh,36rem)] min-w-0 flex-1 overflow-x-hidden overflow-y-auto",
            settingsModalBodyPaddingClass()
          )}
        >
          {error && (
            <div className="mb-4">
              <Alert variant="error">{error}</Alert>
            </div>
          )}

          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={isActive}
                  disabled={pending}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsActive(checked);
                    if (checked) {
                      setSchedulable(true);
                    } else {
                      setSchedulable(false);
                    }
                  }}
                />
                {t("profiles.columnActive")}
              </label>

              <label
                className={cn(
                  "flex items-center gap-2 text-sm",
                  isActive
                    ? "cursor-pointer text-foreground"
                    : "cursor-not-allowed text-muted opacity-60"
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={schedulable}
                  disabled={pending || !isActive}
                  onChange={(e) => setSchedulable(e.target.checked)}
                />
                {t("profiles.columnSchedulable")}
              </label>
            </div>

            {showEmailFallbackSetting ? (
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border"
                  checked={emailFallbackMode}
                  disabled={pending}
                  onChange={(e) => setEmailFallbackMode(e.target.checked)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {t("profiles.emailFallbackModeLabel")}
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-muted">
                    {t("profiles.emailFallbackModeHint")}
                  </span>
                </span>
              </label>
            ) : null}

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
