import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type SystemContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { config } from '../config/index.js';
import pino from 'pino';

const logger = pino({ name: 'bedrock' });

let client: BedrockRuntimeClient | null = null;

function getClient(): BedrockRuntimeClient {
  if (!client) {
    const opts: Record<string, any> = { region: config.bedrock.region };
    const ak = config.bedrock.accessKeyId || config.storage.s3.accessKeyId;
    const sk = config.bedrock.secretAccessKey || config.storage.s3.secretAccessKey;
    if (ak && sk) {
      opts.credentials = { accessKeyId: ak, secretAccessKey: sk };
    }
    client = new BedrockRuntimeClient(opts);
  }
  return client;
}

// ─── Monthly cost tracking ──────────────────────────────────────
const COST_LIMIT_USD = parseFloat(process.env.BEDROCK_MONTHLY_LIMIT || '11');
const INPUT_PRICE_PER_1M = 0.25;
const OUTPUT_PRICE_PER_1M = 1.25;

interface MonthlyUsage {
  month: string;
  inputTokens: number;
  outputTokens: number;
}

let usage: MonthlyUsage = { month: currentMonth(), inputTokens: 0, outputTokens: 0 };

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
    usage = { month: m, inputTokens: 0, outputTokens: 0 };
  }
}

export function getUsageStats() {
  resetIfNewMonth();
  return {
    month: usage.month,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
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

// ─── Converse API (works with both Anthropic & Amazon models) ───
export async function askBedrock(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  resetIfNewMonth();

  const cost = estimatedCostUsd();
  if (cost >= COST_LIMIT_USD) {
    throw new CostLimitError(cost, COST_LIMIT_USD);
  }

  const system: SystemContentBlock[] = [{ text: systemPrompt }];
  const messages: Message[] = [{ role: 'user', content: [{ text: userMessage }] }];

  const command = new ConverseCommand({
    modelId: config.bedrock.model,
    system,
    messages,
    inferenceConfig: { maxTokens: 2048, temperature: 0 },
  });

  const response = await getClient().send(command);

  const inTok = response.usage?.inputTokens ?? 0;
  const outTok = response.usage?.outputTokens ?? 0;
  usage.inputTokens += inTok;
  usage.outputTokens += outTok;

  const newCost = estimatedCostUsd();
  if (newCost >= COST_LIMIT_USD * 0.9) {
    logger.warn({ cost: newCost.toFixed(4), limit: COST_LIMIT_USD }, 'Approaching monthly cost limit');
  }

  const text = response.output?.message?.content?.[0]?.text ?? '';
  return text;
}
