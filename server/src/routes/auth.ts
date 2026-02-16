import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const AVATAR_COLORS = ['#007AFF', '#FF3B30', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5856D6', '#00C7BE'];

// Register
router.post('/register', async (req, res) => {
  const { name, email, role } = req.body;

  if (!name || !email) {
    res.status(400).json({ error: 'Name and email are required' });
    return;
  }

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const result = await query(
      'INSERT INTO users (name, email, role, avatar_color) VALUES ($1, $2, $3, $4) RETURNING *',
      [name.trim(), email.toLowerCase().trim(), role || 'member', color]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarColor: user.avatar_color,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No account found with this email' });
      return;
    }

    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarColor: user.avatar_color,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const user = result.rows[0];
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarColor: user.avatar_color,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Search users (for adding to conversations)
router.get('/users/search', authMiddleware, async (req: AuthRequest, res) => {
  const q = req.query.q as string;
  if (!q || q.length < 2) {
    res.json([]);
    return;
  }

  try {
    const result = await query(
      `SELECT id, name, email, role, avatar_color FROM users
       WHERE (name ILIKE $1 OR email ILIKE $1) AND id != $2 LIMIT 20`,
      [`%${q}%`, req.userId]
    );
    res.json(result.rows.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatarColor: u.avatar_color,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Generate chat-specific token
router.post('/chat-token', authMiddleware, (req: AuthRequest, res) => {
  const chatToken = jwt.sign(
    { userId: req.userId },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '5m' }
  );
  res.json({ token: chatToken });
});

export default router;
