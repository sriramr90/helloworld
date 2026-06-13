// The editorial brain: Claude reads the prefiltered candidates and selects the
// genuinely uplifting ones, writes a warm one-line summary and a fresh
// headline, and files each into a section. This is the "Claude curation" half
// of the hybrid approach.
//
// If ANTHROPIC_API_KEY is absent, callers fall back to the local ranking — this
// module is only invoked when a key is present.
import Anthropic from "@anthropic-ai/sdk";

export const SECTIONS = [
  "World",
  "Science & Health",
  "Environment",
  "Community & Kindness",
  "Culture & Sport",
];

const SYSTEM = `You are the editor of "goodvibe", a beloved morning newspaper that prints ONLY genuinely positive, uplifting news. Your readers open it with their coffee to start the day feeling hopeful.

Your standards are high and specific:
- Select only stories that are truly heartening — a breakthrough, a rescue, an act of kindness, a recovery, a milestone, real progress. "Not negative" is NOT enough; the story must actively lift the reader.
- Reject anything dark, tragic, fear-driven, politically inflammatory, or only superficially positive (e.g. a stock going up, a celebrity feud framed as "winning").
- Reject clickbait and stories where the headline alone can't be trusted to be positive.
- For each selected story write: a warm, human one-line summary (max ~30 words) and a clean, dignified headline (no ALL CAPS, no clickbait).
- File each story into exactly one section.
- Quality over quantity: pick the best 10–18 stories. A short, excellent edition beats a padded one.`;

const SCHEMA = {
  type: "object",
  properties: {
    stories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "The exact id of the candidate you are selecting" },
          headline: { type: "string" },
          summary: { type: "string" },
          section: { type: "string", enum: SECTIONS },
          positivity: { type: "number", description: "0 to 1, how uplifting the story is" },
        },
        required: ["id", "headline", "summary", "section", "positivity"],
        additionalProperties: false,
      },
    },
  },
  required: ["stories"],
  additionalProperties: false,
};

export async function curate(candidates) {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

  const catalogue = candidates
    .map((c) => `id: ${c.id}\ntitle: ${c.title}\nsource: ${c.source}\nblurb: ${c.description || "(none)"}`)
    .join("\n\n");

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Here are today's candidate stories from across the world. Curate tomorrow morning's edition.\n\n${catalogue}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Curation refused: " + (response.stop_details?.explanation || "unknown"));
  }

  const text = response.content.find((b) => b.type === "text")?.text || "{}";
  const parsed = JSON.parse(text);
  const byId = new Map(candidates.map((c) => [c.id, c]));

  // Join the editor's picks back to the original candidate metadata (url, image…).
  return (parsed.stories || [])
    .map((pick) => {
      const original = byId.get(pick.id);
      if (!original) return null;
      return {
        headline: pick.headline || original.title,
        summary: pick.summary || original.description,
        section: SECTIONS.includes(pick.section) ? pick.section : "World",
        positivity: typeof pick.positivity === "number" ? pick.positivity : 0.5,
        url: original.url,
        image: original.image,
        source: original.source,
        publishedAt: original.publishedAt,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.positivity - a.positivity);
}
