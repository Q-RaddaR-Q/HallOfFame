const express = require('express');
const router = express.Router();
const Pixel = require('../models/Pixel');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
    const { x, y } = req.params;
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
    const { x, y, color, price, ownerId, paymentIntentId } = req.body;
    
    // Find existing pixel
    const existingPixel = await Pixel.findOne({
      where: { x, y }
    });

    // If pixel exists and new price is not at least 80 cents more, reject
    if (existingPixel && price <= existingPixel.price + 0.8) {
      return res.status(400).json({ 
        message: 'New price must be at least 80 cents more than current price',
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
      defaults: { color, price, ownerId }
    });

    if (!created) {
      pixel.color = color;
      pixel.price = price;
      pixel.ownerId = ownerId;
      pixel.lastUpdated = new Date();
      await pixel.save();
    }

    res.json({ pixel });
  } catch (err) {
    console.error('Error updating pixel:', err);
    res.status(500).json({ 
      message: err.message || 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
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
      const { x, y, color, ownerId } = metadata;
      
      if (!x || !y || !color || !ownerId) {
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
        defaults: { color, price: amount / 100, ownerId }
      });

      if (!created) {
        pixel.color = color;
        pixel.price = amount / 100;
        pixel.ownerId = ownerId;
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
    console.error('Error processing payment:', err);
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

module.exports = router; 