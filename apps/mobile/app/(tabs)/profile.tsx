import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { getDatabase } from "@/lib/db";
import { useAppDialog } from "@/lib/use-app-dialog";
import { colors, radius, spacing } from "@schichtwerk/ui-tokens";
import type { Profile } from "@schichtwerk/types";

export default function ProfileScreen() {
  const { alert, confirm, dialog } = useAppDialog();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    void getDatabase()
      .getCurrentUserProfile()
      .then((loaded) => {
        setProfile(loaded);
        setEmail(loaded?.email ?? "");
      });
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await getDatabase().authSignOut();
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }

  async function confirmSignOut() {
    const confirmed = await confirm({
      title: "Abmelden",
      message: "Möchtest du dich abmelden?",
      confirmLabel: "Abmelden",
      confirmDestructive: true,
    });
    if (confirmed) {
      await handleSignOut();
    }
  }

  async function handleSaveEmail() {
    if (!profile) return;
    setSavingEmail(true);
    try {
      const result = await getDatabase().updateCurrentUserProfileEmail(email);
      if (!result.ok) {
        await alert({
          title: "E-Mail konnte nicht geändert werden",
          message: result.error,
        });
        return;
      }

      setProfile(result.profile);
      setEmail(result.profile.email);

      if (result.confirmationRequired) {
        await alert({
          title: "Bestätigung erforderlich",
          message:
            "Wir haben dir einen Link zur Bestätigung der neuen E-Mail-Adresse gesendet. Bis zur Bestätigung meldest du dich weiter mit der bisherigen Adresse an.",
        });
        return;
      }

      await alert({
        title: "Gespeichert",
        message: "Deine E-Mail-Adresse wurde aktualisiert.",
      });
    } finally {
      setSavingEmail(false);
    }
  }

  const emailChanged =
    !!profile && email.trim().toLowerCase() !== profile.email.trim().toLowerCase();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{profile?.full_name ?? "—"}</Text>

        <Text style={[styles.label, { marginTop: spacing.md }]}>E-Mail</Text>
        <TextInput
          style={styles.input}
          nativeID="profile-email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!savingEmail}
          placeholder="name@beispiel.de"
          placeholderTextColor={colors.muted}
        />
        {emailChanged ? (
          <Pressable
            style={[styles.saveButton, savingEmail && styles.saveButtonDisabled]}
            onPress={() => void handleSaveEmail()}
            disabled={savingEmail}
          >
            {savingEmail ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.saveButtonText}>E-Mail speichern</Text>
            )}
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.section}>Einstellungen</Text>
      <Text style={styles.muted}>
        Push-Benachrichtigungen werden mit Expo Notifications ergänzt.
      </Text>

      <Pressable
        style={[styles.button, signingOut && styles.buttonDisabled]}
        onPress={() => void confirmSignOut()}
        disabled={signingOut}
      >
        {signingOut ? (
          <ActivityIndicator color={colors.destructive} />
        ) : (
          <Text style={styles.buttonText}>Abmelden</Text>
        )}
      </Pressable>
      {dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  label: { fontSize: 12, color: colors.muted, textTransform: "uppercase" },
  value: { fontSize: 16, color: colors.foreground, marginTop: 4 },
  input: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  saveButton: {
    marginTop: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
  section: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  button: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.destructive, fontWeight: "600" },
});
