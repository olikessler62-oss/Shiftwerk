import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { getDatabase } from "@/lib/db";
import { colors, radius, spacing } from "@schichtwerk/ui-tokens";
import type { ProfileShiftPreference } from "@schichtwerk/types";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So", "FT"];

export default function AvailabilityScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<ProfileShiftPreference[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [weekday, setWeekday] = useState("0");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("12:00");

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const db = getDatabase();
      const profile = await db.getCurrentUserProfile();
      if (!profile) {
        setPreferences([]);
        return;
      }
      setOrganizationId(profile.organization_id);
      setProfileId(profile.id);
      const rows = await db.listProfileShiftPreferences(
        profile.organization_id,
        profile.id
      );
      setPreferences(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  async function handleAdd() {
    if (!organizationId || !profileId) return;
    setSaving(true);
    try {
      const db = getDatabase();
      await db.insertProfileShiftPreference(organizationId, profileId, {
        weekday: Number.parseInt(weekday, 10),
        start_time: startTime,
        end_time: endTime,
      });
      await loadPreferences();
      Alert.alert("Gespeichert", "Wunsch-Einsatzzeit wurde hinzugefügt.");
    } catch (error) {
      Alert.alert(
        "Speichern fehlgeschlagen",
        error instanceof Error ? error.message : "Unbekannter Fehler"
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(entry: ProfileShiftPreference) {
    Alert.alert(
      "Wunsch löschen",
      `${WEEKDAY_LABELS[entry.weekday] ?? entry.weekday} ${entry.start_time.slice(0, 5)}–${entry.end_time.slice(0, 5)}`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: () => void deletePreference(entry.id),
        },
      ]
    );
  }

  async function deletePreference(preferenceId: string) {
    if (!organizationId || !profileId) return;
    setSaving(true);
    try {
      await getDatabase().deleteProfileShiftPreference(
        organizationId,
        profileId,
        preferenceId
      );
      await loadPreferences();
    } catch (error) {
      Alert.alert(
        "Löschen fehlgeschlagen",
        error instanceof Error ? error.message : "Unbekannter Fehler"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Verfügbarkeit</Text>
      <Text style={styles.intro}>
        Wunsch-Einsatzzeiten helfen der Planung, dich bevorzugt in passende
        Schichten einzutragen. Sie ersetzen nicht deine Verfügbarkeit.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Neue Wunsch-Einsatzzeit</Text>
        <Text style={styles.label}>Wochentag (0=Mo … 7=FT)</Text>
        <TextInput
          style={styles.input}
          nativeID="preference-weekday"
          value={weekday}
          onChangeText={setWeekday}
          keyboardType="number-pad"
          autoComplete="off"
          editable={!saving}
        />
        <Text style={styles.label}>Von (HH:MM)</Text>
        <TextInput
          style={styles.input}
          nativeID="preference-start-time"
          value={startTime}
          onChangeText={setStartTime}
          autoComplete="off"
          editable={!saving}
        />
        <Text style={styles.label}>Bis (HH:MM)</Text>
        <TextInput
          style={styles.input}
          nativeID="preference-end-time"
          value={endTime}
          onChangeText={setEndTime}
          autoComplete="off"
          editable={!saving}
        />
        <Pressable
          style={[styles.primaryButton, saving && styles.buttonDisabled]}
          onPress={() => void handleAdd()}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Hinzufügen</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Deine Wünsche</Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
      ) : preferences.length === 0 ? (
        <Text style={styles.muted}>Noch keine Wunsch-Einsatzzeiten hinterlegt.</Text>
      ) : (
        preferences.map((entry) => (
          <View key={entry.id} style={styles.listItem}>
            <View style={styles.listItemText}>
              <Text style={styles.listItemTitle}>
                {WEEKDAY_LABELS[entry.weekday] ?? entry.weekday}{" "}
                {entry.start_time.slice(0, 5)}–{entry.end_time.slice(0, 5)}
              </Text>
              {entry.location_area_id ? (
                <Text style={styles.muted}>Bereich: {entry.location_area_id}</Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => confirmDelete(entry)}
              disabled={saving}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteButtonText}>Löschen</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  intro: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 12,
    color: colors.muted,
    textTransform: "uppercase",
    marginTop: spacing.sm,
  },
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
  primaryButton: {
    marginTop: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "600", fontSize: 15 },
  buttonDisabled: { opacity: 0.7 },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  listItemText: { flex: 1, paddingRight: spacing.sm },
  listItemTitle: { fontSize: 15, color: colors.foreground, fontWeight: "500" },
  deleteButton: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  deleteButtonText: { color: "#DC2626", fontWeight: "600", fontSize: 13 },
});
