import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

interface Product {
  id: number;
  name: string;
  price: number;
}

const products: Product[] = [
  { id: 1, name: 'Laptop', price: 6000 },
  { id: 2, name: 'Klawiatura', price: 500 },
  { id: 3, name: 'Myszka', price: 199 }
];

router.get('/', (req: Request, res: Response) => {
  res.json(products);
});

router.post('/', (req: Request, res: Response) => {
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

  const newProduct: Product = {
    id: products.length + 1,
    name: name.trim(),
    price
  };

  products.push(newProduct);
  res.status(201).json(newProduct);
});

export default router;
