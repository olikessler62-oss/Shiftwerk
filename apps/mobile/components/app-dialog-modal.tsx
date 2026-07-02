import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, spacing } from "@schichtwerk/ui-tokens";
import { MODAL_Z_INDEX_DIALOG } from "@/lib/modal-z-index";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  confirmDestructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
};

export function AppDialogModal({
  visible,
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Abbrechen",
  showCancel = false,
  confirmDestructive = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onCancel ?? onConfirm}
      {...(Platform.OS === "web"
        ? { style: { zIndex: MODAL_Z_INDEX_DIALOG } }
        : {})}
    >
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityRole="alert">
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            {showCancel ? (
              <Pressable
                accessibilityRole="button"
                style={styles.cancelButton}
                onPress={onCancel}
              >
                <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              style={[
                styles.confirmButton,
                confirmDestructive && styles.confirmButtonDestructive,
                showCancel && styles.confirmButtonWithCancel,
              ]}
              onPress={onConfirm}
            >
              <Text
                style={[
                  styles.confirmButtonText,
                  confirmDestructive && styles.confirmButtonTextDestructive,
                ]}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    padding: spacing.lg,
    ...Platform.select({
      web: { zIndex: MODAL_Z_INDEX_DIALOG },
      android: { elevation: MODAL_Z_INDEX_DIALOG },
      default: {},
    }),
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cancelButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.foreground,
  },
  confirmButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  confirmButtonWithCancel: {
    flex: 1,
  },
  confirmButtonDestructive: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: colors.destructive,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  confirmButtonTextDestructive: {
    color: colors.destructive,
  },
});
