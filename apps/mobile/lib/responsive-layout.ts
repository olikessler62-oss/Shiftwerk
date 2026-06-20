import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

/** Ab dieser Breite: Tablet-Layout (iPad, große Android-Tablets, Desktop-Web). */
export const TABLET_MIN_WIDTH = 768;

/** Max. Inhaltsbreite auf großen Screens — zentriert, lesbar auf Tablet/Desktop. */
export const WEEK_PLAN_MAX_CONTENT_WIDTH = 920;

export type WeekPlanLayout = {
  isTablet: boolean;
  width: number;
  contentMaxWidth: number | undefined;
  dayLabelColumnWidth: number | `${number}%`;
  shiftCardLeftInset: number;
  weekdayFontSize: number;
  weekdayLineHeight: number;
  dateFontSize: number;
  horizontalPadding: number;
  headerPaddingHorizontal: number;
  headerTopSpace: number;
  headerBottomPadding: number;
  headerMinHeight: number;
  headerDayMonthFontSize: number;
  headerKwFontSize: number;
  navSegmentMinHeight: number;
  navIconSize: number;
  navTodayFontSize: number;
  shiftCardCompact: boolean;
  shiftCardTimeFontSize: number;
  bannerFontSize: number;
};

export function getWeekPlanLayout(width: number): WeekPlanLayout {
  const isTablet = width >= TABLET_MIN_WIDTH;
  const isCompactPhone = width < 360;

  if (isTablet) {
    return {
      isTablet: true,
      width,
      contentMaxWidth: Math.min(WEEK_PLAN_MAX_CONTENT_WIDTH, width - 48),
      dayLabelColumnWidth: "18%",
      shiftCardLeftInset: 16,
      weekdayFontSize: 22,
      weekdayLineHeight: 26,
      dateFontSize: 13,
      horizontalPadding: 24,
      headerPaddingHorizontal: 24,
      headerTopSpace: 18,
      headerBottomPadding: 18,
      headerMinHeight: 72,
      headerDayMonthFontSize: 22,
      headerKwFontSize: 14,
      navSegmentMinHeight: 27,
      navIconSize: 18,
      navTodayFontSize: 15,
      shiftCardCompact: false,
      shiftCardTimeFontSize: 19,
      bannerFontSize: 14,
    };
  }

  return {
    isTablet: false,
    width,
    contentMaxWidth: undefined,
    dayLabelColumnWidth: "18%",
    shiftCardLeftInset: 10,
    weekdayFontSize: isCompactPhone ? 16 : 18,
    weekdayLineHeight: isCompactPhone ? 20 : 22,
    dateFontSize: isCompactPhone ? 10 : 11,
    horizontalPadding: 16,
    headerPaddingHorizontal: 16,
    headerTopSpace: 15,
    headerBottomPadding: 15,
    headerMinHeight: 62,
    headerDayMonthFontSize: 17,
    headerKwFontSize: 12,
    navSegmentMinHeight: 22,
    navIconSize: 16,
    navTodayFontSize: 13,
    shiftCardCompact: true,
    shiftCardTimeFontSize: 17,
    bannerFontSize: 13,
  };
}

export function useWeekPlanLayout(): WeekPlanLayout {
  const { width } = useWindowDimensions();
  return useMemo(() => getWeekPlanLayout(width), [width]);
}

export function useIsTabletLayout(): boolean {
  const { width } = useWindowDimensions();
  return width >= TABLET_MIN_WIDTH;
}
