import { StyleSheet, View } from "react-native";
import { WeekDayHeader } from "@/components/week-day-header";
import { WeekShiftCard } from "@/components/week-shift-card";
import type { WeekShiftActionContext } from "@/components/week-shift-action-sheet";
import {
  getWeekDayGridRowCount,
  getWeekDayShiftsLayout,
} from "@/lib/mobile-week-day-layout";
import { isPastDateISO, isTodayDateISO, type WeekPlanDay } from "@/lib/mobile-week-plan";
import { useWeekPlanLayout } from "@/lib/responsive-layout";
import { WEEK_PLAN_ACTIVE, WEEK_PLAN_PAST } from "@/lib/week-plan-theme";
import { spacing } from "@schichtwerk/ui-tokens";

const SHIFT_CARD_AREA_HEIGHT_RATIO = 0.95;
const SHIFT_CARD_GAP = 4;

type WeekDaySlotProps = {
  day: WeekPlanDay;
  slotHeight: number;
  onShiftPress: (context: WeekShiftActionContext) => void;
  onDismissShift: (shiftId: string) => void;
  dismissingShiftId?: string | null;
};

function resolveCardHeight(
  cardsAreaHeight: number,
  layout: WeekDayShiftsLayout,
  shiftCount: number
): number {
  if (layout === "grid") {
    const rowCount = getWeekDayGridRowCount(shiftCount);
    return Math.floor(
      (cardsAreaHeight - SHIFT_CARD_GAP * Math.max(rowCount - 1, 0)) / rowCount
    );
  }
  return cardsAreaHeight;
}

export function WeekDaySlot({
  day,
  slotHeight,
  onShiftPress,
  onDismissShift,
  dismissingShiftId = null,
}: WeekDaySlotProps) {
  const layout = useWeekPlanLayout();
  const isPastDay = isPastDateISO(day.dateISO);
  const isToday = isTodayDateISO(day.dateISO);
  const theme = isPastDay ? WEEK_PLAN_PAST : WEEK_PLAN_ACTIVE;
  const cardsAreaHeight = Math.floor(slotHeight * SHIFT_CARD_AREA_HEIGHT_RATIO);
  const shiftCount = day.shifts.length;
  const shiftsLayout = getWeekDayShiftsLayout(shiftCount);
  const cardHeight = resolveCardHeight(cardsAreaHeight, shiftsLayout, shiftCount);

  return (
    <View
      style={[
        styles.slot,
        { borderBottomColor: theme.rowDivider },
      ]}
    >
      <View
        style={[
          styles.dayColumn,
          {
            width: layout.dayLabelColumnWidth,
            paddingLeft: layout.horizontalPadding,
            backgroundColor: theme.columnBackground,
          },
        ]}
      >
        <WeekDayHeader
          weekdayLabel={day.weekdayLabel}
          dateLabel={day.dateLabel}
          isPastDay={isPastDay}
          isToday={isToday}
        />
      </View>

      <View
        style={[
          styles.shiftsColumn,
          {
            paddingLeft: layout.shiftCardLeftInset,
            paddingRight: layout.horizontalPadding,
            backgroundColor: theme.columnBackground,
          },
        ]}
      >
        {shiftCount > 0 ? (
          <View
            style={[
              styles.cardsStack,
              { height: cardsAreaHeight },
              shiftsLayout === "pair" && styles.cardsRow,
              shiftsLayout === "grid" && styles.cardsGrid,
            ]}
          >
            {day.shifts.map(({ shift, display, confirmation }) => (
              <WeekShiftCard
                key={shift.id}
                shift={shift}
                display={display}
                confirmation={confirmation}
                isPastDay={isPastDay}
                onPress={onShiftPress}
                onDismiss={onDismissShift}
                dismissing={dismissingShiftId === shift.id}
                compact={layout.shiftCardCompact}
                height={cardHeight}
                shiftsOnDay={shiftCount}
                shiftsLayout={shiftsLayout}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: "100%",
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayColumn: {
    paddingRight: spacing.sm,
    justifyContent: "center",
  },
  shiftsColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  cardsStack: {
    justifyContent: "center",
    gap: SHIFT_CARD_GAP,
  },
  cardsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start",
    justifyContent: "space-between",
  },
});
