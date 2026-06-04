import { redirect } from "next/navigation";

/** Legacy-Route: Dashboard ohne Schichtarten-Modal */
export default async function EinstellungenPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  if (week) {
    redirect(`/dashboard?week=${week}`);
  }
  redirect("/dashboard");
}
