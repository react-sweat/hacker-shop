import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

interface User {
  id: number;
  username: string;
  email: string;
  password?: string;
}

const users: User[] = [];
const JWT_SECRET = 'cyberpunk0hackershop0secret';

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ message: 'Username is required and must be a string' });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ message: 'A valid email is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password is required and must be at least 8 characters long' });
    }

    const usernameExists = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (usernameExists) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const emailExists = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (emailExists) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser: User = {
      id: users.length + 1,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: hashedPassword
    };

    users.push(newUser);

    const userResponse = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email
    };

    res.status(201).json({
      message: 'User registered successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());

    if (!user || !user.password) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const payload = {
      id: user.id,
      username: user.username
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email
    };

    res.status(200).json({
      message: 'Login successful',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;