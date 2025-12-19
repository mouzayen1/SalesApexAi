import type { VercelRequest, VercelResponse } from '@vercel/node';
import Busboy from 'busboy';
import OpenAI from 'openai';

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

    const busboy = Busboy({ headers: request.headers });
    const chunks: Buffer[] = [];

    const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
      busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        file.on('data', (data) => {
          chunks.push(data);
        });
        file.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
      });

      busboy.on('error', (error) => {
        reject(error);
      });

      request.pipe(busboy);
    });

    if (!audioBuffer || audioBuffer.length === 0) {
      return response.status(400).json({ error: 'No audio file provided' });
    }

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
