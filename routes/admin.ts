import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import authenticateToken from '../middleware/auth.js';
import isAdmin from '../middleware/isAdmin.js';

const router = Router();

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

router.use(authenticateToken);
router.use(isAdmin);


router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_FETCH_CATEGORIES' });
  }
});

router.post('/categories', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'NAME_REQUIRED' });
    
    const category = await prisma.category.create({
      data: { name }
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_CREATE_CATEGORY' });
  }
});

router.put('/categories/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!isUuid(id)) return res.status(400).json({ error: 'INVALID_ID' });
    const category = await prisma.category.update({
      where: { id },
      data: { name }
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_UPDATE_CATEGORY' });
  }
});

router.delete('/categories/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ error: 'INVALID_ID' });
    await prisma.category.delete({
      where: { id }
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_DELETE_CATEGORY' });
  }
});

router.get('/products', async (_req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      include: { category: true }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_FETCH_PRODUCTS' });
  }
});

router.post('/products', async (req: Request, res: Response) => {
  try {
    const { name, price, description, imageUrl, stock, categoryId } = req.body;
    const product = await prisma.product.create({
      data: {
        name,
        price: Number(price),
        description,
        imageUrl,
        stock: Number(stock || 0),
        categoryId: categoryId ? String(categoryId) : null
      }
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_CREATE_PRODUCT' });
  }
});

router.put('/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, price, description, imageUrl, stock, categoryId } = req.body;
    if (!isUuid(id)) return res.status(400).json({ error: 'INVALID_ID' });

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (price !== undefined) data.price = Number(price);
    if (description !== undefined) data.description = description;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (stock !== undefined) data.stock = Number(stock);
    if (categoryId !== undefined) data.categoryId = categoryId ? String(categoryId) : null;

    const product = await prisma.product.update({
      where: { id },
      data
    });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_UPDATE_PRODUCT' });
  }
});

router.delete('/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ error: 'INVALID_ID' });
    await prisma.product.delete({
      where: { id }
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_DELETE_PRODUCT' });
  }
});

router.get('/inventory', async (_req: Request, res: Response) => {
  try {
    const inventory = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        stock: true,
        category: { select: { name: true } }
      }
    });
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_FETCH_INVENTORY' });
  }
});

router.put('/inventory/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;
    if (!isUuid(id)) return res.status(400).json({ error: 'INVALID_ID' });
    if (stock === undefined) return res.status(400).json({ error: 'STOCK_REQUIRED' });

    const product = await prisma.product.update({
      where: { id },
      data: { stock: Number(stock) },
      select: { id: true, name: true, stock: true }
    });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_UPDATE_INVENTORY' });
  }
});

router.get('/orders', async (_req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: { select: { username: true, email: true } },
        items: true
      },
      orderBy: { date: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_FETCH_ORDERS' });
  }
});

router.get('/orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ error: 'INVALID_ID' });

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { username: true, email: true } },
        items: true
      }
    });

    if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_FETCH_ORDER_DETAILS' });
  }
});

router.get('/reports/orders', async (_req: Request, res: Response) => {
  try {
    const { from, to, userId } = _req.query as { from?: string; to?: string; userId?: string };

    const dateFilter: any = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) dateFilter.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) dateFilter.lte = d;
    }

    const where: any = {};
    if (Object.keys(dateFilter).length) where.date = dateFilter;
    if (userId && Number.isFinite(Number(userId))) where.userId = Number(userId);

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: { select: { username: true, email: true } },
        items: true
      },
      orderBy: { date: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_FETCH_REPORTS' });
  }
});

router.get('/reports/orders/summary', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };

    const dateFilter: any = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) dateFilter.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) dateFilter.lte = d;
    }

    const where: any = {};
    if (Object.keys(dateFilter).length) where.date = dateFilter;

    const [count, sumAgg] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.aggregate({ where, _sum: { total: true }, _avg: { total: true } }),
    ]);

    res.json({
      ordersCount: count,
      revenueTotal: sumAgg._sum.total ?? 0,
      averageOrderValue: sumAgg._avg.total ?? 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_FETCH_REPORT_SUMMARY' });
  }
});

export default router;
