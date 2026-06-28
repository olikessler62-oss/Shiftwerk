"use client";

import { useState } from "react";

interface Props {
  employees: { full_name: string }[];
  shifts: unknown[];
  weekStart: string;
}

export function DashboardAiSuggestion({ employees, shifts, weekStart }: Props) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestion = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/shift-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employees, shifts, weekStart }),
      });
      const data = await res.json();
      setSuggestion(data.suggestion);
    } catch {
      setError("KI-Analyse konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      bottom: "24px",
      right: "24px",
      zIndex: 1000,
      background: "white",
      borderRadius: "5px",
      padding: "16px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
      maxWidth: "340px",
      width: "100%",
    }}>
      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px" }}>
        KI-Schichtanalyse
      </h3>

      {!suggestion && !loading && (
        <button
          onClick={fetchSuggestion}
          style={{
            background: "#6366f1",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Analyse starten
        </button>
      )}

      {loading && (
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          KI analysiert Schichtplan...
        </p>
      )}

      {error && (
        <p style={{ color: "#ef4444", fontSize: "14px" }}>{error}</p>
      )}

      {suggestion && (
        <div>
          <p style={{ color: "#374151", fontSize: "14px", lineHeight: "1.6" }}>
            {suggestion}
          </p>
          <button
            onClick={fetchSuggestion}
            style={{
              marginTop: "12px",
              background: "transparent",
              color: "#6366f1",
              border: "1px solid #6366f1",
              borderRadius: "6px",
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Neu analysieren
          </button>
        </div>
      )}
    </div>
  );
}
