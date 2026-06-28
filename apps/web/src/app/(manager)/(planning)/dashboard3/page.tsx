import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy route — Dashboard 3 ist jetzt das Haupt-Dashboard unter /dashboard. */
export default async function Dashboard3RedirectPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    location?: string;
    area?: string;
  }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }

  const qs = query.toString();
  redirect(qs ? `/dashboard?${qs}` : "/dashboard");
}
