const express = require('express');
const router = express.Router();

const products = [
  { id: 1, name: 'Laptop', price: 6000 },
  { id: 2, name: 'Klawiatura', price: 500 },
  { id: 3, name: 'Myszka', price: 199 }
];

router.get('/', (req, res) => {
  res.json(products);
});

router.post('/', (req, res) => {
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

  const newProduct = {
    id: products.length + 1,
    name: name.trim(),
    price
  };

  products.push(newProduct);
  res.status(201).json(newProduct);
});

module.exports = router;
