import type { VercelRequest, VercelResponse } from '@vercel/node';
import { transcribeAudio, isConfigured } from '../server/openai';
import formidable from 'formidable';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
    const form = formidable({ maxFileSize: 25 * 1024 * 1024 });
    
    const [fields, files] = await form.parse(request as any);
    const audioFile = files.audio?.[0];

    if (!audioFile) {
      return response.status(400).json({ error: 'No audio file provided' });
    }

    const audioBuffer = await fetch(`file://${audioFile.filepath}`)
      .then(r => r.arrayBuffer())
      .then(b => Buffer.from(b));

    const text = await transcribeAudio(audioBuffer);
    return response.status(200).json({ text });
  } catch (error) {
    console.error('Transcription error:', error);
    return response.status(500).json({ error: 'Failed to transcribe audio' });
  }
}
