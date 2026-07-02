import { Suspense } from "react";
import { ManagerAppShellGate } from "@/app/(manager)/manager-app-shell-gate";
import { ManagerRouteLoading } from "@/components/planning/manager-route-loading";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<ManagerRouteLoading />}>
      <ManagerAppShellGate>{children}</ManagerAppShellGate>
    </Suspense>
  );
}
