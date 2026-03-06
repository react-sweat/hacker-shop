const express = require('express');
const app = express();

app.use(express.json());

app.use((req, res, next) => {
  const time = new Date().toLocaleTimeString();
  console.log(`[${req.method}] ${req.url} - ${time}`);
  next();
});

app.get('/', (_req, res) => {
  res.send('Hacker Shop API');
});

const cors = require('cors');

app.use(
  cors({
    origin: 'http://localhost:5173',
  }),
);

const productsRouter = require('./routes/products');
app.use('/products', productsRouter);

app.listen(3000, () => {
  console.log('Serwer działa na porcie 3000');
});
