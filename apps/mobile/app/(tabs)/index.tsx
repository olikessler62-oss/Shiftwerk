import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { isShiftDateInPast } from "@schichtwerk/database";
import {
  isEmployeeDismissableShift,
  isEmployeeCancellationPending,
} from "@/lib/employee-shift-dismiss";
import { isOpenEmployeeConfirmationShift } from "@/lib/open-confirmation-shift";
import type { EmployeeWeekShiftDisplayItem, Shift } from "@schichtwerk/types";
import { WeekNavHeader } from "@/components/week-nav-header";
import { WeekDaySlot } from "@/components/week-day-slot";
import {
  WeekShiftActionSheet,
  type WeekShiftActionContext,
} from "@/components/week-shift-action-sheet";
import { ResponsiveContentFrame } from "@/components/responsive-content-frame";
import { getDatabase } from "@/lib/db";
import {
  fetchConfirmationWeek,
  fetchMyShiftWeekDisplay,
  cancelConfirmationShift,
  dismissCanceledShift,
} from "@/lib/confirmations-api";
import { MobileApiError } from "@/lib/mobile-api-client";
import { useAppDialog } from "@/lib/use-app-dialog";
import { buildWeekPlanDays, weekRangeForOffset } from "@/lib/mobile-week-plan";
import {
  resolveWeekDaySlotHeights,
  resolveWeekDaySlotHeightForContent,
} from "@/lib/mobile-week-day-layout";
import { usePendingConfirmations } from "@/lib/pending-confirmations-context";
import { useWeekPlanLayout } from "@/lib/responsive-layout";
import { colors, radius, spacing } from "@schichtwerk/ui-tokens";

