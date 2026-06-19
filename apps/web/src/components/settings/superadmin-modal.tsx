"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { resetOrganizationDatabase } from "@/app/actions/db-reset";
import { NotificationOutboxModal } from "@/components/settings/notification-outbox-modal";
import { SuperadminEmployeesSection } from "@/components/settings/superadmin-employees-section";
import { SuperadminOrganizationSection } from "@/components/settings/superadmin-organization-section";
import { SuperadminShiftsSection } from "@/components/settings/superadmin-shifts-section";
import { Alert, Button } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  MODAL_SCROLLBAR_CLASS,
  SETTINGS_MODAL_MAX_WIDTH,
  SETTINGS_MODAL_TITLE_CLASS,
  areaCalendarModalBackdropClass,
  settingsConfirmDialogClass,
  settingsModalBodyPaddingClass,
  settingsModalDialogClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsNestedModalOverlayClass,
} from "@/components/settings/settings-list-ui";

type Props = {
  onClose: () => void;
};

type SuperadminTab = "simulation" | "shifts";

export function SuperadminModal({ onClose }: Props) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<SuperadminTab>("simulation");
  const [notificationOutboxOpen, setNotificationOutboxOpen] = useState(false);
  const [dbResetConfirmOpen, setDbResetConfirmOpen] = useState(false);
  const [dbResetError, setDbResetError] = useState<string | null>(null);
  const [orgHasChanges, setOrgHasChanges] = useState(false);
  const [orgSavePending, setOrgSavePending] = useState(false);
  const orgSaveRef = useRef<() => void>(() => {});
  const [dbResetPending, startDbResetTransition] = useTransition();

  const overlayOpen =
    notificationOutboxOpen || dbResetConfirmOpen || dbResetPending;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || dbResetPending) return;
      if (dbResetConfirmOpen) {
        setDbResetConfirmOpen(false);
        return;
      }
      if (notificationOutboxOpen) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dbResetConfirmOpen, dbResetPending, notificationOutboxOpen, onClose]);

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

  return (
    <div
      className={areaCalendarModalBackdropClass()}
      role="presentation"
      aria-busy={dbResetPending}
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !overlayOpen &&
          !dbResetPending
        ) {
          onClose();
        }
      }}
    >
      <div
        className="relative flex w-full min-w-0 flex-col"
        style={{ maxWidth: SETTINGS_MODAL_MAX_WIDTH }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="superadmin-modal-title"
          aria-hidden={overlayOpen}
          className={cn(
            settingsModalDialogClass(),
            overlayOpen ? "pointer-events-none" : undefined,
            dbResetPending && "[&_*]:cursor-wait"
          )}
        >
          <div
            className={cn("shrink-0 border-b border-border", settingsModalHeaderPaddingClass())}
          >
            <h2 id="superadmin-modal-title" className={SETTINGS_MODAL_TITLE_CLASS}>
              {t("nav.superadmin")}
            </h2>
            <div
              className="mt-3 flex flex-wrap gap-1 border-b border-border"
              role="tablist"
              aria-label={t("nav.superadmin")}
            >
              {(
                [
                  ["simulation", "nav.superadminTabSimulation"],
                  ["shifts", "nav.superadminTabShifts"],
                ] as const
              ).map(([tab, labelKey]) => {
                const selected = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    disabled={dbResetPending}
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
          </div>

          <div
            className={cn(
              settingsModalBodyPaddingClass(),
              MODAL_SCROLLBAR_CLASS,
              "min-h-0 flex-1 space-y-6 overflow-y-auto"
            )}
          >
            {dbResetError ? <Alert variant="error">{dbResetError}</Alert> : null}

            {activeTab === "simulation" ? (
              <>
                <section className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {t("nav.superadminActionsTitle")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={dbResetPending}
                      onClick={() => setNotificationOutboxOpen(true)}
                    >
                      {t("nav.notificationOutbox")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={dbResetPending}
                      className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                      onClick={() => setDbResetConfirmOpen(true)}
                    >
                      {t("nav.dbReset")}
                    </Button>
                  </div>
                </section>

                <section className="space-y-4 border-t border-border pt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {t("nav.superadminOrganizationTitle")}
                  </p>
                  <SuperadminOrganizationSection
                    disabled={dbResetPending}
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
                  <SuperadminEmployeesSection disabled={dbResetPending} />
                </section>
              </>
            ) : (
              <SuperadminShiftsSection disabled={dbResetPending} />
            )}
          </div>

          <div className={settingsModalFooterClass()}>
            <Button type="button" variant="outline" disabled={dbResetPending} onClick={onClose}>
              {t("common.close")}
            </Button>
            {activeTab === "simulation" ? (
              <Button
                type="button"
                disabled={dbResetPending || orgSavePending || !orgHasChanges}
                onClick={() => orgSaveRef.current()}
              >
                {t("common.save")}
              </Button>
            ) : null}
          </div>
        </div>

        {notificationOutboxOpen ? (
          <NotificationOutboxModal onClose={() => setNotificationOutboxOpen(false)} />
        ) : null}

        {dbResetConfirmOpen ? (
          <div
            className={settingsNestedModalOverlayClass()}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !dbResetPending) {
                setDbResetConfirmOpen(false);
              }
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="superadmin-db-reset-title"
              className={settingsConfirmDialogClass()}
              onMouseDown={(event) => event.stopPropagation()}
            >
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
                  disabled={dbResetPending}
                  onClick={() => setDbResetConfirmOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={dbResetPending}
                  onClick={handleDbResetConfirm}
                >
                  {dbResetPending ? t("nav.dbResetPending") : t("nav.dbReset")}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
