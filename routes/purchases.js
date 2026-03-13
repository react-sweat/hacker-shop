const express = require('express');
const crypto = require('crypto');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

const ordersDB = {};

function generateOrderId() {
  const num = Math.floor(1000 + Math.random() * 9000);
  const suffix = crypto.randomBytes(2).toString('hex');
  return `T-${num}-${suffix}`;
}

router.post('/orders', authenticateToken, (req, res) => {
  try {
    const { items, total } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order must contain at least one item' });
    }

    if (total === undefined || typeof total !== 'number' || total <= 0) {
      return res.status(400).json({ message: 'A valid total is required' });
    }

    const userId = req.user.id;
    const orderId = generateOrderId();

    const order = {
      id: orderId,
      date: new Date().toISOString(),
      total,
      items: items.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      }))
    };

    if (!ordersDB[userId]) {
      ordersDB[userId] = [];
    }

    ordersDB[userId].push(order);

    res.status(201).json({
      message: 'Order recorded successfully',
      orderId
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/purchases', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const userOrders = ordersDB[userId] || [];

  // Sort by date, newest first
  const sorted = [...userOrders].sort((a, b) => new Date(b.date) - new Date(a.date));

  res.status(200).json(sorted);
});

module.exports = router;
