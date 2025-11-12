import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import dotenv from 'dotenv';
import {
  findUserByEmail,
  createUser,
  getPublicUser
} from '../models/userStore.js';

dotenv.config();

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = createUser({
      username,
      email,
      password: hashedPassword,
      provider: 'local'
    });

    // Generate JWT token
    const token = createToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: getPublicUser(user)
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// ✅ Login endpoint (temporary test credentials)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // ✅ Temporary test login
    if (email === 'test@gmail.com' && password === 'test') {
      const token = jwt.sign(
        { id: 999, username: 'TestUser', email },
        process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        { expiresIn: '24h' }
      );

      return res.json({
        message: 'Temporary test login successful',
        token,
        user: {
          id: 999,
          username: 'TestUser',
          email
        }
      });
    }

    // Normal login logic for registered users
    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = createToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: getPublicUser(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// OAuth - Google
router.get(
  '/oauth/google',
  (req, res, next) => {
    const { redirect } = req.query;
    if (redirect && typeof redirect === 'string') {
      if (redirect.startsWith('/')) {
        req.session.redirectTo = redirect;
      }
    }
    next();
  },
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
);

router.get(
  '/oauth/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${FRONTEND_URL}/login?error=google_auth_failed`
  }),
  (req, res) => {
    const redirectTo = req.session.redirectTo && typeof req.session.redirectTo === 'string'
      ? req.session.redirectTo
      : '/dashboard';
    delete req.session.redirectTo;

    const user = getPublicUser(req.user);
    const token = createToken(req.user);

    const params = new URLSearchParams({
      token,
      user: Buffer.from(JSON.stringify(user)).toString('base64'),
      redirect: redirectTo
    });

    res.redirect(`${FRONTEND_URL}/login?${params.toString()}`);
  }
);

export default router;