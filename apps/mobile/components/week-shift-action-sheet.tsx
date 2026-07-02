import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useState, useRef } from "react";
import type {
  EmployeeWeekShiftDisplayItem,
  ConfirmationWeekItem,
  Shift,
} from "@schichtwerk/types";
import { shiftConfirmationStatusLabel, employeeCancellationSentShortLabel } from "@/lib/shift-confirmation-labels";
import { isEmployeeCancellationPending, isEmployeeDismissableShift } from "@/lib/employee-shift-dismiss";
import { colors, radius, spacing } from "@schichtwerk/ui-tokens";
import { MODAL_Z_INDEX_ACTION_SHEET } from "@/lib/modal-z-index";

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
  canceling: boolean;
  dismissing: boolean;
  onClose: () => void;
  onGoToRequests?: () => void;
  onCancel: (shiftId: string, reason?: string) => void;
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
  canceling,
  dismissing,
  onClose,
  onGoToRequests,
  onCancel,
  onDismiss,
}: WeekShiftActionSheetProps) {
  const [cancelReason, setCancelReason] = useState("");
  const cancelReasonRef = useRef("");

  if (!context) {
    return null;
  }

  const { shift, display, confirmation } = context;
  const templateLabel = display?.templateName ?? null;
  const timeLabel = `${formatShiftTime(shift.starts_at)} – ${formatShiftTime(shift.ends_at)}`;
  const metaLabel = buildMetaLabel(display, confirmation);
  const statusLabel = isEmployeeCancellationPending(shift, display)
    ? employeeCancellationSentShortLabel()
    : shiftConfirmationStatusLabel(shift.confirmation_status, display?.cancelledBy);
  const showDismiss = isEmployeeDismissableShift(shift, display);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
      {...(Platform.OS === "web"
        ? { style: { zIndex: MODAL_Z_INDEX_ACTION_SHEET } }
        : {})}
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
            {showDismiss ? (
              <Pressable
                style={styles.dismissButtonPrimary}
                disabled={dismissing}
                onPress={() => onDismiss(shift.id)}
              >
                {dismissing ? (
                  <ActivityIndicator color={colors.foreground} />
                ) : (
                  <Text style={styles.dismissButtonPrimaryText}>Entfernen</Text>
                )}
              </Pressable>
            ) : null}

            {needsResponse && onGoToRequests ? (
              <Pressable
                style={styles.requestsButton}
                onPress={() => {
                  onClose();
                  onGoToRequests();
                }}
              >
                <Text style={styles.requestsButtonText}>
                  In Benachrichtigungen bearbeiten
                </Text>
              </Pressable>
            ) : null}

            {canCancel && !needsResponse ? (
              <>
                <Text style={styles.reasonLabel}>Grund (optional)</Text>
                <TextInput
                  style={styles.reasonInput}
                  value={cancelReason}
                  onChangeText={(text) => {
                    cancelReasonRef.current = text;
                    setCancelReason(text);
                  }}
                  placeholder="Kurz angeben …"
                  placeholderTextColor={colors.muted}
                  maxLength={200}
                  multiline
                />
                <Pressable
                  style={styles.cancelButton}
                  disabled={canceling}
                  onPress={() => {
                    const reason = cancelReasonRef.current.trim();
                    onCancel(shift.id, reason ? reason : undefined);
                  }}
                >
                {canceling ? (
                  <ActivityIndicator color={colors.destructive} />
                ) : (
                  <Text style={styles.cancelButtonText}>Schicht absagen</Text>
                )}
              </Pressable>
              </>
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
    ...Platform.select({
      web: { zIndex: MODAL_Z_INDEX_ACTION_SHEET },
      android: { elevation: MODAL_Z_INDEX_ACTION_SHEET },
      default: {},
    }),
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
  requestsButton: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
  },
  requestsButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },
  reasonLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  reasonInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.background,
    textAlignVertical: "top",
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
  dismissButtonPrimary: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  dismissButtonPrimaryText: {
    fontSize: 15,
    fontWeight: "700",
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
