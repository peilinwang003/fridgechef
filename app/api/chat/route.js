import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env automatically

export async function POST(request) {
  try {
    const { prompt, system, max_tokens = 2000 } = await request.json();

    if (!prompt) {
      return Response.json({ error: "Missing prompt" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    return Response.json({ text });
  } catch (err) {
    console.error("Anthropic API error:", err);
    return Response.json({ error: "AI request failed" }, { status: 500 });
  }
}
