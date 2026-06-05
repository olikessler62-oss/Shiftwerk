import type { Locale } from "@schichtwerk/i18n/config";
import { de } from "@schichtwerk/i18n/messages/de";
import { en } from "@schichtwerk/i18n/messages/en";
import type { Messages } from "@schichtwerk/i18n/messages/types";

export const clientMessages: Record<Locale, Messages> = { de, en };
