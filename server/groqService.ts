// server/groqService.ts
import Groq from 'groq-sdk';
import type { SmartDealAIRequest, SmartDealAIResponse } from '@shared/smartDealAI';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (!groqClient) {
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured');
    }
    groqClient = new Groq({ apiKey: GROQ_API_KEY });
  }
  return groqClient;
}

export function isGroqConfigured(): boolean {
  return !!GROQ_API_KEY;
}

const SYSTEM_PROMPT = `You are an Expert Auto Finance Director with 20+ years in subprime lending. Your role is to help salespeople understand the math behind customer payments and provide actionable guidance.

CRITICAL RULES:
1. NEVER invent or guess numbers - only analyze the data provided
2. Keep responses to 2 sentences maximum - salespeople don't read essays
3. Be direct and actionable - give specific dollar amounts or actions
4. Respect bank rules as immutable constraints
5. Focus on what CAN be done, not what can't
6. Return ONLY your analysis text - no JSON, no markdown formatting, no code blocks
7. Do NOT add any introductory phrases like "Here's my analysis:" - just give the insight directly

Your analysis style:
- If gap is small (<$50): Encouraging, provide simple solutions
- If gap is moderate ($50-100): Realistic, multiple options
- If gap is large (>$100): Direct reality check, pivot suggestions`;

export async function generateSmartDealInsight(
  request: SmartDealAIRequest
): Promise<SmartDealAIResponse> {
  // Debug logging
  console.log('Groq Service - Request received:', {
    vehiclePrice: request.vehiclePrice,
    targetPayment: request.targetPayment,
    creditTier: request.creditTier,
    bestProfitPayment: request.bestProfitPayment,
    floorPayment: request.floorPayment,
  });

  const groq = getGroqClient();

  const gap = request.floorPayment - request.targetPayment;
  const scenario: 'realistic' | 'unrealistic' = gap > 100 ? 'unrealistic' : 'realistic';

  // Build context for the AI
  const contextData = {
    targetPayment: `$${request.targetPayment}`,
    actualLowestPayment: `$${Math.round(request.floorPayment)}`,
    bestProfitPayment: `$${Math.round(request.bestProfitPayment)}`,
    paymentGap: `$${Math.round(gap)}`,
    bankRulesHit: request.bankRulesHit.length > 0 ? request.bankRulesHit : ['Standard guidelines'],
    creditTier: request.creditTier.replace('_', ' '),
    amountFinanced: `$${Math.round(request.amountFinanced)}`,
    ltv: `${Math.round(request.ltv)}%`,
    termMonths: request.termMonths,
    downPayment: `$${request.downPayment}`,
    vehiclePrice: `$${request.vehiclePrice}`,
    customerIncome: request.customerIncome ? `$${request.customerIncome}/month` : 'Not provided',
  };

  const userPrompt = `Analyze this deal and provide guidance (2 sentences max, plain text only):

CUSTOMER TARGET: ${contextData.targetPayment}/month
FLOOR PAYMENT (absolute minimum): ${contextData.actualLowestPayment}/month
BEST PROFIT PAYMENT: ${contextData.bestProfitPayment}/month
GAP FROM TARGET: ${contextData.paymentGap}

DEAL DETAILS:
- Vehicle Price: ${contextData.vehiclePrice}
- Amount Financed: ${contextData.amountFinanced}
- Down Payment: ${contextData.downPayment}
- LTV: ${contextData.ltv}
- Term: ${contextData.termMonths} months
- Credit Tier: ${contextData.creditTier}
- Customer Income: ${contextData.customerIncome}

BANK RULES HIT:
${contextData.bankRulesHit.map(r => `- ${r}`).join('\n')}

${scenario === 'realistic'
  ? 'Provide a helpful tip to close this deal - suggest specific down payment increase or term change.'
  : 'Explain why this payment target is mathematically impossible and suggest a pivot strategy.'}`;

  try {
    console.log('Groq Service - Calling Groq API with model: llama3-70b-8192');

    const completion = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const rawInsight = completion.choices[0]?.message?.content;
    console.log('Groq Service - Raw AI response:', rawInsight);

    // Clean up the response - remove any markdown or JSON formatting if present
    let insight = (rawInsight || 'Unable to generate insight.').trim();

    // Remove common AI prefixes
    insight = insight.replace(/^(Here's|Here is|Based on|My analysis:|Analysis:)\s*/i, '');

    // Remove markdown code blocks if present
    insight = insight.replace(/```[\s\S]*?```/g, '').trim();
    insight = insight.replace(/`/g, '').trim();

    // Extract suggested actions from the response based on gap
    const suggestedActions: string[] = [];
    if (gap <= 50) {
      suggestedActions.push(`Ask for $${Math.round(gap * 60)} more down`);
      suggestedActions.push('Extend term to 84 months');
    } else if (gap <= 100) {
      suggestedActions.push(`Need $${Math.round(gap * 60)}-${Math.round(gap * 72)} more down`);
      suggestedActions.push('Consider longer term or cheaper vehicle');
    } else {
      suggestedActions.push('Pivot to cheaper unit');
      suggestedActions.push('Consider lease option');
      suggestedActions.push('Re-evaluate customer budget');
    }

    const response: SmartDealAIResponse = {
      insight,
      scenario,
      gap: Math.round(gap),
      suggestedActions,
    };

    console.log('Groq Service - Returning response:', response);
    return response;
  } catch (error) {
    console.error('Groq Service - API Error:', error);

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('authentication')) {
        throw new Error('Groq API authentication failed. Please check your GROQ_API_KEY.');
      }
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        throw new Error('Groq API rate limit exceeded. Please try again in a moment.');
      }
      if (error.message.includes('503') || error.message.includes('unavailable')) {
        throw new Error('Groq API is temporarily unavailable. Please try again.');
      }
    }

    throw new Error('Failed to generate AI insight. Please try again.');
  }
}
