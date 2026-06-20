import { StyleSheet, Text, View } from "react-native";
import { useWeekPlanLayout } from "@/lib/responsive-layout";
import { WEEK_PLAN_ACTIVE, WEEK_PLAN_PAST } from "@/lib/week-plan-theme";

type WeekDayHeaderProps = {
  weekdayLabel: string;
  dateLabel: string;
  isPastDay?: boolean;
  isToday?: boolean;
};

export function WeekDayHeader({
  weekdayLabel,
  dateLabel,
  isPastDay = false,
  isToday = false,
}: WeekDayHeaderProps) {
  const layout = useWeekPlanLayout();
  const textColor = isPastDay
    ? WEEK_PLAN_PAST.dayLabelText
    : isToday
      ? WEEK_PLAN_ACTIVE.todayLabelText
      : WEEK_PLAN_ACTIVE.dayLabelText;

  return (
    <View style={styles.column} accessibilityRole="header">
      <Text
        style={[
          styles.weekdayLabel,
          {
            fontSize: layout.weekdayFontSize,
            lineHeight: layout.weekdayLineHeight,
            color: textColor,
          },
        ]}
      >
        {weekdayLabel}
      </Text>
      <Text
        style={[styles.dateLabel, { fontSize: layout.dateFontSize, color: textColor }]}
        numberOfLines={1}
      >
        {dateLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: "100%",
    alignItems: "flex-end",
  },
  weekdayLabel: {
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "right",
  },
  dateLabel: {
    marginTop: 2,
    fontWeight: "400",
    lineHeight: 14,
    textAlign: "right",
  },
});
