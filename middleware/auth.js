const jwt = require('jsonwebtoken');

const JWT_SECRET = 'cyberpunk0hackershop0secret';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access Denied: Invalid Security Token' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ message: 'Access Denied: Invalid Security Token' });
    }
    

    req.user = user;
    next();
  });
};

module.exports = authenticateToken;
