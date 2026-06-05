const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateProfileEmail(
  raw: string
): { ok: true; email: string } | { ok: false; error: string } {
  const email = raw.trim().toLowerCase();
  if (!email) {
    return { ok: false, error: "Bitte eine E-Mail-Adresse eingeben." };
  }
  if (email.length > 60) {
    return { ok: false, error: "E-Mail darf höchstens 60 Zeichen lang sein." };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Bitte eine gültige E-Mail-Adresse eingeben." };
  }
  return { ok: true, email };
}

export function validateProfileMobilePhone(
  raw: string
): { ok: true; mobile_phone: string | null } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) {
    return { ok: true, mobile_phone: null };
  }
  if (value.length > 20) {
    return { ok: false, error: "Mobiltelefon darf höchstens 20 Ziffern haben." };
  }
  if (!/^[0-9]+$/.test(value)) {
    return { ok: false, error: "Mobiltelefon darf nur Ziffern enthalten." };
  }
  return { ok: true, mobile_phone: value };
}
