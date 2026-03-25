import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';

const router = express.Router();

// Check if JWT_SECRET is configured
if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set. Using default for development only!');
}

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'dev-secret-key', {
    expiresIn: '7d',
  });
};

// Validation middleware
const validateEmail = body('email')
  .isEmail()
  .normalizeEmail()
  .withMessage('Please provide a valid email');

const validatePassword = body('password')
  .isLength({ min: 6 })
  .withMessage('Password must be at least 6 characters');

const validateName = body('name')
  .trim()
  .notEmpty()
  .withMessage('Name is required');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// Register
router.post(
  '/register',
  validateEmail,
  validatePassword,
  validateName,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password, name } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists',
        });
      }

      // Create new user
      const user = new User({
        email,
        password,
        name,
      });

      await user.save();

      // Generate token
      const token = generateToken(user._id);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        token,
        user: user.toJSON(),
      });
    } catch (error) {
      console.error('Register error:', error);
      
      // Check for specific MongoDB errors
      if (error.message && error.message.includes('Duplicate key')) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered',
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Error registering user',
      });
    }
  }
);

// Login
router.post(
  '/login',
  validateEmail,
  validatePassword,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user and explicitly select password
      const user = await User.findOne({ email }).select('+password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Check password
      const isPasswordValid = await user.matchPassword(password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate token
      const token = generateToken(user._id);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: user.toJSON(),
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error logging in',
      });
    }
  }
);

// Verify token and get user info
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key');
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      error: error.message,
    });
  }
});

// Logout (client-side in practice, but we can invalidate token server-side if needed)
router.post('/logout', (req, res) => {
  // In a real app, you might add the token to a blacklist or rotate refresh tokens
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

export default router;
