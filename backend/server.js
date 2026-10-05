import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
app.post("/api/evaluate-shorts-intent", async (req, res) => {
  const { userInput, platform } = req.body;

  if (!userInput || userInput.trim().length === 0) {
    return res.json({
      verdict: "IMPULSIVE",
      reason: "No concrete intention provided. Endless feeds require active intent.",
      passMinutes: 0
    });
  }

  // Combined instructions and user intent into one single prompt
  const fullPrompt = `You are an AI attention guardian helping a student avoid short-form video dopamine loops on ${platform}.

User's declared intention: "${userInput}"

Evaluate whether the reason is:
1. "VERIFIED": Specific study/work task, programming tutorial, or checking a video explicitly recommended by a peer.
2. "IMPULSIVE": Vague, mindless, boredom-driven, or dopamine-seeking (e.g., "bored", "just watching memes", "chilling", "quick break").

Output ONLY a valid raw JSON object. Do not include markdown ticks, backticks, or preamble.
{
  "verdict": "VERIFIED" or "IMPULSIVE",
  "reason": "Empathetic, grounded 1-2 sentence response directly addressing them",
  "passMinutes": 3
}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          {
            role: "user",
            content: fullPrompt
          }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("Provider Error:", data.error);
      throw new Error(data.error?.message || "LLM request failed");
    }

    let rawText = data.choices[0].message.content.trim();
    // Clean any markdown formatting if the model wrapped it in ```json
    if (rawText.startsWith("```")) {
      rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    }

    const result = JSON.parse(rawText);
    return res.json(result);

  } catch (err) {
    console.error("Cloud LLM Error:", err.message);
    return res.json({
      verdict: "IMPULSIVE",
      reason: "Short-form feeds scatter your focus rather than recharge it. Step away for 3 minutes instead.",
      passMinutes: 0
    });
  }
});

app.get("/health", (req, res) => res.json({ status: "active", model: LLM_MODEL }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});