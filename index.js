const express = require('express');
const app = express();

app.use(express.json());

app.use((req, res, next) => {
  const time = new Date().toLocaleTimeString();
  console.log(`[${req.method}] ${req.url} - ${time}`);
  next();
});

app.use('/products', require('./routes/products'));

app.listen(3000, () => console.log('Serwer dziala na porcie 3000'));