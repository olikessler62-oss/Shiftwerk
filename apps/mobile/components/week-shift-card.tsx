import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type {
  ConfirmationDecision,
  ConfirmationWeekItem,
  EmployeeWeekShiftDisplayItem,
  Shift,
} from "@schichtwerk/types";
import { shiftConfirmationShowsOverlay } from "@schichtwerk/ui-tokens";
import { WeekShiftCardConfirmationOverlay } from "@/components/week-shift-card-confirmation-overlay";
import type { WeekShiftActionContext } from "@/components/week-shift-action-sheet";
import { isEmployeeDismissableShift, isEmployeeCancellationPending } from "@/lib/employee-shift-dismiss";
import {
  SHIFT_CARD_CONTENT_INSET_RIGHT_RATIO,
  WEEK_PLAN_PAST,
  resolveShiftCardContentTextColor,
} from "@/lib/week-plan-theme";
import { useWeekPlanLayout } from "@/lib/responsive-layout";
import {
  getWeekDayShiftsLayout,
  WEEK_DAY_GRID_CARD_WIDTH_PERCENT,
  type WeekDayShiftsLayout,
} from "@/lib/mobile-week-day-layout";
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
  minHeight?: number;
  shiftsOnDay?: number;
  shiftsLayout?: WeekDayShiftsLayout;
  allowTextWrap?: boolean;
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

const OVERLAY_BADGE_RESERVE_RATIO = 0.38;
const META_LINE_HEIGHT_RATIO = 0.13;

