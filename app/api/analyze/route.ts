import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { AnalysisSchema, AnalyzeRequestSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_PROMPT = `You are a careful nutritionist estimating calories and macros for a meal, from a photo, a written description, or both.

Context about the user: they are currently living in Vietnam, so Vietnamese dishes (phở, bún chả, bánh mì, cơm tấm, bún bò Huế, gỏi cuốn, bánh xèo, cà phê sữa đá, and so on) are common. Recognise them by name when you see them and use typical Vietnamese restaurant portion sizes as your baseline. Western and other cuisines appear too; treat the photo on its merits.

How to estimate:
- List every distinct food and drink you can see as its own item. Include sauces, oils, sugar in drinks, rice, and bread; these are where most hidden calories live.
- Judge portion size from visual cues: plate or bowl diameter, chopsticks, spoons, hands, cans, and how full the vessel is. State the cue you used in the portion field.
- When you cannot tell (for example broth that may or may not contain fat, or a drink that may be sweetened), estimate the more common preparation and say what you assumed in the notes.
- If the user supplied a note, treat it as the most reliable information. It can name the dish, correct the portion, or say what was already eaten.
- If the user says only part of the meal was eaten, estimate only what was consumed.
- total_calories must equal the sum of the item calories.
- Confidence is "high" only when the dish and portion are both clear.

When there is no photo, estimate from the description alone using typical portions for each dish, and say in the notes which portion you assumed.

The photo may not contain food at all. If so, return an empty items list, zero calories, "low" confidence, and explain in the notes.`;

const client = new Anthropic();

// Sonnet 5 reads photos well at a fraction of Opus pricing. Override with
// ANALYSIS_MODEL=claude-haiku-4-5 (cheaper) or claude-opus-5 (most accurate).
const MODEL = process.env.ANALYSIS_MODEL || "claude-sonnet-5";

// ---- Access control.
// A shared password (APP_PASSWORD) must accompany every request in production,
// and each client IP gets a small hourly budget. This is a single-user app, so
// that is enough to stop a leaked URL from spending the Anthropic quota.
const RATE_LIMIT = Number(process.env.ANALYZE_RATE_LIMIT || 40); // requests per hour per IP
const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorize(req: Request): NextResponse | null {
  const expected = process.env.APP_PASSWORD ?? "";
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "APP_PASSWORD is not set on the server. Set it before using the app in production." },
        { status: 500 },
      );
    }
    return null; // local dev without a password
  }
  const supplied = req.headers.get("x-app-key") ?? "";
  if (!timingSafeEqual(supplied, expected)) {
    return NextResponse.json(
      { error: "Wrong or missing app password. Set it on the Settings tab." },
      { status: 401 },
    );
  }
  return null;
}

function parseDataUrl(dataUrl: string): { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string } | null {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mediaType: m[1] as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: m[2] };
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on the server." },
      { status: 500 },
    );
  }

  const denied = authorize(req);
  if (denied) return denied;

  if (rateLimited(clientIp(req))) {
    return NextResponse.json(
      { error: `Too many analyses this hour (limit ${RATE_LIMIT}). Try again later.` },
      { status: 429 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsedBody = AnalyzeRequestSchema.safeParse(raw);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Body must be { image?: string (data URL), note?: string }." },
      { status: 400 },
    );
  }
  const body = parsedBody.data;

  const note = (body.note ?? "").trim();
  const image = body.image ? parseDataUrl(body.image) : null;
  if (body.image && !image) {
    return NextResponse.json(
      { error: "Send a JPEG, PNG, WebP or GIF as a base64 data URL in `image`." },
      { status: 400 },
    );
  }
  if (!image && !note) {
    return NextResponse.json({ error: "Send a photo, a description, or both." }, { status: 400 });
  }

  const userText = image
    ? note
      ? `Estimate the calories and macros for this meal. Note from me: ${note}`
      : "Estimate the calories and macros for this meal."
    : `Estimate the calories and macros for this meal from my description: ${note}`;

  const content: Anthropic.ContentBlockParam[] = [];
  if (image) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.data },
    });
  }
  content.push({ type: "text", text: userText });

  try {
    const response = await client.messages.parse({
      model: MODEL,
      // Sonnet 5 thinks before it answers and that thinking counts against
      // max_tokens, so a small cap truncates the JSON and the request fails.
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      output_config: { format: zodOutputFormat(AnalysisSchema) },
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "The model declined to analyze this image." },
        { status: 422 },
      );
    }
    if (response.stop_reason === "max_tokens") {
      console.error("Analysis hit max_tokens", response.usage);
      return NextResponse.json(
        { error: "The analysis ran out of room before finishing. Try again, or add a short note describing the meal." },
        { status: 502 },
      );
    }

    const analysis = response.parsed_output;
    if (!analysis) {
      console.error("Analysis did not match schema");
      return NextResponse.json(
        { error: "The analysis came back in an unexpected shape. Try again." },
        { status: 502 },
      );
    }

    // Trust the items, not the model's arithmetic.
    analysis.total_calories = Math.round(
      analysis.items.reduce((s, i) => s + i.calories, 0),
    );

    return NextResponse.json({ analysis, model: response.model });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Anthropic API key was rejected." }, { status: 500 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limited. Try again in a minute." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error", err.status, err.message);
      // Surface the API's own message: it names the real cause (bad model id,
      // oversized image, missing feature) instead of a bare status code.
      return NextResponse.json(
        { error: `Anthropic API error (${err.status}): ${err.message}` },
        { status: 502 },
      );
    }
    console.error("Unexpected error in /api/analyze", err);
    return NextResponse.json({ error: "Something went wrong analyzing the photo." }, { status: 500 });
  }
}
