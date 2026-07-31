import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';
import pino from 'pino';

const logger = pino({ name: 'ai-provider' });

let gemini: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  if (!gemini) {
    const apiKey = config.ai.geminiApiKey;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    gemini = new GoogleGenAI({ apiKey });
  }
  return gemini;
}

// ─── Monthly cost tracking ──────────────────────────────────────
const COST_LIMIT_USD = parseFloat(process.env.AI_MONTHLY_LIMIT || '11');
// Gemini 2.0 Flash Lite: $0.015/1M input, $0.06/1M output (extremely cheap)
const INPUT_PRICE_PER_1M = 0.075;
const OUTPUT_PRICE_PER_1M = 0.30;

interface MonthlyUsage {
  month: string;
  inputTokens: number;
  outputTokens: number;
  requests: number;
}

let usage: MonthlyUsage = { month: currentMonth(), inputTokens: 0, outputTokens: 0, requests: 0 };

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function estimatedCostUsd(): number {
  return (usage.inputTokens / 1_000_000) * INPUT_PRICE_PER_1M
       + (usage.outputTokens / 1_000_000) * OUTPUT_PRICE_PER_1M;
}

function resetIfNewMonth(): void {
  const m = currentMonth();
  if (usage.month !== m) {
    logger.info({ oldMonth: usage.month, cost: estimatedCostUsd().toFixed(4) }, 'Resetting monthly usage');
    usage = { month: m, inputTokens: 0, outputTokens: 0, requests: 0 };
  }
}

export function getUsageStats() {
  resetIfNewMonth();
  return {
    month: usage.month,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    requests: usage.requests,
    estimatedCost: parseFloat(estimatedCostUsd().toFixed(4)),
    limitUsd: COST_LIMIT_USD,
    paused: estimatedCostUsd() >= COST_LIMIT_USD,
  };
}

export class CostLimitError extends Error {
  constructor(cost: number, limit: number) {
    super(`AI chatbot paused: estimated cost $${cost.toFixed(2)} has reached the $${limit.toFixed(2)} monthly limit.`);
    this.name = 'CostLimitError';
  }
}

export async function askBedrock(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  resetIfNewMonth();

  const cost = estimatedCostUsd();
  if (cost >= COST_LIMIT_USD) {
    throw new CostLimitError(cost, COST_LIMIT_USD);
  }

  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: config.ai.model,
    contents: userMessage,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0,
      maxOutputTokens: 2048,
    },
  });

  const inTok = response.usageMetadata?.promptTokenCount ?? 0;
  const outTok = response.usageMetadata?.candidatesTokenCount ?? 0;
  usage.inputTokens += inTok;
  usage.outputTokens += outTok;
  usage.requests += 1;

  const newCost = estimatedCostUsd();
  if (newCost >= COST_LIMIT_USD * 0.9) {
    logger.warn({ cost: newCost.toFixed(4), limit: COST_LIMIT_USD }, 'Approaching monthly cost limit');
  }

  return response.text ?? '';
}
