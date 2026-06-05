"use client";

import { LOCALES, localeLabels, type Locale } from "@schichtwerk/i18n";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { Select } from "@/components/ui";
import { cn } from "@/lib/cn";

type Props = {
  className?: string;
};

export function LanguageSelect({ className }: Props) {
  const { locale, setLocale } = useLocale();
  const t = useTranslations();

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
