"use client";

import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { shiftConfirmationCardStatusTextClass } from "@/lib/shift-confirmation-display";
import {
  shiftCardTooltipShowsDeploymentTimeLabel,
  type ShiftCardTooltipData,
} from "@/lib/shift-card-display-content";

type Props = {
  data: ShiftCardTooltipData;
};

export function ShiftCardTooltipContent({ data }: Props) {
  const t = useTranslations();
  const employeeName = data.employeeName?.trim();
  const shiftTemplateName = data.shiftTemplateName?.trim();
  const shiftNameWithoutTemplate = data.shiftNameWithoutTemplate?.trim();
  const timeLabel = data.timeLabel?.trim();
  const jobsLabel = data.jobsLabel?.trim();
  const confirmationStatusLine = data.confirmationStatusLine?.trim();
  const showDeploymentTimeLabel = shiftCardTooltipShowsDeploymentTimeLabel(data);

  return (
    <div className="flex flex-col gap-0.5">
      {employeeName ? (
        <div>
          <span className="font-bold">{employeeName}</span>
        </div>
      ) : null}
      {shiftTemplateName ? (
        <div>
          {t("common.shiftCardTooltipShiftLabel")}{" "}
          <span className="font-bold">{shiftTemplateName}</span>
        </div>
      ) : showDeploymentTimeLabel ? (
        <div>{t("common.shiftCardTooltipDeploymentTimeLabel")}</div>
      ) : shiftNameWithoutTemplate ? (
        <div>{shiftNameWithoutTemplate}</div>
      ) : null}
      {timeLabel ? (
        <div>
          {showDeploymentTimeLabel ? (
            <span className="font-bold">{timeLabel}</span>
          ) : (
            timeLabel
          )}
        </div>
      ) : null}
      {jobsLabel ? (
        <div>
          {t("common.shiftCardTooltipJobLabel")}{" "}
          <span className="font-bold">{jobsLabel}</span>
        </div>
      ) : null}
      {confirmationStatusLine ? (
        <div>
          {t("common.shiftCardTooltipStatusLabel")}{" "}
          <span
            className={cn(
              "font-bold",
              shiftConfirmationCardStatusTextClass(
                data.confirmationStatus,
                data.isPastShift ?? false
              )
            )}
          >
            {confirmationStatusLine}
          </span>
        </div>
      ) : null}
    </div>
  );
}
