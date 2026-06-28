"use client";

import { useMemo } from "react";
import { LOCALES, localeLabels, type Locale } from "@schichtwerk/i18n";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { HeaderPillSelect } from "@/components/ui/header-placement-select";
import { Select } from "@/components/ui";
import { headerToolbarLanguageSelectTriggerClass } from "@/lib/header-toolbar-styles";
import { cn } from "@/lib/cn";

type Props = {
  className?: string;
  variant?: "default" | "header";
  /** Schmalere Breite in der kompakten Headerbar (< lg). */
  compact?: boolean;
};

export function LanguageSelect({
  className,
  variant = "default",
  compact = false,
}: Props) {
  const { locale, setLocale } = useLocale();
  const t = useTranslations();

  const languageOptions = useMemo(
    () =>
      LOCALES.map((loc) => ({
        value: loc,
        label: localeLabels[loc],
      })),
    []
  );

  if (variant === "header") {
    return (
      <HeaderPillSelect
        value={locale}
        options={languageOptions}
        onChange={(value) => setLocale(value as Locale)}
        aria-label={t("common.language")}
        wrapperClassName={cn(
          compact ? "max-w-[5.25rem]" : "max-w-[7.5rem]",
          className
        )}
        selectClassName={cn(
          headerToolbarLanguageSelectTriggerClass,
          compact && "pl-2 pr-6"
        )}
      />
    );
  }

  return (
    <label className={cn("flex items-center gap-2", className)}>
      <span className="sr-only">{t("common.language")}</span>
      <Select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t("common.language")}
        className="!w-auto min-w-[7.5rem] shrink-0"
      >
        {LOCALES.map((loc) => (
          <option key={loc} value={loc}>
            {localeLabels[loc]}
          </option>
        ))}
      </Select>
    </label>
  );
}
