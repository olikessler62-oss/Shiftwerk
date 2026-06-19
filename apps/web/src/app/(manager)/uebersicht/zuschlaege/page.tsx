import { redirect } from "next/navigation";

export default function OverviewSurchargesPage() {
  redirect("/dashboard?uebersichtZuschlaege=1");
}
