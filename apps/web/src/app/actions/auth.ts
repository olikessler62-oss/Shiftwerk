"use server";

import { redirect } from "next/navigation";
import { getAdminDatabase, getDatabase } from "@/lib/db";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const db = await getDatabase();

  const { error } = await db.authSignInWithPassword(email, password);
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error)}`);
  }
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "");
  const orgName = String(formData.get("orgName") ?? "Mein Betrieb");

  const db = await getDatabase();
  const admin = getAdminDatabase();

  const { data: authData, error: signUpError } = await db.authSignUp(email, password, {
    full_name: fullName,
  });

  if (signUpError || !authData) {
    redirect(
      `/register?error=${encodeURIComponent(signUpError ?? "Registrierung fehlgeschlagen")}`
    );
  }

  const userId = authData.user.id;

  let orgId: string;
  try {
    const org = await admin.createOrganization(orgName);
    orgId = org.id;
  } catch (e) {
    redirect(
      `/register?error=${encodeURIComponent(
        e instanceof Error ? e.message : "Organisation konnte nicht angelegt werden"
      )}`
    );
  }

  try {
    await admin.seedDefaultRoles(orgId);
    await admin.insertProfile({
      id: userId,
      organization_id: orgId,
      role: "admin",
      full_name: fullName,
      email,
    });
  } catch (e) {
    await admin.deleteOrganization(orgId);
    redirect(
      `/register?error=${encodeURIComponent(
        e instanceof Error ? e.message : "Profil fehlgeschlagen"
      )}`
    );
  }

  try {
    await admin.seedDefaultShiftTypes(orgId);
  } catch (seedError) {
    const msg =
      seedError instanceof Error ? seedError.message : "Schichttypen fehlgeschlagen";
    redirect(`/register?error=${encodeURIComponent(msg)}`);
  }

  if (!authData.session) {
    redirect(
      `/login?message=${encodeURIComponent("Konto erstellt. Bitte E-Mail bestätigen und anmelden.")}`
    );
  }

  redirect("/dashboard");
}

export async function signOut() {
  const db = await getDatabase();
  await db.authSignOut();
  redirect("/login");
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function passwordResetRedirectTo(): string {
  const next = encodeURIComponent("/reset-password");
  return `${siteUrl()}/auth/callback?next=${next}`;
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    redirect(
      `/forgot-password?error=${encodeURIComponent("Bitte eine E-Mail-Adresse eingeben.")}`
    );
  }

  const db = await getDatabase();
  await db.authResetPasswordForEmail(email, passwordResetRedirectTo());

  redirect(
    `/forgot-password?message=${encodeURIComponent(
      "Falls ein Konto mit dieser E-Mail existiert, haben wir dir einen Link zum Zurücksetzen des Passworts gesendet."
    )}`
  );
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    redirect(
      `/reset-password?error=${encodeURIComponent("Das Passwort muss mindestens 8 Zeichen haben.")}`
    );
  }

  if (password !== confirmPassword) {
    redirect(
      `/reset-password?error=${encodeURIComponent("Die Passwörter stimmen nicht überein.")}`
    );
  }

  const db = await getDatabase();
  const user = await db.authGetUser();
  if (!user) {
    redirect(
      `/forgot-password?error=${encodeURIComponent(
        "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an."
      )}`
    );
  }

  const { error } = await db.authUpdatePassword(password);
  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error)}`);
  }

  await db.authSignOut();
  redirect(
    `/login?message=${encodeURIComponent(
      "Passwort wurde gesetzt. Du kannst dich jetzt anmelden."
    )}`
  );
}
