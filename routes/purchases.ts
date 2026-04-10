import { Router } from 'express';
import type { Request, Response } from 'express';
import authenticateToken from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

router.post('/orders', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'ORDER_MUST_CONTAIN_AT_LEAST_ONE_ITEM' });
    }

    const normalizedItems = items
      .map((it: any) => ({
        productId: String(it?.productId ?? ''),
        quantity: Number(it?.quantity),
      }))
      .filter((it) => isUuid(it.productId) && Number.isFinite(it.quantity) && it.quantity > 0);

    if (normalizedItems.length !== items.length) {
      return res.status(400).json({ message: 'INVALID_ORDER_ITEMS' });
    }

    const mergedByProduct = new Map<string, number>();
    for (const it of normalizedItems) {
      mergedByProduct.set(it.productId, (mergedByProduct.get(it.productId) ?? 0) + it.quantity);
    }
    const mergedItems = Array.from(mergedByProduct.entries()).map(([productId, quantity]) => ({ productId, quantity }));

    const userId = req.user.id;

    const result = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: mergedItems.map((i) => i.productId) } },
        select: { id: true, name: true, price: true, stock: true },
      });

      if (products.length !== mergedItems.length) {
        return { ok: false as const, status: 400 as const, body: { message: 'UNKNOWN_PRODUCT_IN_ORDER' } };
      }

      const byId = new Map(products.map((p) => [p.id, p]));

      
      for (const it of mergedItems) {
        const p = byId.get(it.productId)!;
        if (p.stock < it.quantity) {
          return {
            ok: false as const,
            status: 409 as const,
            body: { message: 'INSUFFICIENT_STOCK', productId: p.id, available: p.stock, requested: it.quantity },
          };
        }

        const updated = await tx.product.updateMany({
          where: { id: p.id, stock: { gte: it.quantity } },
          data: { stock: { decrement: it.quantity } },
        });

        if (updated.count !== 1) {
          const fresh = await tx.product.findUnique({ where: { id: p.id }, select: { stock: true } });
          return {
            ok: false as const,
            status: 409 as const,
            body: { message: 'INSUFFICIENT_STOCK', productId: p.id, available: fresh?.stock ?? 0, requested: it.quantity },
          };
        }
      }

      const computedTotal = mergedItems.reduce((sum, it) => {
        const p = byId.get(it.productId)!;
        return sum + p.price * it.quantity;
      }, 0);

      const order = await tx.order.create({
        data: {
          userId,
          total: computedTotal,
          items: {
            create: mergedItems.map((it) => {
              const p = byId.get(it.productId)!;
              return {
                product: { connect: { id: p.id } },
                name: p.name,
                quantity: it.quantity,
                price: p.price,
              };
            }),
          },
        },
        select: { id: true, total: true },
      });

      return { ok: true as const, order };
    });

    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }

    res.status(201).json({
      message: 'ORDER_RECORDED_SUCCESSFULLY',
      orderId: result.order.id,
      total: result.order.total,
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
