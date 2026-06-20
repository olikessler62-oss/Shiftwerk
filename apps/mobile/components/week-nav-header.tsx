import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getWeekHeaderLeftParts,
  type WeekRange,
} from "@/lib/mobile-week-plan";
import { useWeekPlanLayout } from "@/lib/responsive-layout";
import { colors, radius, spacing } from "@schichtwerk/ui-tokens";

type WeekNavHeaderProps = {
  weekMeta: WeekRange;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onGoToToday: () => void;
  isCurrentWeek?: boolean;
};

export function WeekNavHeader({
  weekMeta,
  onPreviousWeek,
  onNextWeek,
  onGoToToday,
  isCurrentWeek = false,
}: WeekNavHeaderProps) {
  const layout = useWeekPlanLayout();
  const leftParts = useMemo(
    () => getWeekHeaderLeftParts(weekMeta),
    [weekMeta]
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View
        style={[
          styles.headerRow,
          {
            paddingHorizontal: layout.headerPaddingHorizontal,
            paddingTop: layout.headerTopSpace,
            paddingBottom: layout.headerBottomPadding,
            minHeight: layout.headerMinHeight,
          },
        ]}
      >
        <View
          style={styles.leftBlock}
          accessibilityRole="text"
          accessibilityLabel={leftParts.accessibilityLabel}
        >
          <Text
            style={[styles.monthYearLabel, { fontSize: layout.headerDayMonthFontSize }]}
          >
            {leftParts.monthYearLabel}
          </Text>
          <View style={styles.calendarWeekRow}>
            <Text
              style={[styles.calendarWeekPrefix, { fontSize: layout.headerKwFontSize }]}
            >
              KW{" "}
            </Text>
            <Text
              style={[styles.calendarWeekNumber, { fontSize: layout.headerKwFontSize }]}
            >
              {leftParts.calendarWeekNumber}
            </Text>
          </View>
        </View>

        <View style={styles.navGroup} accessibilityRole="toolbar">
          <Pressable
            style={({ pressed }) => [
              styles.navSegment,
              styles.navSegmentLeft,
              { minHeight: layout.navSegmentMinHeight },
              pressed && styles.navSegmentPressed,
            ]}
            accessibilityLabel="Vorherige Woche"
            onPress={onPreviousWeek}
          >
            <Ionicons
              name="chevron-back"
              size={layout.navIconSize}
              color={colors.primaryForeground}
            />
          </Pressable>

          <View style={styles.navDivider} />

          <Pressable
            style={({ pressed }) => [
              styles.navSegment,
              styles.navSegmentToday,
              { minHeight: layout.navSegmentMinHeight },
              pressed && styles.navSegmentPressed,
              isCurrentWeek && styles.navSegmentTodayActive,
            ]}
            accessibilityLabel="Heute"
            accessibilityState={{ selected: isCurrentWeek }}
            onPress={onGoToToday}
          >
            <Text
              style={[
                styles.navTodayText,
                { fontSize: layout.navTodayFontSize },
                isCurrentWeek && styles.navTodayTextActive,
              ]}
            >
              Heute
            </Text>
          </Pressable>

          <View style={styles.navDivider} />

          <Pressable
            style={({ pressed }) => [
              styles.navSegment,
              styles.navSegmentRight,
              { minHeight: layout.navSegmentMinHeight },
              pressed && styles.navSegmentPressed,
            ]}
            accessibilityLabel="Nächste Woche"
            onPress={onNextWeek}
          >
            <Ionicons
              name="chevron-forward"
              size={layout.navIconSize}
              color={colors.primaryForeground}
            />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.primary,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  leftBlock: {
    flexShrink: 1,
    minWidth: 0,
    paddingBottom: 0,
  },
  monthYearLabel: {
    fontWeight: "600",
    color: colors.primaryForeground,
    letterSpacing: -0.2,
  },
  calendarWeekRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 2,
  },
  calendarWeekPrefix: {
    fontWeight: "400",
    color: "rgba(255,255,255,0.82)",
  },
  calendarWeekNumber: {
    fontWeight: "900",
    color: "rgba(255,255,255,0.82)",
  },
  navGroup: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  navSegment: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  navSegmentLeft: {
    minWidth: 36,
  },
  navSegmentRight: {
    minWidth: 36,
  },
  navSegmentToday: {
    minWidth: 56,
    paddingHorizontal: spacing.sm + 2,
  },
  navSegmentTodayActive: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  navSegmentPressed: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  navTodayText: {
    fontWeight: "600",
    color: colors.primaryForeground,
  },
  navTodayTextActive: {
    color: colors.primaryForeground,
  },
  navDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
});
