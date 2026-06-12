import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { parseComplianceMarkdown } from "./parse";
import type { CountryCompliance } from "./types";

/** Repo root: packages/compliance/src → ../../../ */
const COMPLIANCE_DIR = join(__dirname, "../../../compliances");

function readComplianceFile(filename: string): CountryCompliance {
  const content = readFileSync(join(COMPLIANCE_DIR, filename), "utf8");
  const parsed = parseComplianceMarkdown(content);
  return {
    meta: parsed.meta,
    rules: parsed.rules,
    documentation: parsed.documentation,
  };
}

/** Nur Node.js — liest compliances/*.md vom Dateisystem (Dev/CLI). */
export function loadComplianceCountriesFromFilesystem(): CountryCompliance[] {
  const files = readdirSync(COMPLIANCE_DIR).filter(
    (f) => f.endsWith(".md") && f !== "README.md"
  );
  return files.map(readComplianceFile);
}
