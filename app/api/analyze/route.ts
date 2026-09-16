import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { AnalysisSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_PROMPT = `You are a careful nutritionist estimating calories and macros from a single photo of a meal.

Context about the user: they are currently living in Vietnam, so Vietnamese dishes (phở, bún chả, bánh mì, cơm tấm, bún bò Huế, gỏi cuốn, bánh xèo, cà phê sữa đá, and so on) are common. Recognise them by name when you see them and use typical Vietnamese restaurant portion sizes as your baseline. Western and other cuisines appear too; treat the photo on its merits.

How to estimate:
- List every distinct food and drink you can see as its own item. Include sauces, oils, sugar in drinks, rice, and bread; these are where most hidden calories live.
- Judge portion size from visual cues: plate or bowl diameter, chopsticks, spoons, hands, cans, and how full the vessel is. State the cue you used in the portion field.
- When you cannot tell (for example broth that may or may not contain fat, or a drink that may be sweetened), estimate the more common preparation and say what you assumed in the notes.
- If the user supplied a note, treat it as the most reliable information. It can name the dish, correct the portion, or say what was already eaten.
- If the user says only part of the meal was eaten, estimate only what was consumed.
- total_calories must equal the sum of the item calories.
- Confidence is "high" only when the dish and portion are both clear.

The photo may not contain food at all. If so, return an empty items list, zero calories, "low" confidence, and explain in the notes.`;

const client = new Anthropic();

interface AnalyzeBody {
  image?: string; // data URL
  note?: string;
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

  let body: AnalyzeBody;
  try {
    body = (await req.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const image = body.image ? parseDataUrl(body.image) : null;
  if (!image) {
    return NextResponse.json(
      { error: "Send a JPEG, PNG, WebP or GIF as a base64 data URL in `image`." },
      { status: 400 },
    );
  }

  const note = (body.note ?? "").trim();
  const userText = note
    ? `Estimate the calories and macros for this meal. Note from me: ${note}`
    : "Estimate the calories and macros for this meal.";

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: image.mediaType, data: image.data },
            },
            { type: "text", text: userText },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(AnalysisSchema) },
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "The model declined to analyze this image." },
        { status: 422 },
      );
    }
    if (response.stop_reason === "max_tokens") {
      return NextResponse.json(
        { error: "The analysis was cut off. Try again." },
        { status: 502 },
      );
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const parsed = AnalysisSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      console.error("Analysis did not match schema", parsed.error);
      return NextResponse.json(
        { error: "The analysis came back in an unexpected shape. Try again." },
        { status: 502 },
      );
    }

    const analysis = parsed.data;
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
      return NextResponse.json({ error: `Anthropic API error (${err.status}).` }, { status: 502 });
    }
    console.error("Unexpected error in /api/analyze", err);
    return NextResponse.json({ error: "Something went wrong analyzing the photo." }, { status: 500 });
  }
}
