import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { getDatabase } from "@/lib/db";
import { colors, radius, spacing } from "@schichtwerk/ui-tokens";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    const db = getDatabase();
    const { error } = await db.authSignInWithPassword(email.trim(), password);
    setLoading(false);

    if (error) {
      Alert.alert("Anmeldung fehlgeschlagen", error);
      return;
    }

    const profile = await db.getCurrentUserProfile();
    if (!profile || profile.role !== "basic") {
      await db.authSignOut();
      Alert.alert(
        "Nur für Mitarbeiter",
        "Manager nutzen bitte die Schichtwerk-Webseite."
      );
      return;
    }

    router.replace("/(tabs)");
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Schichtwerk</Text>
        <Text style={styles.subtitle}>Mitarbeiter-App</Text>

        <TextInput
          style={styles.input}
          nativeID="login-email"
          placeholder="E-Mail"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          nativeID="login-password"
          placeholder="Passwort"
          placeholderTextColor={colors.muted}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
        />

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Wird angemeldet…" : "Anmelden"}
          </Text>
        </Pressable>

        <Text style={styles.hint}>
          Zugangsdaten erhältst du von deinem Arbeitgeber per Einladung.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.foreground,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    marginBottom: spacing.lg,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontSize: 16,
    color: colors.foreground,
    backgroundColor: colors.surface,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: colors.primaryForeground,
    fontWeight: "600",
    fontSize: 16,
  },
  hint: {
    marginTop: spacing.lg,
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 18,
  },
});
