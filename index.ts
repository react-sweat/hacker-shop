import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import productsRouter from './routes/products.js';
import authRouter from './routes/auth.js';
import purchasesRouter from './routes/purchases.js';
import adminRouter from './routes/admin.js';

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

app.use(
  cors({
    origin: 'http://localhost:5173',
  }),
);

app.use('/products', productsRouter);
app.use('/', authRouter);
app.use('/', purchasesRouter);
app.use('/admin', adminRouter);


const server = app.listen(3000, () => {
  console.log('Serwer działa na porcie 3000');
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error('ERROR: Port 3000 is already in use. Kill the other process or use a different port.');
  } else {
    console.error('Server error:', err);
  }
});
