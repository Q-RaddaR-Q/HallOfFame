const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const sequelize = require('./config/database');
const WebSocket = require('ws');
const path = require('path');

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

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../../client/build')));

// API Routes
app.use('/api/payments', require('./routes/payments'));
app.use('/api/pixels', require('./routes/pixels'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/build/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server
const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Webhook endpoint:', `${process.env.REACT_APP_API_URL}/payments/webhook`);
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Set();

// WebSocket connection handler
wss.on('connection', (ws) => {
  // Add client to the set
  clients.add(ws);

  // Handle client disconnection
  ws.on('close', () => {
    clients.delete(ws);
  });
});

// Make WebSocket server available globally
global.wss = wss;

// Sync database
sequelize.sync({ force: false })
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