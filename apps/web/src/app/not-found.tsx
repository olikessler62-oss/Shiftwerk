import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-semibold">Seite nicht gefunden</h1>
      <Link href="/dashboard" className="mt-4 text-sm text-primary">
        Zum Dashboard
      </Link>
    </div>
  );
}
