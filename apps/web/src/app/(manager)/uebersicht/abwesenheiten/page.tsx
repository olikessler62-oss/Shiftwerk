import { redirect } from "next/navigation";

export default function UebersichtAbwesenheitenPage() {
  redirect("/dashboard?uebersichtAbwesenheiten=1");
}
