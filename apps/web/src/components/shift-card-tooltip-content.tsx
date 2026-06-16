"use client";

import { useTranslations } from "@/i18n/locale-provider";
import type { ShiftCardTooltipData } from "@/lib/shift-card-display-content";

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
      ) : shiftNameWithoutTemplate ? (
        <div>{shiftNameWithoutTemplate}</div>
      ) : null}
      {timeLabel ? <div>{timeLabel}</div> : null}
      {jobsLabel ? (
        <div>
          {t("common.shiftCardTooltipJobLabel")}{" "}
          <span className="font-bold">{jobsLabel}</span>
        </div>
      ) : null}
      {confirmationStatusLine ? (
        <div>
          {t("common.shiftCardTooltipStatusLabel")}{" "}
          <span className="font-bold">{confirmationStatusLine}</span>
        </div>
      ) : null}
    </div>
  );
}
