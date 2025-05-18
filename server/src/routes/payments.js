const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Pixel = require('../models/Pixel');
const { PIXEL_CONFIG } = require('../config/constants');
const { Op } = require('sequelize');
const WebSocket = require('ws');

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

    // Validate input
    if (!Array.isArray(pixels) || pixels.length === 0) {
      return res.status(400).json({ 
        message: 'Invalid pixels data',
        error: 'Pixels must be a non-empty array'
      });
    }

    if (!ownerId || !ownerName) {
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'ownerId and ownerName are required'
      });
    }

    // Check each pixel
    for (const pixel of pixels) {
      if (!pixel.x || !pixel.y || !pixel.color || !pixel.price) {
        return res.status(400).json({
          message: 'Invalid pixel data',
          error: 'Each pixel must have x, y, color, and price properties'
        });
      }

      // Check if pixel exists and validate minimum bid
      const existingPixel = await Pixel.findOne({
        where: { x: pixel.x, y: pixel.y }
      });

      if (existingPixel) {
        // Check if pixel is secured and not expired
        if (existingPixel.isSecured && existingPixel.securityExpiresAt > new Date()) {
          return res.status(400).json({
            message: 'Pixel is secured',
            error: `Pixel at (${pixel.x}, ${pixel.y}) is secured until ${existingPixel.securityExpiresAt}`,
            securedUntil: existingPixel.securityExpiresAt
          });
        }

        const minBid = existingPixel.price + PIXEL_CONFIG.minPrice;
        if (pixel.price < minBid) {
          return res.status(400).json({
            message: 'Bid too low',
            error: `Bid must be at least $${minBid.toFixed(2)} to take over pixel at (${pixel.x}, ${pixel.y})`,
            minimumBid: minBid,
            currentPrice: existingPixel.price,
            pixel: { x: pixel.x, y: pixel.y }
          });
        }
      } else if (pixel.price < PIXEL_CONFIG.minPrice) {
        return res.status(400).json({
          message: 'Bid too low',
          error: `Bid must be at least $${PIXEL_CONFIG.minPrice} to place a new pixel at (${pixel.x}, ${pixel.y})`,
          minimumBid: PIXEL_CONFIG.minPrice,
          pixel: { x: pixel.x, y: pixel.y }
        });
      }

      expectedTotal += pixel.price;
    }

    // Verify that the provided total amount matches the sum of individual pixel prices
    if (Math.abs(expectedTotal - totalAmountNum) > 0.01) {
      return res.status(400).json({
        message: 'Total amount mismatch',
        error: `Total amount (${totalAmountNum}) does not match sum of individual pixel prices (${expectedTotal})`
      });
    }

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
        withSecurity: pixels[0].withSecurity ? 'true' : 'false' // Store security preference
      }
    };

    console.log('Creating Stripe bulk payment intent with:', paymentIntentData);

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    // Store the pixel data in our database with the payment intent ID
    try {
      // First check which pixels already exist
      const existingPixels = await Pixel.findAll({
        where: {
          [Op.or]: pixels.map(pixel => ({
            x: pixel.x,
            y: pixel.y
          }))
        }
      });

      // Create a map of existing pixels for quick lookup
      const existingPixelMap = new Map(
        existingPixels.map(pixel => [`${pixel.x},${pixel.y}`, pixel])
      );

      // Calculate security expiration if security option is chosen
      let securityExpiresAt = null;
      if (pixels[0].withSecurity) {
        securityExpiresAt = new Date();
        securityExpiresAt.setDate(securityExpiresAt.getDate() + 7); // Add 7 days
      }

      // Prepare new pixels array
      const newPixels = pixels.map(pixel => {
        const existingPixel = existingPixelMap.get(`${pixel.x},${pixel.y}`);
        if (existingPixel) {
          return {
            ...existingPixel.toJSON(),
            color: pixel.color,
            price: pixel.price,
            ownerId,
            ownerName,
            lastUpdated: new Date(),
            isSecured: pixel.withSecurity,
            securityExpiresAt: pixel.withSecurity ? securityExpiresAt : null
          };
        }
        return {
          x: pixel.x,
          y: pixel.y,
          color: pixel.color,
          price: pixel.price,
          ownerId,
          ownerName,
          lastUpdated: new Date(),
          isSecured: pixel.withSecurity,
          securityExpiresAt: pixel.withSecurity ? securityExpiresAt : null
        };
      });

      // Update or create pixels
      await Pixel.bulkCreate(newPixels, {
        updateOnDuplicate: ['color', 'price', 'ownerId', 'ownerName', 'lastUpdated', 'isSecured', 'securityExpiresAt']
      });

      // Broadcast updates for each pixel
      if (global.wss) {
        for (const pixel of newPixels) {
          const message = JSON.stringify({
            type: 'pixelUpdate',
            pixel: {
              x: pixel.x,
              y: pixel.y,
              color: pixel.color,
              price: pixel.price,
              ownerId: pixel.ownerId,
              ownerName: pixel.ownerName,
              lastUpdated: pixel.lastUpdated,
              isSecured: pixel.isSecured,
              securityExpiresAt: pixel.securityExpiresAt
            }
          });

          global.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(message);
            }
          });
        }
      }

      console.log('Bulk payment intent created successfully:', {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
        newPixels: newPixels.length,
        updatedPixels: pixels.length
      });

      // Return only the client secret
      res.json({
        clientSecret: paymentIntent.client_secret
      });
    } catch (err) {
      console.error('Error storing pixel data:', err);
      res.status(500).json({ error: 'Error storing pixel data' });
    }
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
            const { ownerId, ownerName } = paymentIntent.metadata;
            
            if (!ownerId || !ownerName) {
              console.error('Invalid bulk payment metadata:', paymentIntent.id);
              break;
            }

            // Find all pixels associated with this payment intent
            const pixels = await Pixel.findAll({
              where: { paymentIntentId: paymentIntent.id }
            });

            // Each pixel already has its correct price stored, no need to recalculate
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