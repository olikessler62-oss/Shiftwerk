import { redirect } from "next/navigation";

export default function OverviewQualificationsPage() {
  redirect("/dashboard?uebersichtTaetigkeiten=1");
}
