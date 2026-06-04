export default function BerichtePage() {
  return (
    <Placeholder
      title="Berichte"
      description="Stundenübersicht und Export für die Lohnabrechnung."
    />
  );
}

function Placeholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </div>
  );
}
