import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  canCancelShiftByConfirmationStatus,
  isEmployeeRespondableConfirmationStatus,
  isShiftDateInPast,
} from "@schichtwerk/database";
import type { ConfirmationDecision, ConfirmationWeekItem, Shift } from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import {
  fetchConfirmationWeek,
  submitConfirmationResponses,
  cancelConfirmationShift,
} from "@/lib/confirmations-api";
import { MobileApiError } from "@/lib/mobile-api-client";
import { confirmAlert, showAppAlert } from "@/lib/app-alert";
import { shiftConfirmationStatusLabel } from "@/lib/shift-confirmation-labels";
import { colors, radius, spacing } from "@schichtwerk/ui-tokens";

function weekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(mon), to: fmt(sun) };
}

function formatShiftDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function formatShiftTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusBadgeStyle(status: Shift["confirmation_status"]) {
  switch (status) {
    case "requested":
    case "pending":
      return styles.statusBadgeOpen;
    case "confirmed":
      return styles.statusBadgeConfirmed;
    case "rejected":
      return styles.statusBadgeRejected;
    case "canceled":
      return styles.statusBadgeCanceled;
    default:
      return styles.statusBadgeNeutral;
  }
}

export default function WeekScreen() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [confirmationByShiftId, setConfirmationByShiftId] = useState<
    Record<string, ConfirmationWeekItem>
  >({});
  const [organizationDisclaimer, setOrganizationDisclaimer] = useState<string | null>(
    null
  );
  const [drafts, setDrafts] = useState<Record<string, ConfirmationDecision>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelingShiftId, setCancelingShiftId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { from, to } = weekRange();
    try {
      const data = await getDatabase().listMyShifts(from, to);
      setShifts(data);

      try {
        const confirmation = await fetchConfirmationWeek(from, to);
        setOrganizationDisclaimer(confirmation.organizationDisclaimer);
        setConfirmationByShiftId(
          Object.fromEntries(
            confirmation.items.map((item) => [item.shiftId, item])
          )
        );
      } catch (error) {
        setConfirmationByShiftId({});
        setOrganizationDisclaimer(null);
        if (error instanceof MobileApiError && error.status === 403) {
          // Schichtbestätigung für die Organisation deaktiviert.
        } else if (error instanceof MobileApiError && error.status !== 401) {
          showAppAlert(
            "Bestätigungen",
            error.message || "Offene Bestätigungen konnten nicht geladen werden."
          );
        }
      }
    } catch {
      setShifts([]);
      setConfirmationByShiftId({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const openConfirmationCount = useMemo(
    () =>
      shifts.filter((shift) =>
        isEmployeeRespondableConfirmationStatus(shift.confirmation_status)
      ).length,
    [shifts]
  );

  const draftEntries = useMemo(() => Object.entries(drafts), [drafts]);

  function toggleDraft(shiftId: string, decision: ConfirmationDecision) {
    setDrafts((prev) => {
      if (prev[shiftId] === decision) {
        const next = { ...prev };
        delete next[shiftId];
        return next;
      }
      return { ...prev, [shiftId]: decision };
    });
  }

  async function handleSubmitResponses() {
    if (draftEntries.length === 0 || submitting) return;

    setSubmitting(true);
    try {
      const result = await submitConfirmationResponses(
        draftEntries.map(([shiftId, decision]) => ({ shiftId, decision }))
      );
      setDrafts({});
      showAppAlert(
        "Gesendet",
        `${result.updatedCount} Antwort${result.updatedCount === 1 ? "" : "en"} übermittelt.`
      );
      setRefreshing(true);
      await load();
    } catch (error) {
      showAppAlert(
        "Senden fehlgeschlagen",
        error instanceof MobileApiError
          ? error.message
          : "Antworten konnten nicht gespeichert werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelShift(shiftId: string) {
    const confirmed = await confirmAlert({
      title: "Schicht absagen",
      message: "Möchtest du diese Schicht wirklich absagen?",
      confirmLabel: "Ja, absagen",
    });
    if (!confirmed) return;

    setCancelingShiftId(shiftId);
    try {
      await cancelConfirmationShift(shiftId);
      showAppAlert("Abgesagt", "Die Schicht wurde abgesagt.");
      setRefreshing(true);
      await load();
    } catch (error) {
      showAppAlert(
        "Absage fehlgeschlagen",
        error instanceof MobileApiError
          ? error.message
          : "Die Schicht konnte nicht abgesagt werden."
      );
    } finally {
      setCancelingShiftId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          draftEntries.length > 0 ? styles.listContentWithFooter : null,
        ]}
        data={shifts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.heading}>Deine Schichten diese Woche</Text>
            {openConfirmationCount > 0 ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>
                  {openConfirmationCount} Schicht
                  {openConfirmationCount === 1 ? "" : "en"} warten auf deine
                  Bestätigung.
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Noch keine Schichten geplant.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const confirmation = confirmationByShiftId[item.id];
          const needsResponse = isEmployeeRespondableConfirmationStatus(
            item.confirmation_status
          );
          const canCancel =
            !isShiftDateInPast(item.shift_date) &&
            canCancelShiftByConfirmationStatus(item.confirmation_status);
          const draft = drafts[item.id];

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.date}>{formatShiftDate(item.shift_date)}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    statusBadgeStyle(item.confirmation_status),
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {shiftConfirmationStatusLabel(item.confirmation_status)}
                  </Text>
                </View>
              </View>

              <Text style={styles.time}>
                {formatShiftTime(item.starts_at)} – {formatShiftTime(item.ends_at)}
              </Text>

              {confirmation?.locationName ? (
                <Text style={styles.meta}>
                  {confirmation.locationName}
                  {confirmation.areaName ? ` · ${confirmation.areaName}` : ""}
                </Text>
              ) : null}
              {confirmation?.templateName ? (
                <Text style={styles.meta}>{confirmation.templateName}</Text>
              ) : null}
              {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}

              {needsResponse ? (
                <View style={styles.actions}>
                  <Pressable
                    style={[
                      styles.actionButton,
                      draft === "confirm" && styles.actionButtonConfirmActive,
                    ]}
                    onPress={() => toggleDraft(item.id, "confirm")}
                  >
                    <Text
                      style={[
                        styles.actionButtonText,
                        draft === "confirm" && styles.actionButtonTextActive,
                      ]}
                    >
                      Bestätigen
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.actionButton,
                      draft === "reject" && styles.actionButtonRejectActive,
                    ]}
                    onPress={() => toggleDraft(item.id, "reject")}
                  >
                    <Text
                      style={[
                        styles.actionButtonText,
                        draft === "reject" && styles.actionButtonTextActive,
                      ]}
                    >
                      Ablehnen
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {canCancel ? (
                <Pressable
                  style={[
                    styles.cancelButton,
                    cancelingShiftId === item.id && styles.cancelButtonDisabled,
                  ]}
                  disabled={cancelingShiftId === item.id}
                  onPress={() => void handleCancelShift(item.id)}
                >
                  {cancelingShiftId === item.id ? (
                    <ActivityIndicator color={colors.destructive} />
                  ) : (
                    <Text style={styles.cancelButtonText}>Schicht absagen</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />

      {draftEntries.length > 0 ? (
        <View style={styles.footer}>
          {organizationDisclaimer ? (
            <Text style={styles.disclaimer}>{organizationDisclaimer}</Text>
          ) : (
            <Text style={styles.disclaimer}>
              Mit dem Senden bestätigst du deine Auswahl für die markierten
              Schichten.
            </Text>
          )}
          <Pressable
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={() => void handleSubmitResponses()}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.submitButtonText}>
                Antworten senden ({draftEntries.length})
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1 },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl },
  listContentWithFooter: { paddingBottom: 140 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  headerBlock: { marginBottom: spacing.md },
  heading: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  banner: {
    backgroundColor: "#FFFBEB",
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  bannerText: {
    color: colors.foreground,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  date: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.foreground,
  },
  statusBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusBadgeOpen: { backgroundColor: "#FEF3C7" },
  statusBadgeConfirmed: { backgroundColor: "#DCFCE7" },
  statusBadgeRejected: { backgroundColor: "#FEE2E2" },
  statusBadgeCanceled: { backgroundColor: "#FFEDD5" },
  statusBadgeNeutral: { backgroundColor: colors.background },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.foreground,
  },
  time: { fontSize: 14, color: colors.muted, marginTop: 4 },
  meta: { fontSize: 13, color: colors.muted, marginTop: 6 },
  notes: { fontSize: 13, color: colors.muted, marginTop: 8 },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  actionButtonConfirmActive: {
    borderColor: colors.success,
    backgroundColor: "#DCFCE7",
  },
  actionButtonRejectActive: {
    borderColor: colors.destructive,
    backgroundColor: "#FEE2E2",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.foreground,
  },
  actionButtonTextActive: {
    color: colors.foreground,
  },
  cancelButton: {
    marginTop: spacing.md,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.destructive,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF7ED",
  },
  cancelButtonDisabled: {
    opacity: 0.7,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.destructive,
  },
  empty: { padding: spacing.xl, alignItems: "center" },
  emptyText: { color: colors.muted, textAlign: "center" },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  submitButton: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: {
    color: colors.primaryForeground,
    fontWeight: "600",
    fontSize: 15,
  },
});
