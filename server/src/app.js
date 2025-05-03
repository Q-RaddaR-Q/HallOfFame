const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const sequelize = require('./config/database');

// Load environment variables
dotenv.config();

// Initialize express
const app = express();

// Middleware
app.use(cors());

// Regular JSON middleware for all routes except webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Routes
app.use('/api/payments', require('./routes/payments'));
app.use('/api/pixels', require('./routes/pixels'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server
const PORT = process.env.PORT || 5000;

// Sync database and start server
sequelize.sync({ force: false })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log('Webhook endpoint:', `http://localhost:${PORT}/api/payments/webhook`);
    });
  })
  .catch(error => {
    console.error('Unable to sync database:', error);
    process.exit(1);
  });

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  process.exit(1);
});