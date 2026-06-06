import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { getDatabase } from "@/lib/db";
import { colors, radius, spacing } from "@schichtwerk/ui-tokens";
import type { Profile } from "@schichtwerk/types";

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    void getDatabase()
      .getCurrentUserProfile()
      .then((loaded) => {
        setProfile(loaded);
        setEmail(loaded?.email ?? "");
      });
  }, []);

  async function handleSignOut() {
    await getDatabase().authSignOut();
    router.replace("/login");
  }

  function confirmSignOut() {
    Alert.alert("Abmelden", "Möchtest du dich abmelden?", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Abmelden", style: "destructive", onPress: handleSignOut },
    ]);
  }

  async function handleSaveEmail() {
    if (!profile) return;
    setSavingEmail(true);
    try {
      const result = await getDatabase().updateCurrentUserProfileEmail(email);
      if (!result.ok) {
        Alert.alert("E-Mail konnte nicht geändert werden", result.error);
        return;
      }

      setProfile(result.profile);
      setEmail(result.profile.email);

      if (result.confirmationRequired) {
        Alert.alert(
          "Bestätigung erforderlich",
          "Wir haben dir einen Link zur Bestätigung der neuen E-Mail-Adresse gesendet. Bis zur Bestätigung meldest du dich weiter mit der bisherigen Adresse an."
        );
        return;
      }

      Alert.alert("Gespeichert", "Deine E-Mail-Adresse wurde aktualisiert.");
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
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
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

      <Pressable style={styles.button} onPress={confirmSignOut}>
        <Text style={styles.buttonText}>Abmelden</Text>
      </Pressable>
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
  },
  buttonText: { color: "#DC2626", fontWeight: "600" },
});
