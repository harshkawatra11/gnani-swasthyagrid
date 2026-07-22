import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const CITIZEN_SYSTEM_PROMPT = `You are the SwasthyaGrid Citizen Assistant — a helpful, compassionate AI 
built for patients and citizens accessing Primary Health Centres (PHCs) in India.

Rules:
- If the user describes a life-threatening emergency (chest pain, difficulty breathing, snake bite, 
  road accident, unconsciousness), ALWAYS start your response with "🚨 EMERGENCY — Call 108 immediately!"
- Provide clear, simple first-aid guidance in plain language anyone can understand.
- If the user asks about the nearest hospital or PHC, ask them to share their coordinates (latitude, longitude)
  and then suggest they search on Google Maps for "PHC near me" or "government hospital near me".
- Keep answers concise and actionable. Be warm and calm.
- Do NOT fabricate specific medicine stock levels, doctor schedules, or bed availability — you don't have 
  access to live facility data. Direct users to call 104 (State Health Helpline) for that.
- Helplines to remember: 108 (Ambulance), 112 (Emergency), 104 (Health Helpline), 1800-11-6117 (Poison Control).`;

const FALLBACK_MESSAGE =
  "Citizen Services are currently unavailable — the AI assistant is not configured for this deployment. " +
  "For medical emergencies please call 108. For health queries call 104.";

export async function POST(request: Request) {
  const { message } = (await request.json()) as { message?: string };

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ answer: FALLBACK_MESSAGE, confidence: null });
  }

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const result = await genAI.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: message,
      config: { systemInstruction: CITIZEN_SYSTEM_PROMPT },
    });

    return NextResponse.json({ answer: result.text, confidence: 90 });
  } catch (error) {
    console.error("Citizen Gemini route failed", error);
    return NextResponse.json({ answer: FALLBACK_MESSAGE, confidence: null });
  }
}
