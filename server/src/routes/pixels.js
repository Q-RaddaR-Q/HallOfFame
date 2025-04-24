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

    // Create payment intent if needed
    if (price > 0) {
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ 
          message: 'Stripe secret key is not configured',
          error: 'Please configure STRIPE_SECRET_KEY in your environment variables'
        });
      }

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(price * 100), // Convert to cents
          currency: 'usd',
          metadata: {
            x,
            y,
            color,
            ownerId
          }
        });

        return res.json({
          clientSecret: paymentIntent.client_secret,
          currentPrice: existingPixel ? existingPixel.price : 0,
          paymentIntentId: paymentIntent.id
        });
      } catch (stripeError) {
        console.error('Stripe error:', stripeError);
        return res.status(500).json({ 
          message: 'Error creating payment intent',
          error: stripeError.message
        });
      }
    }

    // If no payment needed (free pixels), update directly
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

    res.json(pixel);
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
    const { paymentIntentId } = req.body;
    
    if (!paymentIntentId) {
      return res.status(400).json({ 
        message: 'Payment intent ID is required',
        error: 'Please provide a valid payment intent ID'
      });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ 
        message: 'Stripe secret key is not configured',
        error: 'Please configure STRIPE_SECRET_KEY in your environment variables'
      });
    }

    try {
      // Extract the payment intent ID from the client secret if needed
      const actualPaymentIntentId = paymentIntentId.includes('_secret_') 
        ? paymentIntentId.split('_secret_')[0] 
        : paymentIntentId;

      const paymentIntent = await stripe.paymentIntents.retrieve(actualPaymentIntentId);
      
      if (!paymentIntent) {
        return res.status(404).json({ 
          message: 'Payment intent not found',
          error: 'The provided payment intent ID does not exist'
        });
      }

      if (paymentIntent.status === 'succeeded') {
        const { x, y, color, ownerId } = paymentIntent.metadata;
        
        const [pixel, created] = await Pixel.findOrCreate({
          where: { x, y },
          defaults: { color, price: paymentIntent.amount / 100, ownerId }
        });

        if (!created) {
          pixel.color = color;
          pixel.price = paymentIntent.amount / 100;
          pixel.ownerId = ownerId;
          pixel.lastUpdated = new Date();
          await pixel.save();
        }

        return res.json({
          pixel,
          message: 'Payment successful and pixel updated'
        });
      } else {
        return res.status(400).json({ 
          message: 'Payment not successful',
          status: paymentIntent.status,
          error: `Payment intent is in ${paymentIntent.status} status. It needs to be 'succeeded' to update the pixel.`
        });
      }
    } catch (stripeError) {
      console.error('Stripe error:', stripeError);
      return res.status(500).json({ 
        message: 'Error processing payment',
        error: stripeError.message
      });
    }
  } catch (err) {
    console.error('Error processing payment:', err);
    res.status(500).json({ 
      message: err.message || 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

module.exports = router; 