import { PlanningPageContentLoading } from "@/components/planning/planning-page-content-loading";

/** Hält den Planungs-Content-Bereich während RSC-Load gefüllt (kein Brand-Backdrop-Flash). */
export function DashboardPageLoadingFill() {
  return (
    <PlanningPageContentLoading
      showSkeleton={false}
      className="bg-background"
    />
  );
}
