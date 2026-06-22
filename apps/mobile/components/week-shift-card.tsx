import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import type {
  ConfirmationDecision,
  ConfirmationWeekItem,
  EmployeeWeekShiftDisplayItem,
  Shift,
} from "@schichtwerk/types";
import { shiftConfirmationShowsOverlay } from "@schichtwerk/ui-tokens";
import { WeekShiftCardConfirmationOverlay } from "@/components/week-shift-card-confirmation-overlay";
import type { WeekShiftActionContext } from "@/components/week-shift-action-sheet";
import { isEmployeeDismissableShift } from "@/lib/employee-shift-dismiss";
import {
  SHIFT_CARD_CONTENT_INSET_RIGHT_RATIO,
  WEEK_PLAN_PAST,
  resolveShiftCardContentTextColor,
} from "@/lib/week-plan-theme";
import { useWeekPlanLayout } from "@/lib/responsive-layout";
import { colors, radius, spacing, buildShiftCardLinearGradient } from "@schichtwerk/ui-tokens";

const SHIFT_CARD_BORDER_RADIUS = radius.lg / 2;

const SHIFT_CARD_PAST_BACKGROUND = WEEK_PLAN_PAST.shiftCardBackground;
const SHIFT_CARD_SHADOW_COLOR = "#52525B";
const SHIFT_CARD_FONT_BOOST = 0;

const SHIFT_TITLE_BASE_SIZE = 15;
const SHIFT_TIME_SECONDARY_BASE_SIZE = 13;
const TITLE_HEIGHT_RATIO = 0.304;
const TIME_PRIMARY_HEIGHT_RATIO = 0.344;
const TIME_SECONDARY_HEIGHT_RATIO = 0.264;
const FONT_BOOST_RATIO_STEP = 0.004;
const MAX_FONT_HEIGHT_RATIO = 0.52;
const SHIFT_CARD_FONT_PX_OFFSET = -2;
const SHIFT_META_FONT_PX_OFFSET = 1;
const MIN_SHIFT_CARD_FONT_SIZE = 10;
const SHIFT_META_BASE_SIZE = 14;

function fontSizeFromCardHeight(bodyHeight: number, ratio: number): number {
  const boostedRatio = ratio + SHIFT_CARD_FONT_BOOST * FONT_BOOST_RATIO_STEP;
  return Math.max(
    MIN_SHIFT_CARD_FONT_SIZE,
    Math.round(
      Math.min(bodyHeight * boostedRatio, bodyHeight * MAX_FONT_HEIGHT_RATIO)
    ) + SHIFT_CARD_FONT_PX_OFFSET
  );
}

type WeekShiftCardProps = {
  shift: Shift;
  display?: EmployeeWeekShiftDisplayItem;
  confirmation?: ConfirmationWeekItem;
  draft?: ConfirmationDecision;
  compact?: boolean;
  height?: number;
  isPastDay?: boolean;
  onPress: (context: WeekShiftActionContext) => void;
  onDismiss?: (shiftId: string) => void;
  dismissing?: boolean;
};

type ShiftCardSizing = {
  paddingVertical: number;
  paddingHorizontal: number;
  timeFontSize: number;
  timeSecondaryFontSize: number;
  titleFontSize: number;
  metaFontSize: number;
  badgeFontSize: number;
  metaGap: number;
  showNotes: boolean;
  notesFontSize: number;
  notesMarginTop: number;
  overlayBadgeReserveWidth: number;
};

const META_HEIGHT_RATIO = 0.16;
const OVERLAY_BADGE_RESERVE_RATIO = 0.38;

function scaleShiftCardForHeight(height: number): ShiftCardSizing {
  const bodyHeight = height;
  const titleFontSize = fontSizeFromCardHeight(bodyHeight, TITLE_HEIGHT_RATIO);
  const timeFontSize = fontSizeFromCardHeight(bodyHeight, TIME_PRIMARY_HEIGHT_RATIO);
  const timeSecondaryFontSize = fontSizeFromCardHeight(
    bodyHeight,
    TIME_SECONDARY_HEIGHT_RATIO
  );
  const metaFontSize =
    fontSizeFromCardHeight(bodyHeight, META_HEIGHT_RATIO) + SHIFT_META_FONT_PX_OFFSET;
  const badgeFontSize = Math.max(
    8,
    Math.round(Math.min(11, bodyHeight * 0.14))
  );

  return {
    paddingVertical: Math.max(2, Math.round(height * 0.04)),
    paddingHorizontal: Math.max(6, Math.round(height * 0.1)),
    timeFontSize,
    timeSecondaryFontSize,
    titleFontSize,
    metaFontSize,
    badgeFontSize,
    metaGap: Math.max(1, Math.round(bodyHeight * 0.02)),
    showNotes: height >= 100,
    notesFontSize: Math.round(Math.min(13, height * 0.14)),
    notesMarginTop: Math.max(2, Math.round(height * 0.04)),
    overlayBadgeReserveWidth: Math.max(36, Math.round(height * OVERLAY_BADGE_RESERVE_RATIO)),
  };
}

