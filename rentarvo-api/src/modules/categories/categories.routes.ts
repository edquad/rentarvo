import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';

export const categoriesRouter = Router();
categoriesRouter.use(authenticate);

// List
categoriesRouter.get('/', async (req: Request, res: Response) => {
  const { kind } = req.query;
  const categories = await prisma.category.findMany({
    where: kind ? { kind: kind as any } : undefined,
    orderBy: { name: 'asc' },
  });
  res.json(categories);
});
