const express = require('express');
const router = express.Router();
const Pixel = require('../models/Pixel');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PIXEL_CONFIG } = require('../config/constants');
const WebSocket = require('ws');

// Get all pixels
router.get('/', async (req, res) => {
  try {
    const pixels = await Pixel.findAll();
    res.json(pixels);
  } catch (err) {
    console.error('Error fetching pixels:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pixel by coordinates
router.get('/:x/:y', async (req, res) => {
  try {
    const x = parseInt(req.params.x, 10);
    const y = parseInt(req.params.y, 10);
    
    if (isNaN(x) || isNaN(y)) {
      return res.status(400).json({ message: 'Invalid coordinates' });
    }

    const pixel = await Pixel.findOne({
      where: { x, y }
    });
    
    if (!pixel) {
      return res.status(404).json({ message: 'Pixel not found' });
    }
    
    res.json(pixel);
  } catch (err) {
    console.error('Error fetching pixel:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create or update pixel with payment
router.post('/', async (req, res) => {
  try {
    const { color, price, ownerId, paymentIntentId, ownerName, link, withSecurity } = req.body;
    const x = parseInt(req.body.x, 10);
    const y = parseInt(req.body.y, 10);

    if (isNaN(x) || isNaN(y)) {
      return res.status(400).json({ message: 'Invalid coordinates' });
    }
    
    // Find existing pixel
    const existingPixel = await Pixel.findOne({
      where: { x, y }
    });

    // If pixel exists and is secured, check if security has expired
    if (existingPixel && existingPixel.isSecured) {
      const now = new Date();
      if (existingPixel.securityExpiresAt && existingPixel.securityExpiresAt > now) {
        return res.status(400).json({
          message: 'This pixel is currently secured and cannot be purchased',
          securedUntil: existingPixel.securityExpiresAt
        });
      }
    }

    // If pixel exists and new price is not at least minPrice more, reject
    if (existingPixel) {
      const minRequiredPrice = existingPixel.price + PIXEL_CONFIG.minPrice;
      const epsilon = 0.001; // Small value to handle floating-point precision
      if (price < minRequiredPrice - epsilon) {
        return res.status(400).json({ 
          message: `New price must be at least $${PIXEL_CONFIG.minPrice} more than current price`,
          currentPrice: existingPixel.price
        });
      }
    }

    // If paymentIntentId is provided, verify the payment
    if (paymentIntentId) {
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ 
          message: 'Stripe secret key is not configured',
          error: 'Please configure STRIPE_SECRET_KEY in your environment variables'
        });
      }

      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        if (paymentIntent.status !== 'succeeded') {
          return res.status(400).json({ 
            message: 'Payment not successful',
            error: `Payment intent is in ${paymentIntent.status} status`
          });
        }
      } catch (stripeError) {
        console.error('Stripe error:', stripeError);
        return res.status(500).json({ 
          message: 'Error verifying payment',
          error: stripeError.message
        });
      }
    }

    // Calculate security expiration if security option is chosen
    let securityExpiresAt = null;
    if (withSecurity) {
      securityExpiresAt = new Date();
      securityExpiresAt.setDate(securityExpiresAt.getDate() + 7); // Add 7 days
    }

    // Update or create the pixel
    const [pixel, created] = await Pixel.findOrCreate({
      where: { x, y },
      defaults: { 
        color, 
        price, 
        ownerId, 
        ownerName, 
        link,
        isSecured: withSecurity,
        securityExpiresAt
      }
    });

    if (!created) {
      pixel.color = color;
      pixel.price = price;
      pixel.ownerId = ownerId;
      pixel.ownerName = ownerName;
      pixel.link = link;
      pixel.lastUpdated = new Date();
      pixel.isSecured = withSecurity;
      pixel.securityExpiresAt = securityExpiresAt;
      await pixel.save();
    }

    // Broadcast the pixel update to all connected clients
    if (global.wss) {
      const message = JSON.stringify({
        type: 'pixelUpdate',
        pixel: {
          x: pixel.x,
          y: pixel.y,
          color: pixel.color,
          price: pixel.price,
          ownerId: pixel.ownerId,
          ownerName: pixel.ownerName,
          link: pixel.link,
          lastUpdated: pixel.lastUpdated
        }
      });

      global.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }

    return res.json({
      pixel,
      message: created ? 'Pixel created successfully' : 'Pixel updated successfully'
    });

  } catch (error) {
    console.error('Error creating/updating pixel:', error);
    return res.status(500).json({ 
      message: 'Error creating/updating pixel',
      error: error.message
    });
  }
});

// Handle successful payment
router.post('/payment-success', async (req, res) => {
  try {
    const { id, amount, status, metadata } = req.body;
    
    if (!id || !status || status !== 'succeeded' || !metadata) {
      return res.status(400).json({ 
        message: 'Invalid payment data',
        error: 'Payment data is missing or invalid'
      });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ 
        message: 'Stripe secret key is not configured',
        error: 'Please configure STRIPE_SECRET_KEY in your environment variables'
      });
    }

    try {
      const { x, y, color, ownerId, ownerName } = metadata;
      
      if (!x || !y || !color || !ownerId || !ownerName) {
        return res.status(400).json({ 
          message: 'Invalid metadata',
          error: 'Required metadata fields are missing'
        });
      }

      // Verify the payment with Stripe
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const paymentIntent = await stripe.paymentIntents.retrieve(id);
      
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ 
          message: 'Payment not successful',
          error: `Payment intent is in ${paymentIntent.status} status`
        });
      }

      const [pixel, created] = await Pixel.findOrCreate({
        where: { x, y },
        defaults: { color, price: amount / 100, ownerId, ownerName }
      });

      if (!created) {
        pixel.color = color;
        pixel.price = amount / 100;
        pixel.ownerId = ownerId;
        pixel.ownerName = ownerName;
        pixel.lastUpdated = new Date();
        await pixel.save();
      }

      return res.json({
        pixel,
        message: 'Payment successful and pixel updated'
      });
    } catch (stripeError) {
      console.error('Error processing payment:', stripeError);
      return res.status(500).json({ 
        message: 'Error processing payment',
        error: stripeError.message
      });
    }
  } catch (err) {
    console.error('Error handling payment success:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get free pixel count for a user
router.get('/free-count/:browserId', async (req, res) => {
  try {
    const { browserId } = req.params;
    const count = await Pixel.count({
      where: {
        ownerId: browserId,
        price: 0
      }
    });
    res.json(count);
  } catch (err) {
    console.error('Error fetching free pixel count:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pixel configuration
router.get('/config', async (req, res) => {
  try {
    res.json(PIXEL_CONFIG);
  } catch (error) {
    console.error('Error getting pixel configuration:', error);
    res.status(500).json({ error: 'Failed to get pixel configuration' });
  }
});

// Update pixel
router.put('/:x/:y', async (req, res) => {
  try {
    const { x, y } = req.params;
    const { color, price, ownerId, ownerName } = req.body;

    // Validate price against minimum
    const config = await getConfig();
    if (price < config.minPrice) {
      return res.status(400).json({ error: `Price must be at least $${config.minPrice}` });
    }

    // ... rest of the function ...
  } catch (error) {
    // ... error handling ...
  }
});

// Update pixel link
router.put('/:x/:y/link', async (req, res) => {
  try {
    const x = parseInt(req.params.x, 10);
    const y = parseInt(req.params.y, 10);
    const { link } = req.body;
    
    if (isNaN(x) || isNaN(y)) {
      return res.status(400).json({ message: 'Invalid coordinates' });
    }

    const pixel = await Pixel.findOne({
      where: { x, y }
    });
    
    if (!pixel) {
      return res.status(404).json({ message: 'Pixel not found' });
    }

    // Update the link
    pixel.link = link;
    await pixel.save();
    
    res.json(pixel);
  } catch (err) {
    console.error('Error updating pixel link:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to get configuration
async function getConfig() {
  return PIXEL_CONFIG;
}

module.exports = router; 