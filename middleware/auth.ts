import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'cyberpunk0hackershop0secret';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
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

export default authenticateToken;
