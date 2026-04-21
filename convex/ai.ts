import { action } from "./_generated/server";
import { v } from "convex/values";

export const generateMetadata = action({
  args: { transcript: v.string() },
  handler: async (_ctx, { transcript }) => {
    if (!transcript.trim()) {
      return { title: "Untitled Recording", description: "" };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set. Run: npx convex env set ANTHROPIC_API_KEY sk-ant-...");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: `Given this voice recording transcript, return a JSON object with:
- "title": a short title (5–8 words max)
- "description": one sentence summarising what was said

Return ONLY the raw JSON object, no markdown, no code fences.

Transcript: ${transcript.slice(0, 3000)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const raw: string = data.content?.[0]?.text ?? "";

    // Strip markdown fences if Claude wrapped it anyway
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    try {
      const parsed = JSON.parse(cleaned);
      return {
        title: String(parsed.title ?? "Untitled Recording"),
        description: String(parsed.description ?? ""),
      };
    } catch {
      // Last resort: try to extract with regex
      const titleMatch = cleaned.match(/"title"\s*:\s*"([^"]+)"/);
      const descMatch = cleaned.match(/"description"\s*:\s*"([^"]+)"/);
      return {
        title: titleMatch?.[1] ?? "Untitled Recording",
        description: descMatch?.[1] ?? "",
      };
    }
  },
});
