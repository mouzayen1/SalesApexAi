import type { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import OpenAI from 'openai';
import fs from 'fs';

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

  if (!process.env.OPENAI_API_KEY) {
    return response.status(503).json({ error: 'OpenAI API key not configured' });
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const form = formidable({ maxFileSize: 25 * 1024 * 1024 });

    const [fields, files] = await form.parse(request as any);
    const audioFile = files.audio?.[0];

    if (!audioFile) {
      return response.status(400).json({ error: 'No audio file provided' });
    }

    const audioBuffer = await fs.promises.readFile(audioFile.filepath);
    
    // Create a File object from the buffer
    const file = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
    });

    return response.status(200).json({ text: transcription.text });
  } catch (error) {
    console.error('Transcription error:', error);
    return response.status(500).json({ error: 'Failed to transcribe audio' });
  }
}
