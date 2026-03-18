import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../prisma.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret';

// ── POST /api/auth/register ──────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash },
    });

    res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userId: user.id });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── POST /api/auth/google ─────────────────────────────────
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { credential, access_token } = req.body;
    if (!credential && !access_token) {
      res.status(400).json({ error: 'Missing Google credential' });
      return;
    }

    // Verify via userinfo (access_token) or tokeninfo (id_token)
    const googleFetch = access_token
      ? await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` },
        })
      : await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);

    if (!googleFetch.ok) {
      res.status(401).json({ error: 'Invalid Google token' });
      return;
    }

    const gd = await googleFetch.json() as { sub: string; email: string; name: string; picture: string };
    const { sub: googleId, email, name, picture } = gd;

    if (!email) {
      res.status(400).json({ error: 'No email in Google token' });
      return;
    }

    // Find by googleId or email, or create
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (user) {
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            avatarUrl: user.avatarUrl ?? picture,
            name: user.name ?? name,
          },
        });
      }
    } else {
      user = await prisma.user.create({
        data: { email, googleId, name, avatarUrl: picture },
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userId: user.id });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

export default router;
