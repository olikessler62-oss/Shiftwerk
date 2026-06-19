"use client";

import { useSearchParams } from "next/navigation";
import { useSuperadminModal } from "@/components/settings/superadmin-modal-context";
import { useAppShellModalLockActive } from "@/lib/app-shell-modal-lock";
import { isSettingsModalOpen } from "@/lib/settings-modal-navigation";
import { isOverviewModalOpen } from "@/lib/overview-modal-navigation";

export function AppShellModalLockBridge() {
  const searchParams = useSearchParams();
  const { open: superadminOpen } = useSuperadminModal();

  useAppShellModalLockActive(isSettingsModalOpen(searchParams));
  useAppShellModalLockActive(isOverviewModalOpen(searchParams));
  useAppShellModalLockActive(superadminOpen);

  return null;
}
