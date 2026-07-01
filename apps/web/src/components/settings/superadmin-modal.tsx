"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { resetOrganizationDatabase } from "@/app/actions/db-reset";
import { resetOrganizationShifts } from "@/app/actions/superadmin-shifts";
import { NotificationOutboxModal } from "@/components/settings/notification-outbox-modal";
import { SuperadminDeleteEmployeesModal } from "@/components/settings/superadmin-delete-employees-modal";
import { SuperadminEmployeesSection } from "@/components/settings/superadmin-employees-section";
import { SuperadminOrganizationSection } from "@/components/settings/superadmin-organization-section";
import { SuperadminShiftsSection } from "@/components/settings/superadmin-shifts-section";
import { SuperadminTestScenariosSection } from "@/components/settings/superadmin-test-scenarios-section";
import { SettingsSidePanelCloseButton } from "@/components/settings/settings-side-panel";
import { Alert, Button } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  MODAL_SCROLLBAR_CLASS,
  settingsConfirmDialogClass,
  settingsModalFooterClass,
  settingsNestedModalOverlayClass,
  SettingsConfirmDialogCloseHeader,
} from "@/components/settings/settings-list-ui";
import {
  PLANNING_SIDE_PANEL_FOOTER_CLASS,
  PlanningRightSidePanel,
} from "@/components/planning/planning-side-panel";

type Props = {
  onClose: () => void;
};

type SuperadminTab = "simulation" | "shifts" | "testScenarios";

function SuperadminSaveButton({
  disabled,
  onSave,
}: {
  disabled: boolean;
  onSave: () => void;
}) {
  const t = useTranslations();
  return (
    <Button type="button" disabled={disabled} onClick={onSave}>
      {t("common.save")}
    </Button>
  );
}