function formatShiftClockTime(value: string): string {
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatShiftTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getLocationLabel(display?: EmployeeWeekShiftDisplayItem): string | null {
  if (!display?.locationName) return null;
  return display.locationName;
}

function getAreaLabel(display?: EmployeeWeekShiftDisplayItem): string | null {
  if (!display?.areaName) return null;
  return display.areaName;
}

function buildShiftMetaLabel(
  locationLabel: string | null,
  areaLabel: string | null,
  jobLabel: string | null
): string {
  return [locationLabel, areaLabel, jobLabel]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" / ");
}

export function WeekShiftCard({
  shift,
  display,
  confirmation,
  draft,
  compact = false,
  height,
  isPastDay = false,
  onPress,
  onDismiss,
  dismissing = false,
}: WeekShiftCardProps) {
  const layout = useWeekPlanLayout();
  const [cardWidth, setCardWidth] = useState(0);
  const cardTextColor = resolveShiftCardContentTextColor(
    shift.confirmation_status,
    isPastDay
  );
  const contentInsetLeft =
    cardWidth > 0
      ? Math.round(cardWidth * SHIFT_CARD_CONTENT_INSET_RIGHT_RATIO)
      : 0;
  const locationLabel = getLocationLabel(display);
  const areaLabel = getAreaLabel(display);
  const jobLabel = confirmation?.jobName ?? display?.jobName ?? null;
  const metaLabel = buildShiftMetaLabel(locationLabel, areaLabel, jobLabel);
  const hasMeta = metaLabel.length > 0;
  const templateLabel = display?.templateName ?? null;
  const shiftTimeLabel = `${formatShiftTime(shift.starts_at)} – ${formatShiftTime(shift.ends_at)}`;
  const showsOverlay = shiftConfirmationShowsOverlay(shift.confirmation_status);
  const canDismiss = isEmployeeDismissableShift(shift, display) && onDismiss != null;
  const cardDisabled = isPastDay && !canDismiss;
  const sizing = height != null ? scaleShiftCardForHeight(height) : null;
  const shiftGradient = useMemo(
    () =>
      buildShiftCardLinearGradient(
        formatShiftClockTime(shift.starts_at),
        formatShiftClockTime(shift.ends_at)
      ),
    [shift.starts_at, shift.ends_at]
  );
  const textStyles = useMemo(
    () => ({
      shiftTitle: { color: cardTextColor },
      timeSecondary: { color: cardTextColor },
      time: { color: cardTextColor },
      metaLine: { color: cardTextColor },
      notes: { color: cardTextColor },
    }),
    [cardTextColor]
  );

  return (
    <Pressable
      style={[
        styles.cardShell,
        compact && styles.cardShellCompact,
        height != null && {
          height,
          marginBottom: 0,
        },
      ]}
      disabled={cardDisabled}
      accessibilityState={{ disabled: cardDisabled }}
      onPress={() =>
        onPress({
          shift,
          display,
          confirmation,
        })
      }
    >
      <View
        onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}
        style={[
          styles.card,
          compact && styles.cardCompact,
          isPastDay && styles.cardPast,
          draft === "confirm" && styles.cardDraftConfirm,
          draft === "reject" && styles.cardDraftReject,
          canDismiss && styles.cardWithDismissAction,
          height != null && {
            flex: 1,
            paddingVertical: sizing!.paddingVertical,
            paddingHorizontal: sizing!.paddingHorizontal,
            justifyContent: "flex-start",
          },
        ]}
      >
        {isPastDay ? (
          <View
            style={[styles.cardGradient, styles.cardPastBackground]}
            pointerEvents="none"
          />
        ) : (
          <LinearGradient
            colors={shiftGradient.colors as [string, string, ...string[]]}
            locations={shiftGradient.locations as [number, number, ...number[]]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.cardGradient}
            pointerEvents="none"
          />
        )}
        <WeekShiftCardConfirmationOverlay
          status={shift.confirmation_status}
          cancelledBy={display?.cancelledBy}
          badgeFontSize={sizing?.badgeFontSize}
          isPastDay={isPastDay}
          showDismiss={canDismiss}
          dismissing={dismissing}
          onDismiss={
            canDismiss ? () => onDismiss!(shift.id) : undefined
          }
        />
        <View
          style={[
            styles.cardBody,
            height != null && {
              flex: 1,
              justifyContent: "center",
            },
          ]}
        >
          <View
            style={[
              styles.contentBlock,
              sizing && { gap: sizing.metaGap },
              contentInsetLeft > 0 && { paddingLeft: contentInsetLeft },
              showsOverlay &&
                sizing && {
                  paddingRight: sizing.overlayBadgeReserveWidth,
                },
            ]}
          >
            <View style={styles.headerRow}>
              <View style={styles.primaryLine}>
                {templateLabel ? (
                  <View style={styles.titleRow}>
                    <Text
                      style={[
                        styles.shiftTitle,
                        textStyles.shiftTitle,
                        {
                          fontSize:
                            sizing?.titleFontSize ??
                            SHIFT_TITLE_BASE_SIZE +
                              SHIFT_CARD_FONT_BOOST +
                              SHIFT_CARD_FONT_PX_OFFSET,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {templateLabel}
                    </Text>
                    <Text
                      style={[
                        styles.timeSecondary,
                        textStyles.timeSecondary,
                        {
                          fontSize:
                            sizing?.timeSecondaryFontSize ??
                            SHIFT_TIME_SECONDARY_BASE_SIZE +
                              SHIFT_CARD_FONT_BOOST +
                              SHIFT_CARD_FONT_PX_OFFSET,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {shiftTimeLabel}
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.time,
                      textStyles.time,
                      {
                        fontSize:
                          sizing?.timeFontSize ??
                          layout.shiftCardTimeFontSize +
                            SHIFT_CARD_FONT_BOOST +
                            SHIFT_CARD_FONT_PX_OFFSET,
                      },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit={height == null}
                    minimumFontScale={height == null ? 0.75 : 1}
                  >
                    {shiftTimeLabel}
                  </Text>
                )}
              </View>
            </View>

            {hasMeta ? (
              <Text
                style={[
                  styles.metaLine,
                  textStyles.metaLine,
                  {
                    fontSize:
                      sizing?.metaFontSize ??
                      SHIFT_META_BASE_SIZE + SHIFT_META_FONT_PX_OFFSET,
                  },
                ]}
                numberOfLines={1}
              >
                {metaLabel}
              </Text>
            ) : null}
          </View>
        </View>

        {shift.notes && (sizing?.showNotes ?? true) ? (
          <Text
            style={[
              styles.notes,
              textStyles.notes,
              sizing && {
                fontSize: sizing.notesFontSize,
                marginTop: sizing.notesMarginTop,
              },
            ]}
            numberOfLines={1}
          >
            {shift.notes}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    marginBottom: spacing.sm,
    flex: 1,
    minHeight: 0,
  },
  cardShellCompact: {
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: SHIFT_CARD_BORDER_RADIUS,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderLeftColor: colors.border,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderBottomColor: SHIFT_CARD_SHADOW_COLOR,
    borderRightColor: SHIFT_CARD_SHADOW_COLOR,
    overflow: "hidden",
  },
  cardDraftConfirm: {
    borderColor: colors.success,
    borderWidth: 2,
  },
  cardDraftReject: {
    borderColor: colors.destructive,
    borderWidth: 2,
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  cardPast: {
    backgroundColor: SHIFT_CARD_PAST_BACKGROUND,
  },
  cardPastBackground: {
    backgroundColor: SHIFT_CARD_PAST_BACKGROUND,
  },
  cardCompact: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
  },
  cardWithDismissAction: {
    paddingBottom: spacing.md + 4,
  },
  cardBody: {
    alignItems: "stretch",
    minHeight: 0,
    zIndex: 0,
  },
  contentBlock: {
    minWidth: 0,
    gap: 2,
  },
  headerRow: {
    position: "relative",
    minHeight: 0,
  },
  primaryLine: {
    minWidth: 0,
    paddingTop: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    columnGap: spacing.sm,
    rowGap: 2,
  },
  shiftTitle: {
    fontWeight: "600",
    flexShrink: 1,
  },
  timeSecondary: {
    fontWeight: "400",
    flexShrink: 0,
  },
  time: {
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  metaLine: {
    fontSize: SHIFT_META_BASE_SIZE,
    fontWeight: "500",
    minWidth: 0,
  },
  notes: {
    fontSize: 13,
    marginTop: spacing.sm,
    zIndex: 0,
  },
});
