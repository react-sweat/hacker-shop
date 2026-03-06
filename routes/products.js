const router = require('express').Router();

let products = [
  { id: 1, name: 'Klawiatura', price: 250 },
  { id: 2, name: 'Myszka', price: 120 },
  { id: 3, name: 'Monitor', price: 1500 },
  { id: 4, name: 'Sluchawki', price: 300 },
];

let nextId = 5;

router.get('/', (req, res) => {
  const sorted = [...products].sort((a, b) => a.price - b.price);
  res.json(sorted);
});

router.post('/', (req, res) => {
  const { name, price } = req.body;

  if (!name || typeof price !== 'number' || price <= 0) {
    return res.status(400).json({ error: 'Nieprawidlowe dane' });
  }

  const product = { id: nextId++, name, price };
  products.push(product);
  res.status(201).json(product);
});

module.exports = router;