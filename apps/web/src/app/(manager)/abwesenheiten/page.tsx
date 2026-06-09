import { redirect } from "next/navigation";

export default function AbwesenheitenPage() {
  redirect("/dashboard?abwesenheiten=1");
}
