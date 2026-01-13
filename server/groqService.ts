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

Your analysis style:
- If gap is small (<$50): Encouraging, provide simple solutions
- If gap is moderate ($50-100): Realistic, multiple options
- If gap is large (>$100): Direct reality check, pivot suggestions`;

export async function generateSmartDealInsight(
  request: SmartDealAIRequest
): Promise<SmartDealAIResponse> {
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

  const userPrompt = `Analyze this deal and provide guidance:

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
    const completion = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const insight = completion.choices[0]?.message?.content?.trim() || 'Unable to generate insight.';

    // Extract suggested actions from the response
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

    return {
      insight,
      scenario,
      gap: Math.round(gap),
      suggestedActions,
    };
  } catch (error) {
    console.error('Groq API error:', error);
    throw new Error('Failed to generate AI insight');
  }
}
