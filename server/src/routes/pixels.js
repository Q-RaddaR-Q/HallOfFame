const express = require('express');
const router = express.Router();
const Pixel = require('../models/Pixel');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PIXEL_CONFIG } = require('../config/constants');

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
    const { color, price, ownerId, paymentIntentId, ownerName } = req.body;
    const x = parseInt(req.body.x, 10);
    const y = parseInt(req.body.y, 10);

    if (isNaN(x) || isNaN(y)) {
      return res.status(400).json({ message: 'Invalid coordinates' });
    }
    
    // Find existing pixel
    const existingPixel = await Pixel.findOne({
      where: { x, y }
    });

    // If pixel exists and new price is not at least minPrice more, reject
    if (existingPixel && price <= existingPixel.price + PIXEL_CONFIG.minPrice) {
      return res.status(400).json({ 
        message: `New price must be at least $${PIXEL_CONFIG.minPrice} more than current price`,
        currentPrice: existingPixel.price
      });
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

    // Update or create the pixel
    const [pixel, created] = await Pixel.findOrCreate({
      where: { x, y },
      defaults: { color, price, ownerId, ownerName }
    });

    if (!created) {
      pixel.color = color;
      pixel.price = price;
      pixel.ownerId = ownerId;
      pixel.ownerName = ownerName;
      pixel.lastUpdated = new Date();
      await pixel.save();
    }

    res.json({ pixel });
  } catch (err) {
    console.error('Error updating pixel:', err);
    res.status(500).json({ message: 'Server error' });
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

// Helper function to get configuration
async function getConfig() {
  return PIXEL_CONFIG;
}

module.exports = router; 