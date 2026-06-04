export default function AbwesenheitenPage() {
  return (
    <Placeholder
      title="Abwesenheiten"
      description="Urlaub und Krankmeldungen mit Freigabe-Workflow."
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