function scaleShiftCardForHeight(
  height: number,
  width: number,
  shiftsLayout: WeekDayShiftsLayout
): ShiftCardSizing {
  const multiColumn = shiftsLayout !== "single";
  const isTriple = shiftsLayout === "triple";
  const bodyHeight = height;

  const titleFontSize = fontSizeFromCardHeight(bodyHeight, TITLE_HEIGHT_RATIO);
  const timeFontSize = fontSizeFromCardHeight(bodyHeight, TIME_PRIMARY_HEIGHT_RATIO);
  const timeSecondaryFontSize = fontSizeFromCardHeight(
    bodyHeight,
    TIME_SECONDARY_HEIGHT_RATIO
  );
  let metaFontSize =
    fontSizeFromCardHeight(bodyHeight, META_LINE_HEIGHT_RATIO) +
    SHIFT_META_FONT_PX_OFFSET;

  if (multiColumn) {
    const metaDivisor = isTriple ? 13 : 11;
    const primaryDivisor = isTriple ? 12 : 10;
    const widthCap = width > 0 ? Math.max(8, Math.round(width / metaDivisor)) : 9;
    metaFontSize = Math.min(metaFontSize, widthCap);
    const primaryCap =
      width > 0 ? Math.max(8, Math.round(width / primaryDivisor)) : 11;
    return {
      paddingVertical: Math.max(2, Math.round(height * 0.04)),
      paddingHorizontal: Math.max(4, Math.round(height * (isTriple ? 0.05 : 0.06))),
      timeFontSize: Math.min(timeFontSize, primaryCap),
      timeSecondaryFontSize: Math.min(timeSecondaryFontSize, primaryCap),
      titleFontSize: Math.min(titleFontSize, primaryCap),
      metaFontSize,
      badgeFontSize: Math.max(8, Math.round(Math.min(10, bodyHeight * 0.14))),
      metaGap: 1,
      showNotes: false,
      notesFontSize: 11,
      notesMarginTop: 2,
      overlayBadgeReserveWidth: Math.max(
        isTriple ? 24 : 28,
        Math.round(height * (isTriple ? 0.28 : 0.32))
      ),
    };
  }

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

function getJobLabel(
  display?: EmployeeWeekShiftDisplayItem,
  confirmation?: ConfirmationWeekItem
): string | null {
  const label = confirmation?.jobName ?? display?.jobName ?? null;
  return label?.trim() ? label.trim() : null;
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

function buildAreaJobLabel(
  areaLabel: string | null,
  jobLabel: string | null
): string | null {
  const parts = [areaLabel?.trim(), jobLabel?.trim()].filter(
    (part): part is string => Boolean(part)
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

export function WeekShiftCard({
  shift,
  display,
  confirmation,
  draft,
  compact = false,
  height,
  minHeight,
  shiftsOnDay = 1,
  shiftsLayout: shiftsLayoutProp,
  allowTextWrap = false,
  isPastDay = false,
  onPress,
  onDismiss,
  dismissing = false,
}: WeekShiftCardProps) {
  const layout = useWeekPlanLayout();
  const [cardWidth, setCardWidth] = useState(0);
  const shiftsLayout = shiftsLayoutProp ?? getWeekDayShiftsLayout(shiftsOnDay);
  const multiColumn = shiftsLayout !== "single";
  const useCompactDetail = multiColumn;
  const sizingHeight = height ?? minHeight;
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
  const jobLabel = getJobLabel(display, confirmation);
  const metaLabel = buildShiftMetaLabel(locationLabel, areaLabel, jobLabel);
  const areaJobLabel = buildAreaJobLabel(areaLabel, jobLabel);
  const hasMeta = metaLabel.length > 0;
  const hasCompactDetail =
    useCompactDetail && (Boolean(locationLabel) || Boolean(areaJobLabel));
  const templateLabel = display?.templateName ?? null;
  const shiftTimeLabel = `${formatShiftTime(shift.starts_at)} – ${formatShiftTime(shift.ends_at)}`;
  const cancellationPending = isEmployeeCancellationPending(shift, display);
  const showsOverlay =
    cancellationPending || shiftConfirmationShowsOverlay(shift.confirmation_status);
  const canDismiss = isEmployeeDismissableShift(shift, display) && onDismiss != null;
  const cardDisabled = isPastDay && !canDismiss;
  const sizing =
    sizingHeight != null
      ? scaleShiftCardForHeight(sizingHeight, cardWidth, shiftsLayout)
      : null;
  const wrapText = allowTextWrap || multiColumn;
  const lineLimit = wrapText ? undefined : 1;
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
      detailLine: { color: cardTextColor },
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
        shiftsLayout === "single" && styles.cardShellSingle,
        (shiftsLayout === "pair" || shiftsLayout === "triple") &&
          styles.cardShellColumn,
        shiftsLayout === "grid" && styles.cardShellGrid,
        height != null && {
          height,
          marginBottom: 0,
        },
        minHeight != null && {
          minHeight,
          marginBottom: 0,
          flex: 1,
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
          sizingHeight != null && {
            flex: 1,
            paddingVertical: sizing!.paddingVertical,
            paddingHorizontal: sizing!.paddingHorizontal,
            justifyContent: multiColumn ? "flex-start" : "flex-start",
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
          cancellationPending={cancellationPending}
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
            sizingHeight != null && {
              flex: 1,
              justifyContent: multiColumn ? "flex-start" : "center",
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
                  <View
                    style={[
                      styles.titleRow,
                      multiColumn && styles.titleRowStacked,
                    ]}
                  >
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
                      numberOfLines={lineLimit}
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
                      numberOfLines={lineLimit}
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
                    numberOfLines={lineLimit}
                    adjustsFontSizeToFit={sizingHeight == null && !wrapText}
                    minimumFontScale={sizingHeight == null && !wrapText ? 0.75 : 1}
                  >
                    {shiftTimeLabel}
                  </Text>
                )}
              </View>
            </View>

            {hasCompactDetail ? (
              <View style={styles.detailBlock}>
                {locationLabel ? (
                  <Text
                    style={[
                      styles.detailLine,
                      textStyles.detailLine,
                      {
                        fontSize:
                          sizing?.metaFontSize ??
                          SHIFT_META_BASE_SIZE + SHIFT_META_FONT_PX_OFFSET,
                      },
                    ]}
                    numberOfLines={lineLimit}
                  >
                    {locationLabel}
                  </Text>
                ) : null}
                {areaJobLabel ? (
                  <Text
                    style={[
                      styles.detailLine,
                      textStyles.detailLine,
                      {
                        fontSize:
                          sizing?.metaFontSize ??
                          SHIFT_META_BASE_SIZE + SHIFT_META_FONT_PX_OFFSET,
                      },
                    ]}
                    numberOfLines={lineLimit}
                  >
                    {areaJobLabel}
                  </Text>
                ) : null}
              </View>
            ) : hasMeta ? (
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
                numberOfLines={lineLimit}
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
            numberOfLines={wrapText ? undefined : 1}
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
    minHeight: 0,
  },
  cardShellCompact: {
    marginBottom: spacing.xs,
  },
  cardShellSingle: {
    flex: 1,
  },
  cardShellColumn: {
    flex: 1,
    minWidth: 0,
  },
  cardShellGrid: {
    width: WEEK_DAY_GRID_CARD_WIDTH_PERCENT,
    minWidth: 0,
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
  titleRowStacked: {
    flexDirection: "column",
    alignItems: "flex-start",
    columnGap: 0,
    rowGap: 0,
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
  detailBlock: {
    minWidth: 0,
    gap: 1,
  },
  detailLine: {
    fontWeight: "500",
    minWidth: 0,
  },
  notes: {
    fontSize: 13,
    marginTop: spacing.sm,
    zIndex: 0,
  },
});
