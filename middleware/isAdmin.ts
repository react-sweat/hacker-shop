import type { Request, Response, NextFunction } from 'express';

const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'UNAUTHORIZED: SECURITY_BREACH' });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'FORBIDDEN: ADMIN_CLEARANCE_REQUIRED' });
  }

  next();
};

export default isAdmin;
