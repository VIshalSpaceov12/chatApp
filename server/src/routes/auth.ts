import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Generate chat-specific token (called by main app after auth)
router.post('/chat-token', authMiddleware, (req: AuthRequest, res) => {
  const chatToken = jwt.sign(
    { userId: req.userId },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '5m' }
  );

  res.json({ token: chatToken });
});

export default router;
