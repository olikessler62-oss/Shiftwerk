import { ManagerAppShellGate } from "@/app/(manager)/manager-app-shell-gate";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ManagerAppShellGate>{children}</ManagerAppShellGate>;
}
