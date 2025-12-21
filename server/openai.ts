import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

export function isConfigured(): boolean {
  return !!apiKey;
}

const openai = apiKey ? new OpenAI({ apiKey }) : null;

export async function generateSpeech(text: string): Promise<Buffer> {
  if (!openai) {
    throw new Error("OpenAI API key not configured");
  }

  const mp3 = await openai.audio.speech.create({
    model: "tts-1",
    voice: "alloy",
    input: text,
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());
  return buffer;
}
