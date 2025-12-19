import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return response.status(503).json({
      error: 'OpenAI API key not configured. Please add your OPENAI_API_KEY to use the AI assistant.'
    });
  }

  try {
    const { messages, userMessage } = request.body;

    if (!messages || !Array.isArray(messages)) {
      return response.status(400).json({ error: 'Invalid request body' });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // System prompt for car sales assistant
    const systemMessage = {
      role: 'system',
      content: `You are a helpful car sales assistant. You help customers find the perfect vehicle based on their needs and preferences. 

Available inventory:
- 2023 Toyota Camry Hybrid: $28,500, 12,000 miles, Silver, 51/53 MPG, FWD, Automatic
- 2022 Honda CR-V: $32,000, 18,500 miles, Blue, 28/34 MPG, AWD, Automatic
- 2023 Ford F-150: $45,000, 8,000 miles, Red, 20/26 MPG, 4WD, Automatic
- 2023 Tesla Model 3: $42,000, 5,000 miles, White, Electric (358 mile range), AWD, Automatic
- 2021 Chevrolet Malibu: $22,000, 28,000 miles, Black, 29/36 MPG, FWD, Automatic

When customers ask about vehicles, provide helpful information from this inventory. Be friendly, professional, and focus on matching their needs.`
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        systemMessage,
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const responseText = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

    return response.status(200).json({ 
      response: responseText 
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return response.status(500).json({ 
      error: error.message || 'Failed to generate response' 
    });
  }
}
