require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// API Routes
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/checkout', require('./routes/checkout'));
app.use('/api/webhook', require('./routes/webhook'));

// Serve static files from client/dist
const distPath = path.join(__dirname, '../client/dist');
app.use(express.static(distPath));

// SPA fallback: serve index.html for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
db.initialize().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
