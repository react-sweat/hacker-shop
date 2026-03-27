import { Router } from 'express';
import type { Request, Response } from 'express';
import authenticateToken from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.post('/orders', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { items, total } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order must contain at least one item' });
    }

    if (total === undefined || typeof total !== 'number' || total <= 0) {
      return res.status(400).json({ message: 'A valid total is required' });
    }

    const userId = req.user.id;

    const order = await prisma.order.create({
      data: {
        userId,
        total,
        items: {
          create: items.map((item: any) => ({
            productId: String(item.productId),
            name: item.name,
            quantity: item.quantity,
            price: item.price
          }))
        }
      }
    });

    res.status(201).json({
      message: 'Order recorded successfully',
      orderId: order.id
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/purchases', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    const userOrders = await prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { date: 'desc' }
    });

    res.status(200).json(userOrders);
  } catch (error) {
    console.error('Fetch purchases error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
