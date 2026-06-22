import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { isShiftDateInPast } from "@schichtwerk/database";
import { isEmployeeDismissableShift } from "@/lib/employee-shift-dismiss";
import { isOpenEmployeeConfirmationShift } from "@/lib/open-confirmation-shift";
import type { ConfirmationDecision, ConfirmationWeekItem, EmployeeWeekShiftDisplayItem, Shift } from "@schichtwerk/types";
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
  submitConfirmationResponses,
  cancelConfirmationShift,
  dismissCanceledShift,
} from "@/lib/confirmations-api";
import { MobileApiError } from "@/lib/mobile-api-client";
import { confirmAlert, showAppAlert } from "@/lib/app-alert";
import { buildWeekPlanDays, weekRangeForOffset } from "@/lib/mobile-week-plan";
import { usePendingConfirmations } from "@/lib/pending-confirmations-context";
import { useWeekPlanLayout } from "@/lib/responsive-layout";
import { colors, radius, spacing } from "@schichtwerk/ui-tokens";

export default function WeekScreen() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [displayByShiftId, setDisplayByShiftId] = useState<
    Record<string, EmployeeWeekShiftDisplayItem>
  >({});
  const [confirmationByShiftId, setConfirmationByShiftId] = useState<
    Record<string, ConfirmationWeekItem>
  >({});
  const [organizationDisclaimer, setOrganizationDisclaimer] = useState<string | null>(
    null
  );
  const [drafts, setDrafts] = useState<Record<string, ConfirmationDecision>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelingShiftId, setCancelingShiftId] = useState<string | null>(null);
  const [dismissingShiftId, setDismissingShiftId] = useState<string | null>(null);
  const [actionSheetContext, setActionSheetContext] =
    useState<WeekShiftActionContext | null>(null);
  const [weekGridHeight, setWeekGridHeight] = useState(0);
  const initialFocusRef = useRef(true);

  const weekMeta = useMemo(() => weekRangeForOffset(weekOffset), [weekOffset]);
  const isCurrentWeek = weekOffset === 0;
  const layout = useWeekPlanLayout();
  const { refresh: refreshPendingConfirmations, count: pendingConfirmationCount } =
    usePendingConfirmations();

  const load = useCallback(async () => {
    const { from, to } = weekMeta;
    try {
      const [data, displayItems] = await Promise.all([
        getDatabase().listMyShifts(from, to),
        getDatabase().listMyShiftWeekDisplay(from, to),
      ]);
      setShifts(data);
      setDisplayByShiftId(
        Object.fromEntries(displayItems.map((item) => [item.shiftId, item]))
      );

      try {
        const confirmation = await fetchConfirmationWeek(from, to);
        setOrganizationDisclaimer(confirmation.organizationDisclaimer);
        setConfirmationByShiftId(
          Object.fromEntries(
            confirmation.items.map((item) => [item.shiftId, item])
          )
        );
      } catch (error) {
        setConfirmationByShiftId({});
        setOrganizationDisclaimer(null);
        if (error instanceof MobileApiError && error.status === 403) {
          // Schichtbestätigung für die Organisation deaktiviert.
        } else if (error instanceof MobileApiError && error.status !== 401) {
          showAppAlert(
            "Bestätigungen",
            error.message || "Offene Bestätigungen konnten nicht geladen werden."
          );
        }
      }
    } catch {
      setShifts([]);
      setDisplayByShiftId({});
      setConfirmationByShiftId({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [weekMeta]);

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

  const draftEntries = useMemo(
    () =>
      Object.entries(drafts).filter(([shiftId]) => {
        const shift = shifts.find((entry) => entry.id === shiftId);
        return shift != null && isOpenEmployeeConfirmationShift(shift);
      }),
    [drafts, shifts]
  );

  const shiftNeedsResponse = useCallback(
    (shift: Shift) => isOpenEmployeeConfirmationShift(shift),
    []
  );

  const shiftCanCancel = useCallback(
    (shift: Shift) =>
      !isShiftDateInPast(shift.shift_date) &&
      shift.confirmation_status === "confirmed",
    []
  );

  const shiftCanDismiss = useCallback(
    (shift: Shift, display?: EmployeeWeekShiftDisplayItem) =>
      isEmployeeDismissableShift(shift, display),
    []
  );

  function toggleDraft(shiftId: string, decision: ConfirmationDecision) {
    setDrafts((prev) => {
      if (prev[shiftId] === decision) {
        const next = { ...prev };
        delete next[shiftId];
        return next;
      }
      return { ...prev, [shiftId]: decision };
    });
  }

  async function handleSubmitResponses() {
    if (draftEntries.length === 0 || submitting) return;

    setSubmitting(true);
    try {
      const result = await submitConfirmationResponses(
        draftEntries.map(([shiftId, decision]) => ({ shiftId, decision }))
      );
      setDrafts({});
      showAppAlert(
        "Gesendet",
        `${result.updatedCount} Antwort${result.updatedCount === 1 ? "" : "en"} übermittelt.`
      );
      setRefreshing(true);
      await load();
      await refreshPendingConfirmations();
    } catch (error) {
      showAppAlert(
        "Senden fehlgeschlagen",
        error instanceof MobileApiError
          ? error.message
          : "Antworten konnten nicht gespeichert werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelShift(shiftId: string) {
    const confirmed = await confirmAlert({
      title: "Schicht absagen",
      message: "Möchtest du diese Schicht wirklich absagen?",
      confirmLabel: "Ja, absagen",
    });
    if (!confirmed) return;

    setCancelingShiftId(shiftId);
    try {
      await cancelConfirmationShift(shiftId);
      setActionSheetContext(null);
      showAppAlert("Abgesagt", "Die Schicht wurde abgesagt.");
      setRefreshing(true);
      await load();
    } catch (error) {
      showAppAlert(
        "Absage fehlgeschlagen",
        error instanceof MobileApiError
          ? error.message
          : "Die Schicht konnte nicht abgesagt werden."
      );
    } finally {
      setCancelingShiftId(null);
    }
  }

  async function handleDismissShift(shiftId: string) {
    const confirmed = await confirmAlert({
      title: "Aus Plan entfernen",
      message:
        "Die stornierte Schicht wird aus deinem Wochenplan entfernt. Du kannst sie danach nicht mehr einsehen.",
      confirmLabel: "Entfernen",
    });
    if (!confirmed) return;

    setDismissingShiftId(shiftId);
    try {
      await dismissCanceledShift(shiftId);
      setActionSheetContext(null);
      setRefreshing(true);
      await load();
      await refreshPendingConfirmations();
    } catch (error) {
      showAppAlert(
        "Entfernen fehlgeschlagen",
        error instanceof MobileApiError
          ? error.message
          : "Die Schicht konnte nicht entfernt werden."
      );
    } finally {
      setDismissingShiftId(null);
    }
  }

  const daySlotHeight =
    weekGridHeight > 0 ? Math.floor(weekGridHeight / weekDays.length) : 0;

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
          <View
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
              Bestätigung.
            </Text>
          </View>
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
          {daySlotHeight > 0
            ? weekDays.map((day) => (
                <View key={day.dateISO} style={{ height: daySlotHeight }}>
                  <WeekDaySlot
                    day={day}
                    slotHeight={daySlotHeight}
                    drafts={drafts}
                    onShiftPress={setActionSheetContext}
                    onDismissShift={(shiftId) => void handleDismissShift(shiftId)}
                    dismissingShiftId={dismissingShiftId}
                  />
                </View>
              ))
            : null}
        </View>

        {draftEntries.length > 0 ? (
          <View style={styles.footer}>
            {organizationDisclaimer ? (
              <Text style={styles.disclaimer}>{organizationDisclaimer}</Text>
            ) : (
              <Text style={styles.disclaimer}>
                Mit dem Senden bestätigst du deine Auswahl für die markierten
                Schichten.
              </Text>
            )}
            <Pressable
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={() => void handleSubmitResponses()}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={styles.submitButtonText}>
                  Antworten senden ({draftEntries.length})
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

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
              ? shiftCanCancel(actionSheetContext.shift)
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
          draft={
            actionSheetContext
              ? drafts[actionSheetContext.shift.id]
              : undefined
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
          onToggleDraft={toggleDraft}
          onCancel={(shiftId) => void handleCancelShift(shiftId)}
          onDismiss={(shiftId) => void handleDismissShift(shiftId)}
        />
      </ResponsiveContentFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  weekGridHost: {
    flex: 1,
    minHeight: 0,
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
    color: colors.foreground,
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
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  submitButton: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: {
    color: colors.primaryForeground,
    fontWeight: "600",
    fontSize: 15,
  },
});
