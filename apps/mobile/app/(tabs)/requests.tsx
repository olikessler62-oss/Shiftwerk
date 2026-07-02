import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type {
  ConfirmationDecision,
  ConfirmationWeekItem,
  EmployeeShiftCanceledNotificationItem,
} from "@schichtwerk/types";
import { ResponsiveContentFrame } from "@/components/responsive-content-frame";
import {
  dismissCanceledShift,
  submitConfirmationResponses,
} from "@/lib/confirmations-api";
import { MobileApiError } from "@/lib/mobile-api-client";
import { useAppDialog } from "@/lib/use-app-dialog";
import { usePendingConfirmations } from "@/lib/pending-confirmations-context";
import {
  shiftConfirmationStatusShortLabel,
  shiftConfirmationStatusBadgeBackground,
} from "@/lib/shift-confirmation-labels";
import { colors, radius, spacing } from "@schichtwerk/ui-tokens";

type InboxListItem =
  | { kind: "canceled"; item: EmployeeShiftCanceledNotificationItem }
  | { kind: "confirmation"; item: ConfirmationWeekItem };

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

function buildSubtitle(
  confirmationCount: number,
  canceledCount: number
): string {
  if (confirmationCount === 0 && canceledCount === 0) {
    return "Keine offenen Mitteilungen ab heute.";
  }

  const parts: string[] = [];
  if (canceledCount > 0) {
    parts.push(
      `${canceledCount} Stornierung${canceledCount === 1 ? "" : "en"}`
    );
  }
  if (confirmationCount > 0) {
    parts.push(
      `${confirmationCount} Bestätigungsanfrage${confirmationCount === 1 ? "" : "n"}`
    );
  }
  return parts.join(" · ");
}

function CanceledNotificationRow({
  item,
  dismissing,
  onDismiss,
}: {
  item: EmployeeShiftCanceledNotificationItem;
  dismissing: boolean;
  onDismiss: (shiftId: string) => void;
}) {
  const timeLabel = `${formatShiftTime(item.startsAt)} – ${formatShiftTime(item.endsAt)}`;
  const meta = [item.locationName, item.areaName, item.templateName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={[styles.row, styles.canceledRow]}>
      <View style={styles.rowMain}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowDate}>{formatShiftDate(item.shiftDate)}</Text>
          <View style={[styles.statusBadge, styles.canceledBadge]}>
            <Text style={styles.statusBadgeText}>Storniert</Text>
          </View>
        </View>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowMessage}>{item.message}</Text>
        <Text style={styles.rowTime}>{timeLabel}</Text>
        {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={dismissing}
        onPress={() => onDismiss(item.shiftId)}
        style={[styles.dismissButton, dismissing && styles.dismissButtonDisabled]}
      >
        {dismissing ? (
          <ActivityIndicator color={colors.foreground} />
        ) : (
          <Text style={styles.dismissButtonText}>Entfernen</Text>
        )}
      </Pressable>
    </View>
  );
}

function RequestRow({
  item,
  draft,
  rejectionReason,
  onToggleDraft,
  onChangeRejectionReason,
}: {
  item: ConfirmationWeekItem;
  draft?: ConfirmationDecision;
  rejectionReason?: string;
  onToggleDraft: (shiftId: string, decision: ConfirmationDecision) => void;
  onChangeRejectionReason: (shiftId: string, reason: string) => void;
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
      {draft === "reject" ? (
        <View style={styles.reasonField}>
          <Text style={styles.reasonLabel}>Grund (optional)</Text>
          <TextInput
            style={styles.reasonInput}
            value={rejectionReason ?? ""}
            onChangeText={(text) => onChangeRejectionReason(item.shiftId, text)}
            placeholder="Kurz angeben …"
            placeholderTextColor={colors.muted}
            maxLength={200}
            multiline
          />
        </View>
      ) : null}
    </View>
  );
}

