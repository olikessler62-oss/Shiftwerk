import { redirect } from "next/navigation";

export default function OverviewCompensationSurchargesPage() {
  redirect("/dashboard?uebersichtEntgelt=1");
}
