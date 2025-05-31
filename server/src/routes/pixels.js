const express = require('express');
const router = express.Router();
const Pixel = require('../models/Pixel');
const PixelHistory = require('../models/PixelHistory');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PIXEL_CONFIG } = require('../config/constants');
const WebSocket = require('ws');

/**
 * @swagger
 * /api/pixels:
 *   get:
 *     summary: Get all pixels
 *     tags: [Pixels]
 *     responses:
 *       200:
 *         description: List of all pixels
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Pixel'
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res) => {
  try {
    const pixels = await Pixel.findAll();
    res.json(pixels);
  } catch (err) {
    console.error('Error fetching pixels:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/pixels/{x}/{y}:
 *   get:
 *     summary: Get pixel by coordinates
 *     tags: [Pixels]
 *     parameters:
 *       - in: path
 *         name: x
 *         required: true
 *         schema:
 *           type: integer
 *         description: X coordinate
 *       - in: path
 *         name: y
 *         required: true
 *         schema:
 *           type: integer
 *         description: Y coordinate
 *     responses:
 *       200:
 *         description: Pixel found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Pixel'
 *       400:
 *         description: Invalid coordinates
 *       404:
 *         description: Pixel not found
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/pixels:
 *   post:
 *     summary: Create or update a pixel
 *     tags: [Pixels]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - x
 *               - y
 *               - color
 *               - price
 *               - ownerId
 *               - ownerName
 *             properties:
 *               x:
 *                 type: integer
 *                 description: X coordinate
 *               y:
 *                 type: integer
 *                 description: Y coordinate
 *               color:
 *                 type: string
 *                 description: Color of the pixel
 *               price:
 *                 type: number
 *                 description: Price of the pixel
 *               ownerId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the pixel owner
 *               ownerName:
 *                 type: string
 *                 description: Name of the pixel owner
 *               link:
 *                 type: string
 *                 description: Optional link associated with the pixel
 *               withSecurity:
 *                 type: boolean
 *                 description: Whether to secure the pixel
 *               paymentIntentId:
 *                 type: string
 *                 description: Stripe payment intent ID
 *     responses:
 *       200:
 *         description: Pixel created or updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pixel:
 *                   $ref: '#/components/schemas/Pixel'
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing required fields or invalid payment
 *       500:
 *         description: Server error
 */
