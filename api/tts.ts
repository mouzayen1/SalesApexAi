import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateSpeech, isConfigured } from '../server/openai';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  if (!isConfigured()) {
    return response.status(503).json({ error: 'OpenAI API key not configured' });
  }

  try {
    const { text } = request.body;
    
    if (!text || typeof text !== 'string') {
      return response.status(400).json({ error: 'Text is required' });
    }

    const audioBuffer = await generateSpeech(text);
    
    response.setHeader('Content-Type', 'audio/mp3');
    response.setHeader('Content-Length', audioBuffer.length.toString());
    return response.status(200).send(audioBuffer);
  } catch (error) {
    console.error('TTS error:', error);
    return response.status(500).json({ error: 'Failed to generate speech' });
  }
}
