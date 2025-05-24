const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Pixel = require('../models/Pixel');
const { PIXEL_CONFIG } = require('../config/constants');
const { Op } = require('sequelize');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const PixelHistory = require('../models/PixelHistory');

// Create a temporary table for bulk payment pixels
const BulkPaymentPixels = require('../models/BulkPaymentPixels');

// Create a payment intent for coloring pixels
router.post('/create-payment-intent', async (req, res) => {
  try {
    console.log('=== Payment Intent Creation Request ===');
    console.log('Request headers:', req.headers);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Stripe secret key configured:', !!process.env.STRIPE_SECRET_KEY);
    
    const { x, y, color, price, ownerId, ownerName } = req.body;
    
    // Validate all required fields
    const missingFields = [];
    if (x === undefined || x === null || x === '') missingFields.push('x');
    if (y === undefined || y === null || y === '') missingFields.push('y');
    if (!color) missingFields.push('color');
    if (!ownerId) missingFields.push('ownerId');
    if (!price) missingFields.push('price');
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return res.status(400).json({ 
        message: 'Missing required fields',
        error: `The following fields are required: ${missingFields.join(', ')}`,
        missingFields
      });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('Stripe secret key is not configured');
      return res.status(500).json({ 
        message: 'Stripe secret key is not configured',
        error: 'Please configure STRIPE_SECRET_KEY in your environment variables'
      });
    }

    // Validate price is a number and greater than 0
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      console.error('Invalid price:', price);
      return res.status(400).json({
        message: 'Invalid price',
        error: 'Price must be a positive number',
        receivedPrice: price
      });
    }

    // Check if pixel exists and validate minimum bid
    const existingPixel = await Pixel.findOne({
      where: { x, y }
    });

    if (existingPixel) {
      const minBid = existingPixel.price + PIXEL_CONFIG.minPrice;
      if (priceNum < minBid) {
        return res.status(400).json({
          message: 'Bid too low',
          error: `Bid must be at least $${minBid.toFixed(2)} to take over this pixel`,
          minimumBid: minBid,
          currentPrice: existingPixel.price
        });
      }
    } else if (priceNum < PIXEL_CONFIG.minPrice) {
      return res.status(400).json({
        message: 'Bid too low',
        error: `Bid must be at least $${PIXEL_CONFIG.minPrice} to place a new pixel`,
        minimumBid: PIXEL_CONFIG.minPrice
      });
    }

    // Create a PaymentIntent with the order amount and currency
    const paymentIntentData = {
      amount: Math.round(priceNum * 100), // Convert to cents
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        x: x.toString(),
        y: y.toString(),
        color,
        ownerId,
        ownerName
      }
    };

    console.log('Creating Stripe payment intent with:', paymentIntentData);

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    console.log('Payment intent created successfully:', {
      id: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status
    });

    // Return only the client secret
    res.json({
      clientSecret: paymentIntent.client_secret
    });
  } catch (err) {
    console.error('=== Payment Intent Creation Error ===');
    console.error('Error details:', {
      message: err.message,
      type: err.type,
      code: err.code,
      param: err.param,
      stack: err.stack
    });
    res.status(500).json({ 
      message: 'Error creating payment intent',
      error: err.message,
      details: {
        type: err.type,
        code: err.code,
        param: err.param
      }
    });
  }
});

