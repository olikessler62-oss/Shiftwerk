import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ShiftConfirmationStatus, ShiftRequestActorRole } from "@schichtwerk/types";
import {
  SHIFT_CONFIRMATION_OVERLAY_OPACITY,
  shiftConfirmationShowsOverlay,
} from "@schichtwerk/ui-tokens";
import { resolveShiftCardStatusBadgeTextColor } from "@/lib/week-plan-theme";
import {
  employeeCancellationSentBadgeBackground,
  employeeCancellationSentShortLabel,
  shiftConfirmationStatusShortLabel,
} from "@/lib/shift-confirmation-labels";
import { colors, radius, spacing } from "@schichtwerk/ui-tokens";

type WeekShiftCardConfirmationOverlayProps = {
  status: ShiftConfirmationStatus;
  cancelledBy?: ShiftRequestActorRole;
  cancellationPending?: boolean;
  badgeFontSize?: number;
  isPastDay?: boolean;
  showDismiss?: boolean;
  dismissing?: boolean;
  onDismiss?: () => void;
};

export function WeekShiftCardConfirmationOverlay({
  status,
  cancelledBy,
  cancellationPending = false,
  badgeFontSize = 9,
  isPastDay = false,
  showDismiss = false,
  dismissing = false,
  onDismiss,
}: WeekShiftCardConfirmationOverlayProps) {
  if (!cancellationPending && !shiftConfirmationShowsOverlay(status)) {
    return null;
  }

  const badgeLineHeight = Math.max(
    badgeFontSize + 3,
    Math.round(badgeFontSize * 1.35)
  );

  if (cancellationPending) {
    return (
      <>
        <View style={styles.pendingOverlay} pointerEvents="none" />
        <View
          style={[
            styles.badge,
            { backgroundColor: employeeCancellationSentBadgeBackground() },
          ]}
          pointerEvents="none"
        >
          <Text
            style={[
              styles.badgeText,
              {
                color: "#9A3412",
                fontSize: badgeFontSize,
                lineHeight: badgeLineHeight,
              },
            ]}
            numberOfLines={2}
          >
            {employeeCancellationSentShortLabel()}
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <View style={styles.overlay} pointerEvents="none" />
      <View style={styles.badge} pointerEvents="none">
        <Text
          style={[
            styles.badgeText,
            {
              color: resolveShiftCardStatusBadgeTextColor(status, isPastDay),
              fontSize: badgeFontSize,
              lineHeight: badgeLineHeight,
            },
          ]}
          numberOfLines={1}
        >
          {shiftConfirmationStatusShortLabel(status, cancelledBy)}
        </Text>
      </View>
      {showDismiss && onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Stornierte Schicht entfernen"
          disabled={dismissing}
          onPress={onDismiss}
          style={[
            styles.dismissBar,
            dismissing && styles.dismissBarDisabled,
          ]}
        >
          {dismissing ? (
            <ActivityIndicator color={colors.foreground} size="small" />
          ) : (
            <Text style={styles.dismissBarText}>Entfernen</Text>
          )}
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `rgba(0, 0, 0, ${SHIFT_CONFIRMATION_OVERLAY_OPACITY})`,
    zIndex: 1,
  },
  pendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(234, 88, 12, 0.2)",
    zIndex: 1,
  },
  pendingXWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  pendingX: {
    color: "#dc2626",
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 30,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    zIndex: 2,
    backgroundColor: "#000000",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingTop: 2,
    paddingBottom: 3,
    maxWidth: "58%",
    overflow: "visible",
  },
  badgeText: {
    fontWeight: "400",
    includeFontPadding: false,
  },
  dismissBar: {
    position: "absolute",
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.xs,
    zIndex: 10,
    minHeight: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  dismissBarDisabled: {
    opacity: 0.65,
  },
  dismissBarText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.foreground,
  },
});
