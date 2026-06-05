import { redirect } from "next/navigation";
import { getDatabase } from "@/lib/db";

export default async function HomePage() {
  const db = await getDatabase();
  const user = await db.authGetUser();

  if (!user) {
    redirect("/login");
  }

  const role = await db.getProfileRole(user.id);

  if (role === "basic") {
    redirect("/app-only");
  }

  redirect("/dashboard");
}
