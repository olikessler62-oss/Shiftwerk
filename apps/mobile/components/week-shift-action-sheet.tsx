import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type {
  ConfirmationDecision,
  ConfirmationWeekItem,
  EmployeeWeekShiftDisplayItem,
  Shift,
} from "@schichtwerk/types";
import { shiftConfirmationStatusLabel } from "@/lib/shift-confirmation-labels";
import { colors, radius, spacing } from "@schichtwerk/ui-tokens";

export type WeekShiftActionContext = {
  shift: Shift;
  display?: EmployeeWeekShiftDisplayItem;
  confirmation?: ConfirmationWeekItem;
};

type WeekShiftActionSheetProps = {
  visible: boolean;
  context: WeekShiftActionContext | null;
  needsResponse: boolean;
  canCancel: boolean;
  canDismiss: boolean;
  draft?: ConfirmationDecision;
  canceling: boolean;
  dismissing: boolean;
  onClose: () => void;
  onToggleDraft: (shiftId: string, decision: ConfirmationDecision) => void;
  onCancel: (shiftId: string) => void;
  onDismiss: (shiftId: string) => void;
};

function formatShiftTime(value: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildMetaLabel(
  display?: EmployeeWeekShiftDisplayItem,
  confirmation?: ConfirmationWeekItem
): string | null {
  const parts = [
    display?.locationName,
    display?.areaName,
    confirmation?.jobName ?? display?.jobName,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" / ") : null;
}

export function WeekShiftActionSheet({
  visible,
  context,
  needsResponse,
  canCancel,
  canDismiss,
  draft,
  canceling,
  dismissing,
  onClose,
  onToggleDraft,
  onCancel,
  onDismiss,
}: WeekShiftActionSheetProps) {
  if (!context) {
    return null;
  }

  const { shift, display, confirmation } = context;
  const templateLabel = display?.templateName ?? null;
  const timeLabel = `${formatShiftTime(shift.starts_at)} – ${formatShiftTime(shift.ends_at)}`;
  const metaLabel = buildMetaLabel(display, confirmation);
  const statusLabel = shiftConfirmationStatusLabel(
    shift.confirmation_status,
    display?.cancelledBy
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.handle} />

          <Text style={styles.title}>
            {templateLabel ?? timeLabel}
          </Text>
          {templateLabel ? (
            <Text style={styles.subtitle}>{timeLabel}</Text>
          ) : null}
          {metaLabel ? <Text style={styles.meta}>{metaLabel}</Text> : null}
          <Text style={styles.status}>Status: {statusLabel}</Text>
          {shift.notes ? (
            <Text style={styles.notes} numberOfLines={3}>
              {shift.notes}
            </Text>
          ) : null}

          <View style={styles.actions}>
            {needsResponse ? (
              <>
                <Pressable
                  style={[
                    styles.actionButton,
                    draft === "confirm" && styles.actionButtonConfirmActive,
                  ]}
                  onPress={() => onToggleDraft(shift.id, "confirm")}
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
                  onPress={() => onToggleDraft(shift.id, "reject")}
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
              </>
            ) : null}

            {canCancel && !needsResponse ? (
              <Pressable
                style={styles.cancelButton}
                disabled={canceling}
                onPress={() => onCancel(shift.id)}
              >
                {canceling ? (
                  <ActivityIndicator color={colors.destructive} />
                ) : (
                  <Text style={styles.cancelButtonText}>Schicht absagen</Text>
                )}
              </Pressable>
            ) : null}

            {canDismiss && !needsResponse ? (
              <Pressable
                style={styles.dismissButton}
                disabled={dismissing}
                onPress={() => onDismiss(shift.id)}
              >
                {dismissing ? (
                  <ActivityIndicator color={colors.foreground} />
                ) : (
                  <Text style={styles.dismissButtonText}>Aus Plan entfernen</Text>
                )}
              </Pressable>
            ) : null}

            <Pressable style={styles.secondaryButton} disabled>
              <Text style={styles.secondaryButtonText}>
                Tausch (demnächst)
              </Text>
            </Pressable>

            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Schließen</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.foreground,
  },
  meta: {
    fontSize: 14,
    color: colors.foreground,
  },
  status: {
    fontSize: 13,
    color: colors.muted,
  },
  notes: {
    fontSize: 13,
    color: colors.muted,
    fontStyle: "italic",
  },
  actions: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  actionButton: {
    minHeight: 44,
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
    fontSize: 15,
    fontWeight: "600",
    color: colors.foreground,
  },
  actionButtonTextActive: {
    color: colors.foreground,
  },
  cancelButton: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.destructive,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.destructive,
  },
  dismissButton: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  dismissButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.foreground,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    opacity: 0.55,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.muted,
  },
  closeButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.muted,
  },
});