export default function WeekScreen() {
  const { alert, confirm, dialog } = useAppDialog();
  const [weekOffset, setWeekOffset] = useState(0);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [displayByShiftId, setDisplayByShiftId] = useState<
    Record<string, EmployeeWeekShiftDisplayItem>
  >({});
  const [confirmationByShiftId, setConfirmationByShiftId] = useState<
    Record<string, import("@schichtwerk/types").ConfirmationWeekItem>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelingShiftId, setCancelingShiftId] = useState<string | null>(null);
  const [dismissingShiftId, setDismissingShiftId] = useState<string | null>(null);
  const [actionSheetContext, setActionSheetContext] =
    useState<WeekShiftActionContext | null>(null);
  const [weekGridHeight, setWeekGridHeight] = useState(0);
  const [dayHeightExtras, setDayHeightExtras] = useState<Record<string, number>>({});
  const initialFocusRef = useRef(true);

  const weekMeta = useMemo(() => weekRangeForOffset(weekOffset), [weekOffset]);
  const isCurrentWeek = weekOffset === 0;
  const layout = useWeekPlanLayout();
  const { refresh: refreshPendingConfirmations, count: pendingConfirmationCount } =
    usePendingConfirmations();

  const load = useCallback(async () => {
    const { from, to } = weekMeta;
    try {
      const data = await getDatabase().listMyShifts(from, to);
      let displayItems: EmployeeWeekShiftDisplayItem[];
      try {
        displayItems = await fetchMyShiftWeekDisplay(from, to);
      } catch {
        displayItems = await getDatabase().listMyShiftWeekDisplay(from, to);
      }
      setShifts(data);
      setDisplayByShiftId(
        Object.fromEntries(displayItems.map((item) => [item.shiftId, item]))
      );

      try {
        const confirmation = await fetchConfirmationWeek(from, to);
        setConfirmationByShiftId(
          Object.fromEntries(
            confirmation.items.map((item) => [item.shiftId, item])
          )
        );
      } catch (error) {
        setConfirmationByShiftId({});
        if (error instanceof MobileApiError && error.status === 403) {
          // Schichtbestätigung für die Organisation deaktiviert.
        } else if (error instanceof MobileApiError && error.status !== 401) {
          void alert({
            title: "Bestätigungen",
            message:
              error.message || "Offene Bestätigungen konnten nicht geladen werden.",
          });
        }
      }

      await refreshPendingConfirmations();
    } catch {
      setShifts([]);
      setDisplayByShiftId({});
      setConfirmationByShiftId({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [weekMeta, alert, refreshPendingConfirmations]);

  useFocusEffect(
    useCallback(() => {
      if (initialFocusRef.current) {
        initialFocusRef.current = false;
        setLoading(true);
      }
      void load();
    }, [load])
  );

  useEffect(() => {
    if (initialFocusRef.current) return;
    setLoading(true);
    void load();
  }, [weekOffset, load]);

  useEffect(() => {
    setDayHeightExtras({});
  }, [weekMeta.from]);

  const handleDayContentHeightChange = useCallback(
    (dateISO: string, contentHeight: number, baseCardsAreaHeight: number) => {
      const baseSlotHeight = resolveWeekDaySlotHeightForContent(baseCardsAreaHeight);
      const requiredSlotHeight = resolveWeekDaySlotHeightForContent(contentHeight);
      const extra = Math.max(0, requiredSlotHeight - baseSlotHeight);
      setDayHeightExtras((prev) => {
        if ((prev[dateISO] ?? 0) === extra) return prev;
        if (extra === 0) {
          if (!(dateISO in prev)) return prev;
          const { [dateISO]: _removed, ...rest } = prev;
          return rest;
        }
        return { ...prev, [dateISO]: extra };
      });
    },
    []
  );

  const weekDays = useMemo(
    () =>
      buildWeekPlanDays(
        shifts,
        weekMeta.dates,
        displayByShiftId,
        confirmationByShiftId
      ),
    [shifts, weekMeta.dates, displayByShiftId, confirmationByShiftId]
  );

  const openConfirmationCount = useMemo(
    () => shifts.filter((shift) => isOpenEmployeeConfirmationShift(shift)).length,
    [shifts]
  );

  const pendingInOtherWeeks = Math.max(
    0,
    pendingConfirmationCount - openConfirmationCount
  );

  const shiftNeedsResponse = useCallback(
    (shift: Shift) => isOpenEmployeeConfirmationShift(shift),
    []
  );

  const shiftCanCancel = useCallback(
    (shift: Shift, display?: EmployeeWeekShiftDisplayItem) =>
      !isShiftDateInPast(shift.shift_date) &&
      !isEmployeeCancellationPending(shift, display) &&
      shift.confirmation_status === "confirmed",
    []
  );

  const shiftCanDismiss = useCallback(
    (shift: Shift, display?: EmployeeWeekShiftDisplayItem) =>
      isEmployeeDismissableShift(shift, display),
    []
  );

  async function handleCancelShift(shiftId: string, reason?: string) {
    const returnContext =
      actionSheetContext?.shift.id === shiftId ? actionSheetContext : null;
    setActionSheetContext(null);

    const confirmed = await confirm({
      title: "Schicht absagen",
      message: "Möchtest du diese Schicht wirklich absagen?",
      confirmLabel: "Ja, absagen",
      confirmDestructive: true,
    });
    if (!confirmed) {
      if (returnContext) setActionSheetContext(returnContext);
      return;
    }

    setCancelingShiftId(shiftId);
    try {
      await cancelConfirmationShift(shiftId, reason);
      setActionSheetContext(null);
      setDisplayByShiftId((prev) => {
        const existing = prev[shiftId];
        if (!existing) return prev;
        return {
          ...prev,
          [shiftId]: { ...existing, cancellationPending: true },
        };
      });
      setRefreshing(true);
      await load();
      await alert({
        title: "Absage gesendet",
        message:
          "Deine Absage wurde übermittelt. Das Team kümmert sich um die weiteren Schritte.",
      });
    } catch (error) {
      await alert({
        title: "Absage fehlgeschlagen",
        message:
          error instanceof MobileApiError
            ? error.message
            : "Die Schicht konnte nicht abgesagt werden.",
      });
    } finally {
      setCancelingShiftId(null);
    }
  }

  async function handleDismissShift(shiftId: string) {
    const returnContext =
      actionSheetContext?.shift.id === shiftId ? actionSheetContext : null;
    setActionSheetContext(null);

    const confirmed = await confirm({
      title: "Aus Plan entfernen",
      message:
        "Die stornierte Schicht wird aus deinem Wochenplan entfernt. Du kannst sie danach nicht mehr einsehen.",
      confirmLabel: "Entfernen",
    });
    if (!confirmed) {
      if (returnContext) setActionSheetContext(returnContext);
      return;
    }

    setDismissingShiftId(shiftId);
    try {
      await dismissCanceledShift(shiftId);
      setActionSheetContext(null);
      setRefreshing(true);
      await load();
      await refreshPendingConfirmations();
    } catch (error) {
      await alert({
        title: "Entfernen fehlgeschlagen",
        message:
          error instanceof MobileApiError
            ? error.message
            : "Die Schicht konnte nicht entfernt werden.",
      });
    } finally {
      setDismissingShiftId(null);
    }
  }

  const daySlotLayout = useMemo(() => {
    if (weekGridHeight <= 0) {
      return {
        heights: weekDays.map(() => 0),
        scrollable: false,
      };
    }
    return resolveWeekDaySlotHeights(
      weekDays.map((day) => day.shifts.length),
      weekGridHeight
    );
  }, [weekDays, weekGridHeight]);

  const effectiveWeekDayHeights = useMemo(
    () =>
      daySlotLayout.heights.map(
        (height, index) => height + (dayHeightExtras[weekDays[index]?.dateISO ?? ""] ?? 0)
      ),
    [dayHeightExtras, daySlotLayout.heights, weekDays]
  );

  const totalWeekDayHeight = useMemo(
    () => effectiveWeekDayHeights.reduce((sum, height) => sum + height, 0),
    [effectiveWeekDayHeights]
  );

  const weekGridScrollable =
    daySlotLayout.scrollable || totalWeekDayHeight > weekGridHeight;

  const weekNav = (
    <WeekNavHeader
      weekMeta={weekMeta}
      isCurrentWeek={isCurrentWeek}
      onPreviousWeek={() => setWeekOffset((value) => value - 1)}
      onNextWeek={() => setWeekOffset((value) => value + 1)}
      onGoToToday={() => setWeekOffset(0)}
    />
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        <ResponsiveContentFrame>
          {weekNav}
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        </ResponsiveContentFrame>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ResponsiveContentFrame>
        {weekNav}

        {openConfirmationCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(tabs)/requests")}
            style={[
              styles.banner,
              {
                marginHorizontal: layout.horizontalPadding,
                borderRadius: layout.isTablet ? radius.lg : radius.md,
              },
            ]}
          >
            <Text style={[styles.bannerText, { fontSize: layout.bannerFontSize }]}>
              {openConfirmationCount} Schicht
              {openConfirmationCount === 1 ? "" : "en"} warten auf deine
              Bestätigung — jetzt bearbeiten.
            </Text>
          </Pressable>
        ) : null}

        {pendingInOtherWeeks > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(tabs)/requests")}
            style={[
              styles.otherWeekBanner,
              {
                marginHorizontal: layout.horizontalPadding,
                borderRadius: layout.isTablet ? radius.lg : radius.md,
              },
            ]}
          >
            <Text style={[styles.otherWeekBannerText, { fontSize: layout.bannerFontSize }]}>
              {pendingInOtherWeeks} weitere Anfrage
              {pendingInOtherWeeks === 1 ? "" : "n"} in anderen Wochen — unter
              Benachrichtigungen öffnen.
            </Text>
          </Pressable>
        ) : null}

        <View
          style={styles.weekGridHost}
          onLayout={(event) => setWeekGridHeight(event.nativeEvent.layout.height)}
        >
          {effectiveWeekDayHeights.some((height) => height > 0) ? (
            <ScrollView
              style={styles.weekGridScroll}
              contentContainerStyle={[
                styles.weekGridScrollContent,
                !weekGridScrollable && styles.weekGridScrollContentFill,
              ]}
              showsVerticalScrollIndicator={weekGridScrollable}
              bounces={weekGridScrollable}
              scrollEnabled={weekGridScrollable}
            >
              {weekDays.map((day, index) => (
                <View
                  key={day.dateISO}
                  style={{ height: effectiveWeekDayHeights[index] ?? 0 }}
                >
                  <WeekDaySlot
                    day={day}
                    slotHeight={effectiveWeekDayHeights[index] ?? 0}
                    onShiftPress={setActionSheetContext}
                    onDismissShift={(shiftId) => void handleDismissShift(shiftId)}
                    dismissingShiftId={dismissingShiftId}
                    onContentHeightChange={handleDayContentHeightChange}
                  />
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>

        <WeekShiftActionSheet
          visible={actionSheetContext != null}
          context={actionSheetContext}
          needsResponse={
            actionSheetContext
              ? shiftNeedsResponse(actionSheetContext.shift)
              : false
          }
          canCancel={
            actionSheetContext
              ? shiftCanCancel(
                  actionSheetContext.shift,
                  actionSheetContext.display
                )
              : false
          }
          canDismiss={
            actionSheetContext
              ? shiftCanDismiss(
                  actionSheetContext.shift,
                  actionSheetContext.display
                )
              : false
          }
          canceling={
            actionSheetContext != null &&
            cancelingShiftId === actionSheetContext.shift.id
          }
          dismissing={
            actionSheetContext != null &&
            dismissingShiftId === actionSheetContext.shift.id
          }
          onClose={() => setActionSheetContext(null)}
          onGoToRequests={() => router.push("/(tabs)/requests")}
          onCancel={(shiftId, reason) => void handleCancelShift(shiftId, reason)}
          onDismiss={(shiftId) => void handleDismissShift(shiftId)}
        />
      </ResponsiveContentFrame>
      {dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  weekGridHost: {
    flex: 1,
    minHeight: 0,
  },
  weekGridScroll: {
    flex: 1,
  },
  weekGridScrollContent: {
    flexGrow: 1,
  },
  weekGridScrollContentFill: {
    minHeight: "100%",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  banner: {
    backgroundColor: "#FFFBEB",
    borderColor: colors.warning,
    borderWidth: 1,
    padding: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  bannerText: {
    color: colors.primary,
    fontWeight: "600",
    lineHeight: 18,
  },
  otherWeekBanner: {
    backgroundColor: "#EFF6FF",
    borderColor: colors.primary,
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  otherWeekBannerText: {
    color: colors.primary,
    fontWeight: "600",
    lineHeight: 18,
  },
});
