import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  const { employees, shifts, weekStart } = await req.json();

  const employeeList = employees
    .map((e: { full_name: string }) => e.full_name)
    .join(", ");

  const shiftCount = shifts.length;

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
