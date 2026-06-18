"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { fetchSettingsModalsData } from "@/app/actions/settings-modals-data";
import type { SettingsModalsData } from "@/app/actions/settings-modals-data";
import { SettingsModalsLayer } from "@/components/settings/settings-modals-layer";
import { SETTINGS_MODALS_ON_CURRENT_PAGE } from "@/lib/settings-modal-config";
import { isSettingsModalOpen } from "@/lib/settings-modal-navigation";
import { useClearMainNavPendingOptional } from "@/lib/app-shell-main-nav-pending";

const PAGE_HOSTED_SETTINGS_PATHS = ["/dashboard", "/planer"] as const;

function SettingsModalsAppShellFallbackInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<SettingsModalsData | null>(null);
  const [loading, setLoading] = useState(false);
  const clearMainNavPending = useClearMainNavPendingOptional();

  const modalOpen = isSettingsModalOpen(searchParams);
  const pageHostsModals = PAGE_HOSTED_SETTINGS_PATHS.includes(
    pathname as (typeof PAGE_HOSTED_SETTINGS_PATHS)[number]
  );

  useEffect(() => {
    if (
      !SETTINGS_MODALS_ON_CURRENT_PAGE ||
      pageHostsModals ||
      !modalOpen
    ) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchSettingsModalsData({
      locationParam: searchParams.get("location"),
      weekStart: searchParams.get("week"),
    }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setData(result.data);
      } else {
        setData(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [modalOpen, pageHostsModals, pathname, searchParams]);

  useEffect(() => {
    if (data && modalOpen && !pageHostsModals) {
      clearMainNavPending();
    }
  }, [data, modalOpen, pageHostsModals, clearMainNavPending]);

  if (
    !SETTINGS_MODALS_ON_CURRENT_PAGE ||
    pageHostsModals ||
    !modalOpen ||
    loading ||
    !data
  ) {
    return null;
  }

  return <SettingsModalsLayer data={data} />;
}

export function SettingsModalsAppShellFallback() {
  if (!SETTINGS_MODALS_ON_CURRENT_PAGE) return null;

  return (
    <Suspense fallback={null}>
      <SettingsModalsAppShellFallbackInner />
    </Suspense>
  );
}
