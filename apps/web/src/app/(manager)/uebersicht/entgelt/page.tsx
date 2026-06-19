import { redirect } from "next/navigation";

export default function OverviewCompensationPage() {
  redirect("/dashboard?uebersichtEntgelt=1");
}
