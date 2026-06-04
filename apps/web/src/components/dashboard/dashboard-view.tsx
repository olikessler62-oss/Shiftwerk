"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ShiftTypeWithBreaks } from "@schichtwerk/types";
import { ShiftTypesModal } from "@/components/settings/shift-types-modal";
import { DashboardHeader } from "./dashboard-header";
import {
  DashboardCalendar,
  type DashboardShiftCard,
} from "./dashboard-calendar";

type Props = {
  weekStart: string;
  dates: string[];
  orgName: string;
  shifts: DashboardShiftCard[];
  shiftTypes: ShiftTypeWithBreaks[];
};

export function DashboardView({
  weekStart,
  dates,
  orgName,
  shifts,
  shiftTypes,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showShiftTypes = searchParams.get("schichtarten") === "1";

  function closeShiftTypes() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("schichtarten");
    const q = params.toString();
    router.push(q ? `/dashboard?${q}` : "/dashboard");
  }

  return (
    <div className="-m-6 flex min-h-screen flex-col bg-background">
      <DashboardHeader weekStart={weekStart} />
      <section className="relative flex-1 overflow-auto p-4">
        <DashboardCalendar dates={dates} orgName={orgName} shifts={shifts} />
        {showShiftTypes && (
          <ShiftTypesModal shiftTypes={shiftTypes} onClose={closeShiftTypes} />
        )}
      </section>
    </div>
  );
}
