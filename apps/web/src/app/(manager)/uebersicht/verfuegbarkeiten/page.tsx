import { redirect } from "next/navigation";

export default function UebersichtVerfuegbarkeitenPage() {
  redirect("/dashboard?uebersichtVerfuegbarkeiten=1");
}