export default function RequestsScreen() {
  const { alert, confirm, dialog } = useAppDialog();
  const { items, canceledByManagerItems, loading, refresh } =
    usePendingConfirmations();
  const [drafts, setDrafts] = useState<Record<string, ConfirmationDecision>>({});
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dismissingShiftId, setDismissingShiftId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const listItems = useMemo<InboxListItem[]>(
    () => [
      ...canceledByManagerItems.map(
        (item): InboxListItem => ({ kind: "canceled", item })
      ),
      ...items.map((item): InboxListItem => ({ kind: "confirmation", item })),
    ],
    [canceledByManagerItems, items]
  );

  const draftEntries = useMemo(
    () =>
      Object.entries(drafts).filter(([shiftId]) =>
        items.some((item) => item.shiftId === shiftId)
      ),
    [drafts, items]
  );

  function setAllDrafts(decision: ConfirmationDecision) {
    setDrafts(
      Object.fromEntries(items.map((item) => [item.shiftId, decision]))
    );
  }

  function toggleDraft(shiftId: string, decision: ConfirmationDecision) {
    setDrafts((prev) => {
      if (prev[shiftId] === decision) {
        const next = { ...prev };
        delete next[shiftId];
        return next;
      }
      return { ...prev, [shiftId]: decision };
    });
    if (decision === "confirm") {
      setRejectionReasons((prev) => {
        if (!prev[shiftId]) return prev;
        const next = { ...prev };
        delete next[shiftId];
        return next;
      });
    }
  }

  function changeRejectionReason(shiftId: string, reason: string) {
    setRejectionReasons((prev) => ({ ...prev, [shiftId]: reason }));
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  async function handleDismiss(shiftId: string) {
    const confirmed = await confirm({
      title: "Aus Liste entfernen",
      message:
        "Die stornierte Schicht wird aus deinem Wochenplan und aus dieser Liste entfernt.",
      confirmLabel: "Entfernen",
    });
    if (!confirmed) return;

    setDismissingShiftId(shiftId);
    try {
      await dismissCanceledShift(shiftId);
      await refresh();
    } catch (error) {
      await alert({
        title: "Entfernen fehlgeschlagen",
        message:
          error instanceof MobileApiError
            ? error.message
            : "Die Mitteilung konnte nicht entfernt werden.",
      });
    } finally {
      setDismissingShiftId(null);
    }
  }

  async function handleSubmit() {
    if (draftEntries.length === 0 || submitting) return;

    setSubmitting(true);
    try {
      const result = await submitConfirmationResponses(
        draftEntries.map(([shiftId, decision]) => ({
          shiftId,
          decision,
          ...(decision === "reject" && rejectionReasons[shiftId]?.trim()
            ? { reason: rejectionReasons[shiftId].trim() }
            : {}),
        }))
      );
      setDrafts({});
      setRejectionReasons({});
      await alert({
        title: "Gesendet",
        message: `${result.updatedCount} Antwort${result.updatedCount === 1 ? "" : "en"} übermittelt.`,
      });
      await refresh();
    } catch (error) {
      await alert({
        title: "Senden fehlgeschlagen",
        message:
          error instanceof MobileApiError
            ? error.message
            : "Antworten konnten nicht gespeichert werden.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && listItems.length === 0) {
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
          <Text style={styles.title}>Benachrichtigungen</Text>
          <Text style={styles.subtitle}>
            {buildSubtitle(items.length, canceledByManagerItems.length)}
          </Text>
          {items.length > 0 ? (
            <View style={styles.bulkActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAllDrafts("confirm")}
                style={styles.bulkActionButton}
              >
                <Text style={styles.bulkActionConfirmText}>Alle bestätigen</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAllDrafts("reject")}
                style={styles.bulkActionButton}
              >
                <Text style={styles.bulkActionRejectText}>Alle ablehnen</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <FlatList
          data={listItems}
          keyExtractor={(entry) =>
            entry.kind === "canceled"
              ? `canceled-${entry.item.shiftId}`
              : `confirmation-${entry.item.shiftId}`
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Alles erledigt</Text>
              <Text style={styles.emptyText}>
                Neue Bestätigungsanfragen und Stornierungen erscheinen hier — auch
                wenn die Schicht in einer späteren Woche liegt.
              </Text>
            </View>
          }
          renderItem={({ item: entry }) =>
            entry.kind === "canceled" ? (
              <CanceledNotificationRow
                item={entry.item}
                dismissing={dismissingShiftId === entry.item.shiftId}
                onDismiss={(shiftId) => void handleDismiss(shiftId)}
              />
            ) : (
              <RequestRow
                item={entry.item}
                draft={drafts[entry.item.shiftId]}
                rejectionReason={rejectionReasons[entry.item.shiftId]}
                onToggleDraft={toggleDraft}
                onChangeRejectionReason={changeRejectionReason}
              />
            )
          }
          ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
          contentContainerStyle={[
            styles.listContent,
            listItems.length === 0 && styles.listContentEmpty,
          ]}
        />

        {items.length > 0 ? (
          <View style={styles.footer}>
            <Text style={styles.footerHint}>
              Wähle Ja/Nein pro Schicht oder nutze „Alle bestätigen“ / „Alle
              ablehnen“, dann sende deine Antworten gesammelt.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={submitting || draftEntries.length === 0}
              onPress={() => void handleSubmit()}
              style={[
                styles.submitButton,
                (submitting || draftEntries.length === 0) && styles.submitButtonDisabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  Antworten senden
                  {draftEntries.length > 0 ? ` (${draftEntries.length})` : ""}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}
        {dialog}
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
  bulkActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  bulkActionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  bulkActionConfirmText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#16A34A",
  },
  bulkActionRejectText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#DC2626",
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
  canceledRow: {
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED",
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
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.foreground,
  },
  rowMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.foreground,
  },
  statusBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  canceledBadge: {
    backgroundColor: "#FFEDD5",
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
  dismissButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  dismissButtonDisabled: {
    opacity: 0.7,
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.foreground,
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
  reasonField: {
    gap: spacing.xs,
  },
  reasonLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  reasonInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
    color: colors.foreground,
    textAlignVertical: "top",
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
    gap: spacing.sm,
  },
  footerHint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
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
