import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gestra';

// Flag to track if MongoDB is connected
let mongoConnected = false;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:8765'],
    credentials: true,
  })
);

// Database connection with timeout
const connectToMongo = async () => {
  try {
    await Promise.race([
      mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('MongoDB connection timeout')), 5000)
      ),
    ]);
    console.log('Connected to MongoDB');
    mongoConnected = true;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.warn('Server will start without MongoDB - features will be limited');
    mongoConnected = false;
  }
};

// Connect to MongoDB on startup
connectToMongo();

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ 
    ok: true, 
    service: 'gestra-auth-server',
    mongoConnected: mongoConnected
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
  });
});

const server = app.listen(PORT, () => {
  console.log(`Auth server running on http://localhost:${PORT}`);
  console.log(`MongoDB status: ${mongoConnected ? 'Connected' : 'Disconnected'}`);
});
