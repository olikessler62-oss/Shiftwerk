import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { ConfirmationDecision, ConfirmationWeekItem } from "@schichtwerk/types";
import { ResponsiveContentFrame } from "@/components/responsive-content-frame";
import { submitConfirmationResponses } from "@/lib/confirmations-api";
import { MobileApiError } from "@/lib/mobile-api-client";
import { showAppAlert } from "@/lib/app-alert";
import { usePendingConfirmations } from "@/lib/pending-confirmations-context";
import {
  shiftConfirmationStatusShortLabel,
  shiftConfirmationStatusBadgeBackground,
} from "@/lib/shift-confirmation-labels";
import { colors, radius, spacing } from "@schichtwerk/ui-tokens";

function formatShiftDate(isoDate: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${isoDate}T12:00:00`));
}

function formatShiftTime(value: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function RequestRow({
  item,
  draft,
  onToggleDraft,
}: {
  item: ConfirmationWeekItem;
  draft?: ConfirmationDecision;
  onToggleDraft: (shiftId: string, decision: ConfirmationDecision) => void;
}) {
  const timeLabel = `${formatShiftTime(item.startsAt)} – ${formatShiftTime(item.endsAt)}`;
  const meta = [item.locationName, item.areaName, item.templateName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowDate}>{formatShiftDate(item.shiftDate)}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: shiftConfirmationStatusBadgeBackground(item.status) },
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {shiftConfirmationStatusShortLabel(item.status)}
            </Text>
          </View>
        </View>
        <Text style={styles.rowTime}>{timeLabel}</Text>
        {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
      </View>
      <View style={styles.rowActions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onToggleDraft(item.shiftId, "confirm")}
          style={[
            styles.actionButton,
            styles.confirmButton,
            draft === "confirm" && styles.actionButtonSelectedConfirm,
          ]}
        >
          <Text
            style={[
              styles.actionButtonText,
              draft === "confirm" && styles.actionButtonTextSelected,
            ]}
          >
            Ja
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onToggleDraft(item.shiftId, "reject")}
          style={[
            styles.actionButton,
            styles.rejectButton,
            draft === "reject" && styles.actionButtonSelectedReject,
          ]}
        >
          <Text
            style={[
              styles.actionButtonText,
              draft === "reject" && styles.actionButtonTextSelected,
            ]}
          >
            Nein
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function RequestsScreen() {
  const { items, loading, refresh } = usePendingConfirmations();
  const [drafts, setDrafts] = useState<Record<string, ConfirmationDecision>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const draftEntries = useMemo(
    () =>
      Object.entries(drafts).filter(([shiftId]) =>
        items.some((item) => item.shiftId === shiftId)
      ),
    [drafts, items]
  );

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

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  async function handleSubmit() {
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
      await refresh();
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

  if (loading && items.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ResponsiveContentFrame>
        <View style={styles.header}>
          <Text style={styles.title}>Schicht-Anfragen</Text>
          <Text style={styles.subtitle}>
            {items.length === 0
              ? "Keine offenen Anfragen ab heute."
              : `${items.length} offene Anfrage${items.length === 1 ? "" : "n"} — auch in anderen Kalenderwochen.`}
          </Text>
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => item.shiftId}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Alles erledigt</Text>
              <Text style={styles.emptyText}>
                Neue Anfragen erscheinen hier sofort — auch wenn die Schicht in einer
                späteren Woche liegt.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <RequestRow
              item={item}
              draft={drafts[item.shiftId]}
              onToggleDraft={toggleDraft}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
          contentContainerStyle={[
            styles.listContent,
            items.length === 0 && styles.listContentEmpty,
          ]}
        />

        {draftEntries.length > 0 ? (
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => void handleSubmit()}
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  Antworten senden ({draftEntries.length})
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </ResponsiveContentFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.foreground,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  rowSeparator: {
    height: spacing.sm,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
  },
  rowMain: {
    gap: 4,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  rowDate: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.foreground,
  },
  statusBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.foreground,
  },
  rowTime: {
    fontSize: 14,
    color: colors.foreground,
  },
  rowMeta: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  rowActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  confirmButton: {
    borderColor: "#16A34A",
    backgroundColor: "#F0FDF4",
  },
  rejectButton: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },
  actionButtonSelectedConfirm: {
    backgroundColor: "#16A34A",
  },
  actionButtonSelectedReject: {
    backgroundColor: "#DC2626",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.foreground,
  },
  actionButtonTextSelected: {
    color: "#fff",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.foreground,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: "center",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  submitButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
