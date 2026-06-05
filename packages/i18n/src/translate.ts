import type { Messages } from "./messages";

export type TranslationParams = Record<string, string | number>;

function getMessageValue(messages: Messages, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = messages;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    return value !== undefined ? String(value) : `{${name}}`;
  });
}

export function createTranslator(messages: Messages) {
  return function t(key: string, params?: TranslationParams): string {
    const value = getMessageValue(messages, key);
    if (value === undefined) return key;
    return interpolate(value, params);
  };
}

export type Translator = ReturnType<typeof createTranslator>;
