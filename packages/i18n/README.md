# @schichtwerk/i18n

Shared translations for Schichtwerk apps.

- Add locales in `src/config.ts` and `src/messages/`.
- Use `createTranslator(messages[locale])` for `t("namespace.key", { params })`.

Web app: `LocaleProvider` + cookie `schichtwerk-locale`.
