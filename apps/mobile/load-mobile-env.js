const fs = require("fs");
const path = require("path");

function applyEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadMobileEnv() {
  const mobileRoot = __dirname;
  applyEnvFile(path.join(mobileRoot, ".env"));
  applyEnvFile(path.join(mobileRoot, "../web/.env.local"));

  if (!process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (
    !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
  if (!process.env.EXPO_PUBLIC_WEB_APP_URL && process.env.NEXT_PUBLIC_SITE_URL) {
    process.env.EXPO_PUBLIC_WEB_APP_URL = process.env.NEXT_PUBLIC_SITE_URL;
  }
}

module.exports = { loadMobileEnv };
