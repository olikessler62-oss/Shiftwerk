import { StyleSheet, Text, View } from "react-native";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";
import {
  SHIFT_CONFIRMATION_OVERLAY_OPACITY,
  shiftConfirmationShowsOverlay,
} from "@schichtwerk/ui-tokens";
import { resolveShiftCardStatusBadgeTextColor } from "@/lib/week-plan-theme";
import { shiftConfirmationStatusShortLabel } from "@/lib/shift-confirmation-labels";

type WeekShiftCardConfirmationOverlayProps = {
  status: ShiftConfirmationStatus;
  badgeFontSize?: number;
  isPastDay?: boolean;
};

export function WeekShiftCardConfirmationOverlay({
  status,
  badgeFontSize = 9,
  isPastDay = false,
}: WeekShiftCardConfirmationOverlayProps) {
  if (!shiftConfirmationShowsOverlay(status)) {
    return null;
  }

  const badgeLineHeight = Math.max(
    badgeFontSize + 3,
    Math.round(badgeFontSize * 1.35)
  );

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
          {shiftConfirmationStatusShortLabel(status)}
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `rgba(0, 0, 0, ${SHIFT_CONFIRMATION_OVERLAY_OPACITY})`,
    zIndex: 1,
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
});
