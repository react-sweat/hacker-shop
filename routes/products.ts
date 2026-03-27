import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany();
    res.json(products);
  } catch (error) {
    console.error('Fetch products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    console.log('BODY:', req.body);

    const { name, price } = req.body || {};

    if (
      typeof name !== 'string' ||
      !name.trim() ||
      typeof price !== 'number' ||
      price <= 0
    ) {
      return res.status(400).json({ error: 'Nieprawidłowe dane' });
    }

    const newProduct = await prisma.product.create({
      data: {
        name: name.trim(),
        price
      }
    });

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Product creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
