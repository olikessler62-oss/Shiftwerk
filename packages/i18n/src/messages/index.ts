import type { Locale } from "../config";
import type { Messages } from "./types";
import { de } from "./de";
import { en } from "./en";

export type { Messages } from "./types";
export { de, en };

export const messages: Record<Locale, Messages> = { de, en };
