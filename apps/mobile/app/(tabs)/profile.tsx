import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { getDatabase } from "@/lib/db";
import { colors, radius, spacing } from "@schichtwerk/ui-tokens";
import { useEffect, useState } from "react";
import type { Profile } from "@schichtwerk/types";

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    getDatabase()
      .getCurrentUserProfile()
      .then(setProfile);
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

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{profile?.full_name ?? "—"}</Text>
        <Text style={[styles.label, { marginTop: spacing.md }]}>E-Mail</Text>
        <Text style={styles.value}>{profile?.email ?? "—"}</Text>
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
