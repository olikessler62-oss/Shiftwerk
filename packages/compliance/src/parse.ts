import { parse as parseYaml } from "yaml";
import type { ParsedComplianceFile } from "./types";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

export function parseComplianceMarkdown(content: string): ParsedComplianceFile {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error("Compliance-Datei: YAML-Frontmatter fehlt (--- … ---).");
  }

  const [, frontmatter, documentation] = match;
  const parsed = parseYaml(frontmatter) as Partial<ParsedComplianceFile> | null;

  if (!parsed?.meta?.id || !parsed?.meta?.countryCode) {
    throw new Error("Compliance-Datei: meta.id und meta.countryCode sind Pflicht.");
  }

  if (!Array.isArray(parsed.rules) || parsed.rules.length === 0) {
    throw new Error("Compliance-Datei: mindestens eine Regel (rules) erforderlich.");
  }

  return {
    meta: parsed.meta,
    rules: parsed.rules,
    documentation: documentation.trim(),
  };
}
