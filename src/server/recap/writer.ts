import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { RecapFacts } from "./facts";

export const RECAP_MODEL = "claude-opus-5-5";

/** Default voice for the recap; the admin can replace it from Admin → Recaps. */
export const DEFAULT_TONE = `Write like the funniest, most merciless friend at the bar after league night. Witty and ruthless: roast the ugly holes and blow-up rounds, and hype the good ones just as loudly. Profanity is welcome — these are adults who give each other shit every week, so swear like you mean it when it lands the joke. Keep jokes about the golf (the shots, the scores, the collapses, the luck, the matchups), never about anyone's looks, family, job, health, race, religion, sexuality or anything else personal. Punch at everyone equally over the season; nobody is off limits on the course, including the leader.`;

const SYSTEM_RULES = `You write the weekly recap email for a 9-hole golf league. The app gives you the week's results as JSON facts; the email's standings table and next week's matchups are added by the app below your text, so do not reproduce them as tables.

Judge every golfer against their own game, not against par:
- Each hole has "expected": par plus the handicap strokes that golfer gets there. "vsExpected" and "verdict" say how the hole went for *them*. A high handicapper's bogey where they expect bogey is ordinary — don't mock it. A low handicapper's par on a hard hole deserves praise. A "disaster" is worth roasting no matter who it is.
- "typicalGross" is their recent average; "vsTypical" says whether tonight was better or worse than usual. A 45 can be a career night for one golfer and an embarrassment for another.
- "highlights" and "lowlights" are pre-computed from those numbers. Lead with the most extreme ones.
- Subs are fair game but new to the group — keep it friendly-ruthless. A golfer marked absent with a ghost earned zero points; you can give them hell for not showing up.

Stick to the facts provided. Never invent shots, scores, excuses or events that aren't in the data. Use first names as they appear. If some matches are incomplete, say so briefly.

Structure: a punchy subject line (under 70 characters); a one-line preheader; 3–5 short sections with headings (for example: the match of the night, the hero(es), the wreckage, the standings shake-up, a look ahead at next week's matchups); a short sign-off. Paragraphs are plain text; you may use **bold** for emphasis and nothing else — no markdown headings, lists, links or tables.`;

const RecapSchema = z.object({
  subject: z.string().describe("Email subject line, under 70 characters"),
  preheader: z.string().describe("One-line teaser shown in inbox previews"),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        paragraphs: z.array(z.string()).describe("Plain-text paragraphs; **bold** allowed"),
      }),
    )
    .describe("3 to 5 sections"),
  signoff: z.string().describe("Short closing line"),
});

export type RecapNarrative = z.infer<typeof RecapSchema>;

export class RecapWriterError extends Error {}

export async function writeRecap(facts: RecapFacts, tone: string): Promise<{ narrative: RecapNarrative; model: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new RecapWriterError("ANTHROPIC_API_KEY isn't set, so the recap can't be written.");
  }
  const client = new Anthropic();

  let response;
  try {
    response = await client.beta.messages.parse({
      model: RECAP_MODEL,
      max_tokens: 16000,
      // If a safety classifier declines, retry on Anthropic's recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: betaZodOutputFormat(RecapSchema) },
      system: `${SYSTEM_RULES}\n\nTone:\n${tone.trim() || DEFAULT_TONE}`,
      messages: [
        {
          role: "user",
          content: `Here are this week's facts. Write the recap.\n\n${JSON.stringify(facts, null, 2)}`,
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new RecapWriterError("The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new RecapWriterError("Claude is rate limited right now. Try again in a minute.");
    }
    if (error instanceof Anthropic.APIError) {
      throw new RecapWriterError(`Claude API error ${error.status}: ${error.message}`);
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new RecapWriterError("Claude declined to write this recap. Try softening the tone instructions.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new RecapWriterError("Claude's recap came back incomplete. Try again.");
  }
  return { narrative: response.parsed_output, model: response.model };
}
