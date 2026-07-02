"use client";

import { useMemo, useState } from "react";
import { SettingsMessageModal } from "@/components/settings/settings-message-modal";
import { ChatBubbleIcon, IconButton, Tooltip } from "@/components/ui";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";
import type { CancellationReasonShiftContext } from "@/lib/cancellation-reason-shift-context";
import { formatDayHeader } from "@/lib/planning-utils";

type Props = {
  reason: string;
  employeeName?: string;
  shiftContext?: CancellationReasonShiftContext;
  className?: string;
  modalPlacement?: "fixed" | "nested";
  messageKind?: "cancellation" | "rejection";
};

function formatCancellationReasonShiftLabel(
  shiftContext: CancellationReasonShiftContext,
  intlLocale: string
): string {
  const { weekday, label } = formatDayHeader(
    shiftContext.shiftDate,
    intlLocale,
    "long"
  );
  const parts = [`${weekday}, ${label}`];

  const templateName = shiftContext.shiftTemplateName?.trim();
  if (templateName) {
    parts.push(templateName);
  }

  if (shiftContext.startTime && shiftContext.endTime) {
    parts.push(`${shiftContext.startTime} - ${shiftContext.endTime}`);
  }

  return parts.join(" · ");
}

export function CancellationReasonViewButton({
  reason,
  employeeName,
  shiftContext,
  className,
  modalPlacement = "fixed",
  messageKind = "cancellation",
}: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const intlLocale = toIntlLocale(locale);
  const [open, setOpen] = useState(false);
  const trimmed = reason.trim();
  const tooltipLabel =
    messageKind === "rejection"
      ? t("shiftConfirmation.hub.rejectionReasonIconLabel")
      : t("shiftConfirmation.hub.cancellationReasonIconLabel");
  const modalTitle =
    messageKind === "rejection"
      ? t("shiftConfirmation.hub.rejectionReasonModalTitle")
      : t("shiftConfirmation.hub.cancellationReasonModalTitle");
  const buttonToneClass =
    messageKind === "rejection"
      ? "text-red-800 hover:bg-red-50 hover:text-red-900"
      : "text-orange-800 hover:bg-orange-50 hover:text-orange-900";
  const resolvedEmployeeName = employeeName?.trim();
  const shiftLabel = shiftContext
    ? formatCancellationReasonShiftLabel(shiftContext, intlLocale)
    : undefined;

  const subtitle = useMemo(() => {
    if (!resolvedEmployeeName && !shiftLabel) return undefined;
    return (
      <div className="mt-1 space-y-0.5 text-xs leading-snug text-foreground">
        {resolvedEmployeeName ? <p>{resolvedEmployeeName}</p> : null}
        {shiftLabel ? <p>{shiftLabel}</p> : null}
      </div>
    );
  }, [resolvedEmployeeName, shiftLabel]);

  if (!trimmed) return null;

  return (
    <>
      <Tooltip content={tooltipLabel}>
        <IconButton
          type="button"
          size="sm"
          aria-label={tooltipLabel}
          className={cn("shrink-0", buttonToneClass, className)}
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            setOpen(true);
          }}
        >
          <ChatBubbleIcon className="h-4 w-4" />
        </IconButton>
      </Tooltip>
      {open ? (
        <SettingsMessageModal
          placement={modalPlacement}
          title={modalTitle}
          subtitle={subtitle}
          message={trimmed}
          messageClassName="whitespace-pre-wrap break-words"
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