// Create a bulk payment intent for multiple pixels
router.post('/create-bulk-payment-intent', async (req, res) => {
  try {
    const { pixels, totalAmount, ownerId, ownerName } = req.body;
    const totalAmountNum = parseFloat(totalAmount);
    let expectedTotal = 0;

    console.log('=== Bulk Payment Intent Creation Request ===');
    console.log('Request body:', {
      totalAmount,
      totalAmountNum,
      ownerId,
      ownerName,
      pixelCount: pixels.length,
      withSecurity: pixels[0]?.withSecurity
    });

    // Validate input
    if (!Array.isArray(pixels) || pixels.length === 0) {
<<<<<<< HEAD
<<<<<<< HEAD
      console.error('Invalid pixels data: not an array or empty');
      return res.status(400).json({ 
=======
      return res.status(400).json({
>>>>>>> parent of 818ab7e (FixedSomeIssues(Buying in bulk doesnt work with protected)
=======
      return res.status(400).json({
>>>>>>> parent of 818ab7e (FixedSomeIssues(Buying in bulk doesnt work with protected)
        message: 'Invalid pixels data',
        error: 'Pixels must be a non-empty array'
      });
    }

    if (!ownerId || !ownerName) {
      console.error('Missing required fields:', { ownerId, ownerName });
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'ownerId and ownerName are required'
      });
    }

    // Generate a unique session ID for this bulk payment
    const sessionId = uuidv4();

    // Store pixels in the temporary table
    await BulkPaymentPixels.bulkCreate(
      pixels.map(pixel => ({
        sessionId,
        x: pixel.x,
        y: pixel.y,
        color: pixel.color,
        price: pixel.price,
        withSecurity: pixel.withSecurity
      }))
    );

    // Create a PaymentIntent with the total amount
    const paymentIntentData = {
      amount: Math.round(totalAmountNum * 100), // Convert to cents
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        ownerId,
        ownerName,
        pixelCount: pixels.length,
        withSecurity: pixels[0].withSecurity ? 'true' : 'false',
        baseAmount: (totalAmountNum / (pixels[0].withSecurity ? 4 : 1)).toFixed(2),
        sessionId // Store the session ID in metadata
      }
    };

    console.log('Creating Stripe bulk payment intent with:', paymentIntentData);

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    console.log('Bulk payment intent created successfully:', {
      id: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      metadata: paymentIntent.metadata
    });

    // Return only the client secret
    res.json({
      clientSecret: paymentIntent.client_secret
    });
  } catch (err) {
    console.error('=== Bulk Payment Intent Creation Error ===');
    console.error('Error details:', {
      message: err.message,
      type: err.type,
      code: err.code,
      param: err.param,
      stack: err.stack
    });
    res.status(500).json({ 
      message: 'Error creating bulk payment intent',
      error: err.message,
      details: {
        type: err.type,
        code: err.code,
        param: err.param
      }
    });
  }
});

// Webhook to handle successful payments
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  console.log('Webhook received - Raw body:', req.body.toString());
  console.log('Webhook headers:', req.headers);
  
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    console.error('No Stripe signature found in headers');
    return res.status(400).send('No Stripe signature found in headers');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('Webhook event constructed successfully:', event.type);
    console.log('Event data:', JSON.stringify(event.data, null, 2));
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    console.error('Webhook secret used:', process.env.STRIPE_WEBHOOK_SECRET);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle different event types
  try {
    switch (event.type) {
      case 'payment_intent.created':
        console.log('Payment intent created:', event.data.object.id);
        break;
        
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('Payment intent succeeded:', paymentIntent.id);
        
        // Check if this is a bulk payment
        if (paymentIntent.metadata.pixelCount) {
          try {
            const { ownerId, ownerName, withSecurity, sessionId } = paymentIntent.metadata;
            
            if (!ownerId || !ownerName || !sessionId) {
              console.error('Invalid bulk payment metadata:', paymentIntent.id);
              break;
            }

            // Get the pixels from the temporary table
            const pixels = await BulkPaymentPixels.findAll({
              where: { sessionId }
            });
            
            if (!pixels || pixels.length === 0) {
              console.error('No pixels found for session:', sessionId);
              break;
            }

            console.log('Processing bulk payment pixels:', {
              paymentIntentId: paymentIntent.id,
              pixelCount: pixels.length,
              withSecurity
            });

            // Update each pixel
            for (const pixel of pixels) {
              const [existingPixel, created] = await Pixel.findOrCreate({
                where: { x: pixel.x, y: pixel.y },
                defaults: {
                  color: pixel.color,
                  price: pixel.price,
                  ownerId,
                  ownerName,
                  paymentIntentId: paymentIntent.id,
                  isSecured: withSecurity === 'true',
                  securityExpiresAt: withSecurity === 'true' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
                  lastUpdated: new Date()
                }
              });

              if (!created) {
                await existingPixel.update({
                  color: pixel.color,
                  price: pixel.price,
                  ownerId,
                  ownerName,
                  paymentIntentId: paymentIntent.id,
                  isSecured: withSecurity === 'true',
                  securityExpiresAt: withSecurity === 'true' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
                  lastUpdated: new Date()
                });
              }

              // Create history entry for this pixel
              await PixelHistory.create({
                x: pixel.x,
                y: pixel.y,
                color: pixel.color,
                price: pixel.price,
                ownerId,
                ownerName,
                paymentIntentId: paymentIntent.id,
                isSecured: withSecurity === 'true',
                securityExpiresAt: withSecurity === 'true' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null
              });

              console.log('Pixel updated:', {
                x: pixel.x,
                y: pixel.y,
                created,
                price: pixel.price,
                withSecurity
              });
            }

            // Clean up the temporary pixels
            await BulkPaymentPixels.destroy({
              where: { sessionId }
            });

            console.log('Bulk payment processed successfully:', {
              paymentIntentId: paymentIntent.id,
              pixelCount: pixels.length
            });
          } catch (err) {
            console.error('Error processing bulk payment:', err);
          }
        } else {
          // Handle single pixel payment (existing code)
          const { x, y, color, ownerId, ownerName } = paymentIntent.metadata;
          if (!x || !y || !color || !ownerId || !ownerName) {
            console.error('Missing required metadata in payment intent:', paymentIntent.id);
            break;
          }

          try {
            // Convert x and y to numbers
            const pixelX = parseInt(x, 10);
            const pixelY = parseInt(y, 10);
            
            if (isNaN(pixelX) || isNaN(pixelY)) {
              console.error('Invalid coordinates in payment intent:', { x, y });
              break;
            }

            // Find existing pixel or create new one
            const [pixel, created] = await Pixel.findOrCreate({
              where: { x: pixelX, y: pixelY },
              defaults: { 
                color, 
                price: paymentIntent.amount / 100, 
                ownerId, 
                ownerName,
                lastUpdated: new Date()
              }
            });

            if (!created) {
              // Update existing pixel
              await pixel.update({
                color,
                price: paymentIntent.amount / 100,
                ownerId,
                ownerName,
                lastUpdated: new Date()
              });
            }

            console.log('Pixel updated successfully:', { x: pixelX, y: pixelY, created });
          } catch (err) {
            console.error('Error updating pixel after payment:', err);
            // Don't break here, let the webhook acknowledge receipt
          }
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Error processing webhook event:', err);
    res.status(500).json({ error: 'Error processing webhook event' });
  }
});

module.exports = router; 