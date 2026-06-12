import Link from "next/link";
import { signUp } from "@/app/actions/auth";
import { RegisterIndustryPicker } from "@/components/auth/register-industry-picker";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { clientMessages } from "@/i18n/client-messages";
import { getServerLocale } from "@/i18n/server";
import { createTranslator } from "@schichtwerk/i18n/translate";
import { listCompliancePresets } from "@schichtwerk/compliance";
import type { Industry } from "@schichtwerk/types";
import { translateRegisterError } from "@/lib/translate-action-error";

const REGISTER_INDUSTRY_ORDER: Industry[] = [
  "gastronomy",
  "care",
  "retail",
  "other",
];

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const locale = await getServerLocale();
  const t = createTranslator(clientMessages[locale]);
  const countries = listCompliancePresets();

  const industryCards = REGISTER_INDUSTRY_ORDER.map((id) => {
    const labels: Record<
      Industry,
      {
        title: "industryGastronomy" | "industryCare" | "industryRetail" | "industryOther";
        hint:
          | "industryGastronomyHint"
          | "industryCareHint"
          | "industryRetailHint"
          | "industryOtherHint";
      }
    > = {
      gastronomy: {
        title: "industryGastronomy",
        hint: "industryGastronomyHint",
      },
      care: { title: "industryCare", hint: "industryCareHint" },
      retail: { title: "industryRetail", hint: "industryRetailHint" },
      other: { title: "industryOther", hint: "industryOtherHint" },
    };
    const keys = labels[id];
    return {
      id,
      title: t(`register.${keys.title}`),
      hint: t(`register.${keys.hint}`),
    };
  });

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold">{t("register.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("register.subtitle")}</p>
        </div>

        {error && (
          <Alert variant="error" className="mb-4">
            {translateRegisterError(error, t) ?? error}
          </Alert>
        )}

        <form action={signUp} className="space-y-4">
          <div>
            <p
              id="register-industry-heading"
              className="mb-2 text-sm font-medium text-foreground"
            >
              {t("register.industryHeading")}
            </p>
            <RegisterIndustryPicker
              options={industryCards}
              defaultIndustry="other"
              ariaLabelledBy="register-industry-heading"
            />
          </div>

          <Field label={t("register.orgName")} htmlFor="orgName">
            <Input
              id="orgName"
              name="orgName"
              required
              placeholder={t("register.orgNamePlaceholder")}
            />
          </Field>
          <Field label={t("register.country")} htmlFor="countryCode">
            <Select id="countryCode" name="countryCode" defaultValue="DE" required>
              {countries.map((country) => (
                <option key={country.meta.countryCode} value={country.meta.countryCode}>
                  {country.meta.jurisdiction}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("register.fullName")} htmlFor="fullName">
            <Input id="fullName" name="fullName" required />
          </Field>
          <Field label={t("register.email")} htmlFor="email">
            <Input id="email" name="email" type="email" required />
          </Field>
          <Field label={t("register.password")} htmlFor="password">
            <Input id="password" name="password" type="password" required minLength={8} />
          </Field>
          <Button type="submit" className="w-full">
            {t("register.submit")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {t("register.alreadyRegistered")}{" "}
          <Link href="/login" className="font-medium text-primary">
            {t("register.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