export function SuperadminModal({ onClose }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SuperadminTab>("simulation");
  const [notificationOutboxOpen, setNotificationOutboxOpen] = useState(false);
  const [deleteEmployeesOpen, setDeleteEmployeesOpen] = useState(false);
  const [dbResetConfirmOpen, setDbResetConfirmOpen] = useState(false);
  const [shiftsResetConfirmOpen, setShiftsResetConfirmOpen] = useState(false);
  const [deleteAllShiftsOnReset, setDeleteAllShiftsOnReset] = useState(false);
  const [dbResetError, setDbResetError] = useState<string | null>(null);
  const [shiftsResetError, setShiftsResetError] = useState<string | null>(null);
  const [orgHasChanges, setOrgHasChanges] = useState(false);
  const [orgSavePending, setOrgSavePending] = useState(false);
  const orgSaveRef = useRef<() => void>(() => {});
  const [dbResetPending, startDbResetTransition] = useTransition();
  const [shiftsResetPending, startShiftsResetTransition] = useTransition();
  const [scenarioBusy, setScenarioBusy] = useState(false);

  const actionPending = dbResetPending || shiftsResetPending;
  const panelBusy = actionPending || scenarioBusy;

  const nestedOverlayOpen =
    notificationOutboxOpen ||
    deleteEmployeesOpen ||
    dbResetConfirmOpen ||
    shiftsResetConfirmOpen;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function handleDbResetConfirm() {
    setDbResetError(null);
    startDbResetTransition(async () => {
      const result = await resetOrganizationDatabase();
      if (!result.ok) {
        setDbResetError(result.error);
        setDbResetConfirmOpen(false);
      }
    });
  }

  function handleShiftsResetConfirm() {
    setShiftsResetError(null);
    startShiftsResetTransition(async () => {
      const result = await resetOrganizationShifts({
        deleteAllShifts: deleteAllShiftsOnReset,
      });
      if (!result.ok) {
        setShiftsResetError(
          result.error
            ? `${t(result.errorKey)} ${result.error}`
            : t(result.errorKey)
        );
        setShiftsResetConfirmOpen(false);
        return;
      }
      setShiftsResetConfirmOpen(false);
      router.refresh();
    });
  }

  const nestedOverlay =
    nestedOverlayOpen || actionPending ? (
      <>
        {notificationOutboxOpen ? (
          <NotificationOutboxModal onClose={() => setNotificationOutboxOpen(false)} />
        ) : null}

        {deleteEmployeesOpen ? (
          <SuperadminDeleteEmployeesModal onClose={() => setDeleteEmployeesOpen(false)} />
        ) : null}

        {dbResetConfirmOpen ? (
          <div
            className={settingsNestedModalOverlayClass()}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !actionPending) {
                setDbResetConfirmOpen(false);
              }
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="superadmin-db-reset-title"
              className={cn(settingsConfirmDialogClass(), "overflow-hidden p-0")}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <SettingsConfirmDialogCloseHeader
                onClose={() => setDbResetConfirmOpen(false)}
                closeDisabled={actionPending}
                closeAriaLabel={t("common.close")}
              />
              <div className="px-4 py-4 sm:px-5">
                <h3
                  id="superadmin-db-reset-title"
                  className="text-base font-semibold text-foreground"
                >
                  {t("nav.dbResetConfirmTitle")}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {t("nav.dbResetConfirmBody")}
                </p>
                <div className={settingsModalFooterClass("mt-5 border-0 px-0 pb-0 pt-0")}>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={actionPending}
                    onClick={() => setDbResetConfirmOpen(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={actionPending}
                    onClick={handleDbResetConfirm}
                  >
                    {dbResetPending ? t("nav.dbResetPending") : t("nav.dbReset")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {shiftsResetConfirmOpen ? (
          <div
            className={settingsNestedModalOverlayClass()}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !actionPending) {
                setShiftsResetConfirmOpen(false);
              }
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="superadmin-shifts-reset-title"
              className={cn(settingsConfirmDialogClass(), "overflow-hidden p-0")}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <SettingsConfirmDialogCloseHeader
                onClose={() => setShiftsResetConfirmOpen(false)}
                closeDisabled={actionPending}
                closeAriaLabel={t("common.close")}
              />
              <div className="px-4 py-4 sm:px-5">
                <h3
                  id="superadmin-shifts-reset-title"
                  className="text-base font-semibold text-foreground"
                >
                  {t("nav.shiftsResetConfirmTitle")}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {deleteAllShiftsOnReset
                    ? t("nav.shiftsResetConfirmBodyDeleteShifts")
                    : t("nav.shiftsResetConfirmBodyKeepShifts")}
                </p>
                <div className={settingsModalFooterClass("mt-5 border-0 px-0 pb-0 pt-0")}>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={actionPending}
                    onClick={() => setShiftsResetConfirmOpen(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={actionPending}
                    onClick={handleShiftsResetConfirm}
                  >
                    {shiftsResetPending ? t("nav.shiftsResetPending") : t("nav.shiftsReset")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </>
    ) : null;

  const nestedOverlayPortal =
    nestedOverlay && typeof document !== "undefined"
      ? createPortal(
          <div className="pointer-events-none fixed inset-0 z-[115] md:left-[var(--app-shell-sidebar-width)] [&>*]:pointer-events-auto">
            {nestedOverlay}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <PlanningRightSidePanel
        size="wide"
        title={t("nav.superadmin")}
        titleId="superadmin-modal-title"
        onClose={onClose}
        closeDisabled={panelBusy}
        closeAriaLabel={t("common.close")}
        panelClassName={cn(panelBusy && "cursor-wait [&_*]:cursor-wait")}
        bodyClassName={cn(MODAL_SCROLLBAR_CLASS, "space-y-6")}
        headerAside={
          <div
            className="flex flex-wrap gap-1 border-b border-border"
            role="tablist"
            aria-label={t("nav.superadmin")}
          >
            {(
              [
                ["simulation", "nav.superadminTabSimulation"],
                ["shifts", "nav.superadminTabShifts"],
                ["testScenarios", "nav.superadminTabTestScenarios"],
              ] as const
            ).map(([tab, labelKey]) => {
              const selected = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  disabled={panelBusy}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
                    selected
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted hover:border-border hover:text-foreground"
                  )}
                >
                  {t(labelKey)}
                </button>
              );
            })}
          </div>
        }
        footer={
          <div className={cn(PLANNING_SIDE_PANEL_FOOTER_CLASS, "justify-end gap-2")}>
            <SettingsSidePanelCloseButton disabled={panelBusy} />
            {activeTab === "simulation" ? (
              <SuperadminSaveButton
                disabled={actionPending || orgSavePending || !orgHasChanges}
                onSave={() => orgSaveRef.current()}
              />
            ) : null}
          </div>
        }
      >
        {dbResetError ? <Alert variant="error">{dbResetError}</Alert> : null}
        {shiftsResetError ? <Alert variant="error">{shiftsResetError}</Alert> : null}

        {activeTab === "simulation" ? (
          <>
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t("nav.superadminActionsTitle")}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={actionPending}
                    onClick={() => setNotificationOutboxOpen(true)}
                  >
                    {t("nav.notificationOutbox")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={actionPending}
                    className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                    onClick={() => setDeleteEmployeesOpen(true)}
                  >
                    {t("nav.superadminDeleteEmployees")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={actionPending}
                    className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                    onClick={() => setDbResetConfirmOpen(true)}
                  >
                    {t("nav.dbReset")}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border"
                      checked={deleteAllShiftsOnReset}
                      disabled={actionPending}
                      onChange={(event) => setDeleteAllShiftsOnReset(event.target.checked)}
                    />
                    <span>{t("nav.shiftsResetDeleteAllShifts")}</span>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={actionPending}
                    className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                    onClick={() => setShiftsResetConfirmOpen(true)}
                  >
                    {shiftsResetPending ? t("nav.shiftsResetPending") : t("nav.shiftsReset")}
                  </Button>
                </div>
              </div>
            </section>

            <section className="space-y-4 border-t border-border pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t("nav.superadminOrganizationTitle")}
              </p>
              <SuperadminOrganizationSection
                disabled={actionPending}
                onSaveStateChange={({ hasChanges, pending, save }) => {
                  setOrgHasChanges(hasChanges);
                  setOrgSavePending(pending);
                  orgSaveRef.current = save;
                }}
              />
            </section>

            <section className="space-y-4 border-t border-border pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t("nav.superadminEmployeesTitle")}
              </p>
              <SuperadminEmployeesSection disabled={actionPending} />
            </section>
          </>
        ) : activeTab === "shifts" ? (
          <SuperadminShiftsSection disabled={actionPending} />
        ) : (
          <SuperadminTestScenariosSection
            disabled={panelBusy}
            onBusyChange={setScenarioBusy}
          />
        )}
      </PlanningRightSidePanel>
      {nestedOverlayPortal}
    </>
  );
}
