import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateChatResponse, generateSpeech, isConfigured } from '../server/openai';
import { conversationRequestSchema } from '../shared/schema';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  if (!isConfigured()) {
    return response.status(503).json({ 
      error: 'OpenAI API key not configured. Please add your OPENAI_API_KEY to use the AI assistant.' 
    });
  }

  try {
    const parsed = conversationRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({ error: 'Invalid request body' });
    }

    const { messages, userMessage } = parsed.data;
    const responseText = await generateChatResponse(messages, userMessage);
    
    // Generate speech for the response
    const audioBuffer = await generateSpeech(responseText);
    const audioBase64 = audioBuffer.toString('base64');
    const audioUrl = `data:audio/mp3;base64,${audioBase64}`;

    return response.status(200).json({
      message: responseText,
      audioUrl,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return response.status(500).json({ error: 'Failed to generate response' });
  }
}
