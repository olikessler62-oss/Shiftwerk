import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { AbsenceType } from "@schichtwerk/types";
import type { MobileAbsenceItem } from "@/lib/absences-api";
import {
  cancelPendingAbsence,
  closeOpenSickAbsence,
  fetchMobileAbsences,
  reportAbsence,
} from "@/lib/absences-api";
import { MobileApiError } from "@/lib/mobile-api-client";
import { showAppAlert } from "@/lib/app-alert";
import { ResponsiveContentFrame } from "@/components/responsive-content-frame";
import { colors, radius, spacing } from "@schichtwerk/ui-tokens";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${isoDate}T12:00:00`));
}

function absenceTypeLabel(type: MobileAbsenceItem["type"]): string {
  switch (type) {
    case "sick":
      return "Krank";
    case "vacation":
      return "Urlaub";
    default:
      return "Sonstiges";
  }
}

function absenceStatusLabel(status: MobileAbsenceItem["status"]): string {
  switch (status) {
    case "pending":
      return "Ausstehend";
    case "approved":
      return "Genehmigt";
    case "rejected":
      return "Abgelehnt";
    case "cancelled":
      return "Zurückgezogen";
    default:
      return status;
  }
}

function statusBadgeColor(status: MobileAbsenceItem["status"]): string {
  switch (status) {
    case "pending":
      return colors.warning;
    case "approved":
      return colors.success;
    case "rejected":
      return colors.destructive;
    case "cancelled":
      return colors.muted;
    default:
      return colors.muted;
  }
}

function formatAbsenceRange(item: MobileAbsenceItem): string {
  const from = formatDate(item.startDate);
  if (item.isOpenEnded) {
    return `${from} – Offen`;
  }
  if (item.endDate) {
    return `${from} – ${formatDate(item.endDate)}`;
  }
  return from;
}

const ABSENCE_TYPE_OPTIONS: { value: AbsenceType; label: string }[] = [
  { value: "sick", label: "Krank" },
  { value: "vacation", label: "Urlaub" },
  { value: "other", label: "Sonstiges" },
];

function TypePicker({
  value,
  onChange,
}: {
  value: AbsenceType;
  onChange: (next: AbsenceType) => void;
}) {
  return (
    <View style={styles.typePickerRow}>
      {ABSENCE_TYPE_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            onPress={() => onChange(option.value)}
            style={[styles.typeChip, selected && styles.typeChipSelected]}
          >
            <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function AbsenceRow({
  item,
  onCancel,
  onCloseSick,
  busyId,
}: {
  item: MobileAbsenceItem;
  onCancel: (id: string) => void;
  onCloseSick: (id: string) => void;
  busyId: string | null;
}) {
  const isBusy = busyId === item.id;
  const canCancel = item.status === "pending";
  const canCloseSick =
    item.type === "sick" && item.status === "approved" && item.isOpenEnded;

  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowType}>{absenceTypeLabel(item.type)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusBadgeColor(item.status) }]}>
            <Text style={styles.statusBadgeText}>{absenceStatusLabel(item.status)}</Text>
          </View>
        </View>
        <Text style={styles.rowDates}>{formatAbsenceRange(item)}</Text>
        {item.expectedEndDate ? (
          <Text style={styles.rowMeta}>
            Voraussichtlich bis {formatDate(item.expectedEndDate)}
          </Text>
        ) : null}
        {item.notes ? <Text style={styles.rowNotes}>{item.notes}</Text> : null}
      </View>
      {(canCancel || canCloseSick) && (
        <View style={styles.rowActions}>
          {canCloseSick ? (
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => onCloseSick(item.id)}
              style={[styles.actionButton, styles.healthyButton]}
            >
              {isBusy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.actionButtonText}>Wieder gesund</Text>
              )}
            </Pressable>
          ) : null}
          {canCancel ? (
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => onCancel(item.id)}
              style={[styles.actionButton, styles.cancelButton]}
            >
              {isBusy ? (
                <ActivityIndicator color={colors.destructive} size="small" />
              ) : (
                <Text style={styles.cancelButtonText}>Zurückziehen</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default function AbsenceScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [absences, setAbsences] = useState<MobileAbsenceItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [absenceType, setAbsenceType] = useState<AbsenceType>("sick");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [isOpenEnded, setIsOpenEnded] = useState(true);
  const [expectedEndDate, setExpectedEndDate] = useState("");
  const [notes, setNotes] = useState("");

  const loadAbsences = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetchMobileAbsences();
      setAbsences(response.absences);
    } catch (error) {
      showAppAlert(
        "Laden fehlgeschlagen",
        error instanceof MobileApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unbekannter Fehler"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAbsences();
    }, [loadAbsences])
  );

  const sortedAbsences = useMemo(
    () =>
      [...absences].sort((a, b) => {
        if (a.startDate !== b.startDate) return b.startDate.localeCompare(a.startDate);
        return b.updatedAt.localeCompare(a.updatedAt);
      }),
    [absences]
  );

  function resetForm() {
    setAbsenceType("sick");
    setStartDate(todayISO());
    setEndDate(todayISO());
    setIsOpenEnded(true);
    setExpectedEndDate("");
    setNotes("");
  }

  function handleTypeChange(next: AbsenceType) {
    setAbsenceType(next);
    if (next !== "sick") {
      setIsOpenEnded(false);
      setExpectedEndDate("");
    }
  }

  async function handleSubmitAbsence() {
    if (!startDate.trim()) {
      showAppAlert("Eingabe prüfen", "Bitte ein Startdatum angeben.");
      return;
    }
    const openEnded = absenceType === "sick" && isOpenEnded;
    if (!openEnded && !endDate.trim()) {
      showAppAlert("Eingabe prüfen", "Bitte ein Enddatum angeben.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await reportAbsence({
        type: absenceType,
        startDate: startDate.trim(),
        endDate: openEnded ? null : endDate.trim(),
        isOpenEnded: openEnded,
        expectedEndDate:
          absenceType === "sick" ? expectedEndDate.trim() || null : null,
        notes: notes.trim() || null,
      });

      setShowForm(false);
      resetForm();
      await loadAbsences();

      const savedLabel =
        result.status === "pending"
          ? "Deine Meldung wurde eingereicht und wartet auf Genehmigung."
          : "Deine Meldung wurde übermittelt.";

      if (result.shiftConflictCount > 0) {
        showAppAlert(
          "Abwesenheit gespeichert",
          `${savedLabel} Hinweis: ${result.shiftConflictCount} geplante Schicht(en) liegen in diesem Zeitraum.`
        );
      } else {
        showAppAlert("Abwesenheit gespeichert", savedLabel);
      }
    } catch (error) {
      showAppAlert(
        "Speichern fehlgeschlagen",
        error instanceof MobileApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unbekannter Fehler"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    setBusyId(id);
    try {
      await cancelPendingAbsence(id);
      await loadAbsences();
    } catch (error) {
      showAppAlert(
        "Aktion fehlgeschlagen",
        error instanceof MobileApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unbekannter Fehler"
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleCloseSick(id: string) {
    setBusyId(id);
    try {
      await closeOpenSickAbsence(id, todayISO());
      await loadAbsences();
      showAppAlert("Erledigt", "Krankmeldung wurde geschlossen.");
    } catch (error) {
      showAppAlert(
        "Aktion fehlgeschlagen",
        error instanceof MobileApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unbekannter Fehler"
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.screen}>
      <ResponsiveContentFrame>
        <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadAbsences(true)}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Abwesenheit</Text>
          <Text style={styles.subtitle}>
            Krank, Urlaub oder Sonstiges melden und bestehende Einträge einsehen.
          </Text>
        </View>

        {!showForm ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowForm(true)}
            style={styles.primaryCta}
          >
            <Ionicons name="calendar-outline" size={20} color="#fff" />
            <Text style={styles.primaryCtaText}>Abwesenheit melden</Text>
          </Pressable>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Abwesenheit melden</Text>

            <Text style={styles.label}>Typ</Text>
            <TypePicker value={absenceType} onChange={handleTypeChange} />

            <Text style={styles.label}>Von (JJJJ-MM-TT)</Text>
            <TextInput
              value={startDate}
              onChangeText={setStartDate}
              placeholder="2026-06-05"
              autoCapitalize="none"
              style={styles.input}
            />

            {absenceType === "sick" ? (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Ende noch unklar (offen)</Text>
                <Switch
                  value={isOpenEnded}
                  onValueChange={setIsOpenEnded}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            ) : null}

            {(absenceType !== "sick" || !isOpenEnded) ? (
              <>
                <Text style={styles.label}>Bis (JJJJ-MM-TT)</Text>
                <TextInput
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="2026-06-07"
                  autoCapitalize="none"
                  style={styles.input}
                />
              </>
            ) : null}

            {absenceType === "sick" ? (
              <>
                <Text style={styles.label}>Voraussichtliches Ende (optional)</Text>
                <TextInput
                  value={expectedEndDate}
                  onChangeText={setExpectedEndDate}
                  placeholder="2026-06-10"
                  autoCapitalize="none"
                  style={styles.input}
                />
              </>
            ) : null}

            <Text style={styles.label}>Notiz (optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="z. B. Migräne"
              multiline
              style={[styles.input, styles.notesInput]}
            />

            <View style={styles.formActions}>
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => setShowForm(false)}
                style={[styles.secondaryButton]}
              >
                <Text style={styles.secondaryButtonText}>Abbrechen</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => void handleSubmitAbsence()}
                style={[styles.primaryButton, submitting && styles.buttonDisabled]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Absenden</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Meine Meldungen</Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : sortedAbsences.length === 0 ? (
          <Text style={styles.emptyText}>Noch keine Abwesenheiten gemeldet.</Text>
        ) : (
          <FlatList
            data={sortedAbsences}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <AbsenceRow
                item={item}
                busyId={busyId}
                onCancel={handleCancel}
                onCloseSick={handleCloseSick}
              />
            )}
          />
        )}
      </ScrollView>
      </ResponsiveContentFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.foreground,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  primaryCtaText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  typePickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  typeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  typeChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.foreground,
  },
  typeChipTextSelected: {
    color: "#fff",
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.muted,
    marginTop: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.foreground,
  },
  notesInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  switchLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.foreground,
    paddingRight: spacing.md,
  },
  formActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.foreground,
    fontWeight: "600",
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.foreground,
    marginTop: spacing.sm,
  },
  loader: {
    marginTop: spacing.lg,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  rowMain: {
    gap: spacing.xs,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  rowType: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.foreground,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  rowDates: {
    fontSize: 14,
    color: colors.foreground,
  },
  rowMeta: {
    fontSize: 13,
    color: colors.muted,
  },
  rowNotes: {
    fontSize: 13,
    color: colors.muted,
    fontStyle: "italic",
  },
  rowActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actionButton: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 120,
    alignItems: "center",
  },
  healthyButton: {
    backgroundColor: colors.success,
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: colors.destructive,
    backgroundColor: colors.surface,
  },
  cancelButtonText: {
    color: colors.destructive,
    fontWeight: "600",
    fontSize: 14,
  },
});
