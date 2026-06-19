import { redirect } from "next/navigation";

export default function OverviewShiftPreferencesPage() {
  redirect("/dashboard?uebersichtWuensche=1");
}
