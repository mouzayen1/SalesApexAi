import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const openaiConfigured = !!process.env.OPENAI_API_KEY;
  return response.status(200).json({ openaiConfigured });
}
