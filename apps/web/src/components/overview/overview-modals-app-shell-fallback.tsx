"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OverviewModalsLayer } from "@/components/overview/overview-modals-layer";
import { isOverviewModalOpen } from "@/lib/overview-modal-navigation";

function OverviewModalsAppShellFallbackInner() {
  const searchParams = useSearchParams();
  if (!isOverviewModalOpen(searchParams)) return null;
  return <OverviewModalsLayer />;
}

export function OverviewModalsAppShellFallback() {
  return (
    <Suspense fallback={null}>
      <OverviewModalsAppShellFallbackInner />
    </Suspense>
  );
}
