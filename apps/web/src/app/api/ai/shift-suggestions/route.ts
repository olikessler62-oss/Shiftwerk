import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { getManagerSession } from "@/lib/server-manager-session";

const MAX_EMPLOYEES = 100;
const MAX_NAME_LENGTH = 80;

function sanitizeEmployeeNames(employees: unknown): string[] {
  if (!Array.isArray(employees)) return [];
  return employees
    .slice(0, MAX_EMPLOYEES)
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const name = (entry as { full_name?: unknown }).full_name;
      if (typeof name !== "string") return [];
      const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
      return trimmed ? [trimmed] : [];
    });
}

export async function POST(req: Request) {
  const session = await getManagerSession();
  if (!session) {
    return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  if (!process.env.GROQ_API_KEY) {
    return Response.json(
      { error: "KI-Analyse ist nicht konfiguriert." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const employeeNames = sanitizeEmployeeNames(payload.employees);
  const shiftCount = Array.isArray(payload.shifts) ? payload.shifts.length : 0;
  const weekStart =
    typeof payload.weekStart === "string"
      ? payload.weekStart.trim().slice(0, 32)
      : "";

  const groq = createGroq({
    apiKey: process.env.GROQ_API_KEY,
  });

  const employeeList =
    employeeNames.length > 0 ? employeeNames.join(", ") : "keine";

  const { text } = await generateText({
    model: groq("llama-3.3-70b-versatile"),
    prompt: `Du bist ein Schichtplanungs-Assistent.

Woche: ${weekStart}
Mitarbeiter: ${employeeList}
Anzahl geplanter Schichten: ${shiftCount}

Gib eine kurze Analyse (3-4 Sätze) der Schichtsituation und einen konkreten Verbesserungsvorschlag.
Antworte auf Deutsch.`,
  });

  return Response.json({ suggestion: text });
}