router.post('/', async (req, res) => {
  try {
    const { x, y, color, price, ownerId, ownerName, paymentIntentId, link, withSecurity } = req.body;

    // Validate required fields
    if (x === undefined || y === undefined || !color || !price || !ownerId || !ownerName) {
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'x, y, color, price, ownerId, and ownerName are required'
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

    // Calculate security expiration if security option is chosen
    let securityExpiresAt = null;
    if (withSecurity) {
      securityExpiresAt = new Date();
      securityExpiresAt.setDate(securityExpiresAt.getDate() + 7); // Add 7 days
    }

    // Find existing pixel
    const existingPixel = await Pixel.findOne({
      where: { x, y }
    });

    // If pixel exists, save its current state to history
    if (existingPixel) {
      await PixelHistory.create({
        x: existingPixel.x,
        y: existingPixel.y,
        color: existingPixel.color,
        price: existingPixel.price,
        ownerId: existingPixel.ownerId,
        ownerName: existingPixel.ownerName,
        link: existingPixel.link,
        isSecured: existingPixel.isSecured,
        securityExpiresAt: existingPixel.securityExpiresAt,
        paymentIntentId: existingPixel.paymentIntentId
      });

      console.log('Saved pixel history:', {
        x: existingPixel.x,
        y: existingPixel.y,
        color: existingPixel.color,
        price: existingPixel.price,
        ownerName: existingPixel.ownerName,
        link: existingPixel.link,
        isSecured: existingPixel.isSecured,
        securityExpiresAt: existingPixel.securityExpiresAt
      });
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

  } catch (err) {
    console.error('Error updating pixel:', err);
    res.status(500).json({ 
      message: 'Error updating pixel',
      error: err.message 
    });
  }
});

/**
 * @swagger
 * /api/pixels/payment-success:
 *   post:
 *     summary: Handle successful payment for a pixel
 *     tags: [Pixels]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - amount
 *               - status
 *               - metadata
 *             properties:
 *               id:
 *                 type: string
 *                 description: Payment intent ID
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *               status:
 *                 type: string
 *                 description: Payment status
 *               metadata:
 *                 type: object
 *                 properties:
 *                   x:
 *                     type: string
 *                     description: X coordinate
 *                   y:
 *                     type: string
 *                     description: Y coordinate
 *                   color:
 *                     type: string
 *                     description: Pixel color
 *                   ownerId:
 *                     type: string
 *                     description: Owner ID
 *                   ownerName:
 *                     type: string
 *                     description: Owner name
 *     responses:
 *       200:
 *         description: Payment processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pixel:
 *                   $ref: '#/components/schemas/Pixel'
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid payment data
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/pixels/free-count/{browserId}:
 *   get:
 *     summary: Get free pixel count for a user
 *     tags: [Pixels]
 *     parameters:
 *       - in: path
 *         name: browserId
 *         required: true
 *         schema:
 *           type: string
 *         description: Browser ID of the user
 *     responses:
 *       200:
 *         description: Free pixel count
 *         content:
 *           application/json:
 *             schema:
 *               type: number
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/pixels/config:
 *   get:
 *     summary: Get pixel configuration
 *     tags: [Pixels]
 *     responses:
 *       200:
 *         description: Pixel configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 minPrice:
 *                   type: number
 *                   description: Minimum price for a pixel
 *                 gridSize:
 *                   type: object
 *                   properties:
 *                     width:
 *                       type: number
 *                     height:
 *                       type: number
 *       500:
 *         description: Server error
 */
router.get('/config', async (req, res) => {
  try {
    res.json(PIXEL_CONFIG);
  } catch (error) {
    console.error('Error getting pixel configuration:', error);
    res.status(500).json({ error: 'Failed to get pixel configuration' });
  }
});

/**
 * @swagger
 * /api/pixels/{x}/{y}:
 *   put:
 *     summary: Update a pixel
 *     tags: [Pixels]
 *     parameters:
 *       - in: path
 *         name: x
 *         required: true
 *         schema:
 *           type: integer
 *         description: X coordinate
 *       - in: path
 *         name: y
 *         required: true
 *         schema:
 *           type: integer
 *         description: Y coordinate
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - color
 *               - price
 *               - ownerId
 *               - ownerName
 *             properties:
 *               color:
 *                 type: string
 *                 description: New color for the pixel
 *               price:
 *                 type: number
 *                 description: New price for the pixel
 *               ownerId:
 *                 type: string
 *                 format: uuid
 *                 description: New owner ID
 *               ownerName:
 *                 type: string
 *                 description: New owner name
 *     responses:
 *       200:
 *         description: Pixel updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Pixel'
 *       400:
 *         description: Invalid input or price too low
 *       404:
 *         description: Pixel not found
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/pixels/{x}/{y}/link:
 *   put:
 *     summary: Update pixel link
 *     tags: [Pixels]
 *     parameters:
 *       - in: path
 *         name: x
 *         required: true
 *         schema:
 *           type: integer
 *         description: X coordinate
 *       - in: path
 *         name: y
 *         required: true
 *         schema:
 *           type: integer
 *         description: Y coordinate
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - link
 *             properties:
 *               link:
 *                 type: string
 *                 description: New link for the pixel
 *     responses:
 *       200:
 *         description: Link updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Pixel'
 *       400:
 *         description: Invalid coordinates
 *       404:
 *         description: Pixel not found
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/pixels/{x}/{y}/history:
 *   get:
 *     summary: Get pixel history
 *     tags: [Pixels]
 *     parameters:
 *       - in: path
 *         name: x
 *         required: true
 *         schema:
 *           type: integer
 *         description: X coordinate
 *       - in: path
 *         name: y
 *         required: true
 *         schema:
 *           type: integer
 *         description: Y coordinate
 *     responses:
 *       200:
 *         description: Pixel history
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   x:
 *                     type: integer
 *                   y:
 *                     type: integer
 *                   color:
 *                     type: string
 *                   price:
 *                     type: number
 *                   ownerId:
 *                     type: string
 *                     format: uuid
 *                   ownerName:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       500:
 *         description: Server error
 */
router.get('/:x/:y/history', async (req, res) => {
  try {
    const { x, y } = req.params;
    
    const history = await PixelHistory.findAll({
      where: { x, y },
      order: [['createdAt', 'DESC']]
    });

    res.json(history);
  } catch (err) {
    console.error('Error fetching pixel history:', err);
    res.status(500).json({ 
      message: 'Error fetching pixel history',
      error: err.message 
    });
  }
});

// Helper function to get configuration
async function getConfig() {
  return PIXEL_CONFIG;
}

module.exports = router; 