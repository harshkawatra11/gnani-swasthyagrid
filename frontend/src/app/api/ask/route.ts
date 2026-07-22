import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  facilities,
  recommendations,
  alerts,
  footfallForecast,
  causalChain,
  districtKpis,
} from "@/data/district";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are the "Ask SwasthyaGrid" assistant inside SwasthyaGrid AI,
a district health operations control room for PHCs and CHCs.

Rules:
- Only state facts grounded in the DISTRICT DATA provided below. Never fabricate
  numbers, facility names, or statistics beyond what's given.
- Whenever you cite a forecast or prediction, mention its confidence score.
- You are read-only: you explain data and reasoning, you never claim to have
  executed a transfer, approval, or any other action. Recommendations always
  require a human administrator's approval.
- Keep answers concise (2-4 sentences), in the voice of a calm, precise
  operations analyst.`;

const FALLBACK_MESSAGE =
  "Ask SwasthyaGrid is unavailable right now — no GEMINI_API_KEY is configured " +
  "for this deployment. The rest of the dashboard works independently of this feature.";

function buildDataContext() {
  return JSON.stringify({
    facilities: facilities.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      riskLevel: f.riskLevel,
      performance: f.performance,
    })),
    recommendations,
    alerts,
    footfallForecast,
    causalChain,
    districtKpis,
  });
}

export async function POST(request: Request) {
  const { message } = (await request.json()) as { message?: string };

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: FALLBACK_MESSAGE }, { status: 503 });
  }

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const prompt = `DISTRICT DATA (JSON):\n${buildDataContext()}\n\nQuestion: ${message}`;
    const result = await genAI.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
      config: { systemInstruction: SYSTEM_PROMPT },
    });
    const answer = result.text;

    return NextResponse.json({ answer, confidence: 90 });
  } catch (error) {
    console.error("Gemini ask route failed", error);
    return NextResponse.json({ answer: FALLBACK_MESSAGE, confidence: null });
  }
}
