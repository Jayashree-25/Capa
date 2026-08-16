require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan'); // For request logging
const helmet = require('helmet'); // Security headers
const rateLimit = require('express-rate-limit'); // Rate limiting
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const { requireAuth } = require('./middleware/auth');

const app = express();

// ===== Middleware =====
// 1. Security
app.use(helmet()); // Adds security headers
app.use(cors({ 
  origin: process.env.FRONTEND_URL || 'http://localhost:3000' // Configure allowed origins
}));

// 2. Rate Limiting (100 requests per 15 minutes; skipped in test environment)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP. Please try again later.'
});
if (process.env.NODE_ENV !== 'test') {
  app.use(limiter);
}

// 3. Logging (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev')); // Logs requests to console
}

// 4. Body Parsing
app.use(express.json({ limit: '10kb' })); // Reject large payloads

// ===== Routes =====
app.use('/api/auth', authRoutes);            // Public: login; register/users are guarded inside
app.use('/api', requireAuth, apiRoutes);     // Everything else requires a valid token

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set. Set a strong random secret in production.');
}

// ===== Error Handling =====
// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message }) // Show details in dev
  });
});

// ===== Server Setup =====
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app; // For testing
