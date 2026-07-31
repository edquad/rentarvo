import { Router, Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../../lib/prisma.js';
import { askBedrock } from '../../lib/bedrock.js';
import { authenticate } from '../../middleware/auth.js';
import { SYSTEM_PROMPT, FORMAT_PROMPT } from './chatbot.prompt.js';
import pino from 'pino';

const logger = pino({ name: 'chatbot' });

export const chatbotRouter = Router();
chatbotRouter.use(authenticate);

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many questions — try again in a minute' } },
});

const askSchema = z.object({
  question: z.string().trim().min(3).max(1000),
});

const FORBIDDEN_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE|COPY)\b/i;
const QUERY_TIMEOUT_MS = 8000;
const MAX_RESULT_ROWS = 50;

chatbotRouter.post('/ask', chatLimiter, async (req: Request, res: Response) => {
  const { question } = askSchema.parse(req.body);

  let sqlQuery: string | null = null;
  let explanation = '';
  let rows: any[] = [];
  let columns: string[] = [];
  let answer = '';

  try {
    const sqlResponse = await askBedrock(SYSTEM_PROMPT, question);

    let parsed: { sql: string | null; explanation: string };
    try {
      const jsonMatch = sqlResponse.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : sqlResponse);
    } catch {
      parsed = { sql: null, explanation: 'I had trouble understanding that question. Could you rephrase it?' };
    }

    sqlQuery = parsed.sql;
    explanation = parsed.explanation || '';

    if (sqlQuery) {
      if (FORBIDDEN_KEYWORDS.test(sqlQuery)) {
        logger.warn({ question, sql: sqlQuery }, 'Blocked dangerous SQL');
        sqlQuery = null;
        explanation = 'I can only read data, not modify it.';
      }
    }

    if (sqlQuery) {
      const result: any[] = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL statement_timeout = $1', String(QUERY_TIMEOUT_MS));
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        return tx.$queryRawUnsafe(sqlQuery! + (sqlQuery!.toLowerCase().includes('limit') ? '' : ` LIMIT ${MAX_RESULT_ROWS}`));
      });

      rows = result.map((row: any) => {
        const clean: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) {
          clean[k] = typeof v === 'bigint' ? Number(v) : v;
        }
        return clean;
      });

      if (rows.length > 0) {
        columns = Object.keys(rows[0]);
      }

      const dataSnippet = rows.length > 10
        ? JSON.stringify(rows.slice(0, 10)) + `\n... and ${rows.length - 10} more rows`
        : JSON.stringify(rows);

      answer = await askBedrock(
        FORMAT_PROMPT,
        `Question: ${question}\n\nQuery results (${rows.length} rows):\n${dataSnippet}`,
      );
    } else {
      answer = explanation;
    }
  } catch (err: any) {
    logger.error({ err, question }, 'Chatbot error');
    if (err.message?.includes('timeout') || err.message?.includes('statement_timeout')) {
      answer = 'That query took too long. Try asking something more specific.';
    } else if (err.name === 'AccessDeniedException' || err.message?.includes('AccessDenied')) {
      answer = 'AI service is not configured yet. Please ask the admin to enable AWS Bedrock.';
    } else {
      answer = 'Something went wrong while looking that up. Try rephrasing your question.';
    }
  }

  await prisma.chatbotEntry.create({
    data: {
      userId: req.user!.userId,
      rawText: question,
      parsedJson: sqlQuery ? { sql: sqlQuery, explanation, rowCount: rows.length } : { explanation },
      confidence: sqlQuery ? 1.0 : 0.0,
      status: 'CONFIRMED',
    },
  }).catch((e) => logger.warn({ err: e }, 'Failed to log chatbot entry'));

  res.json({
    answer,
    data: rows.length > 0 ? { columns, rows } : null,
    question,
  });
});

chatbotRouter.get('/history', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);
  const entries = await prisma.chatbotEntry.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      rawText: true,
      parsedJson: true,
      createdAt: true,
    },
  });
  res.json(entries.reverse());
});
