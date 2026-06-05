"use server";

import { redirect } from "next/navigation";
import { getDatabase } from "@/lib/db";

export async function signOut() {
  const db = await getDatabase();
  await db.authSignOut();
  redirect("/login");
}
