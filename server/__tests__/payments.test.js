const request = require('supertest');
const express = require('express');
const app = express();
const paymentsRouter = require('../src/routes/payments');
const Pixel = require('../src/models/Pixel');
const stripe = require('stripe');

// Mock the database models
jest.mock('../src/models/Pixel', () => ({
  findOne: jest.fn(),
  findAll: jest.fn(),
}));

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'test_id',
        client_secret: 'test_secret',
        status: 'succeeded'
      }),
      retrieve: jest.fn(),
    },
  }));
});

// Setup express app
app.use(express.json());
app.use('/api/payments', paymentsRouter);

describe('Payments API', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'test_key';
  });

  describe('POST /api/payments/create-payment-intent', () => {
    const validRequest = {
      x: 0,
      y: 0,
      color: '#000000',
      price: 10,
      ownerId: '123',
      ownerName: 'Test User'
    };

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/payments/create-payment-intent')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Missing required fields');
    });

    it('should return 400 for bid too low', async () => {
      Pixel.findOne.mockResolvedValue({
        price: 10
      });

      const response = await request(app)
        .post('/api/payments/create-payment-intent')
        .send({
          ...validRequest,
          price: 5
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Bid too low');
    });
  });

  describe('POST /api/payments/create-bulk-payment-intent', () => {
    const validRequest = {
      pixels: [
        { x: 0, y: 0, color: '#000000', price: 10 },
        { x: 1, y: 1, color: '#FFFFFF', price: 10 }
      ],
      totalAmount: 20,
      ownerId: '123',
      ownerName: 'Test User'
    };

    it('should return 400 for invalid pixels data', async () => {
      const response = await request(app)
        .post('/api/payments/create-bulk-payment-intent')
        .send({
          ...validRequest,
          pixels: []
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Invalid pixels data');
    });
  });
}); 