const request = require('supertest');
const express = require('express');
const app = express();
const pixelsRouter = require('../src/routes/pixels');
const Pixel = require('../src/models/Pixel');

// Mock the database models
jest.mock('../src/models/Pixel', () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  findOrCreate: jest.fn(),
}));

// Mock WebSocket
global.wss = {
  clients: new Set(),
};

// Setup express app
app.use(express.json());
app.use('/api/pixels', pixelsRouter);

describe('Pixels API', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('GET /api/pixels', () => {
    it('should return all pixels', async () => {
      const mockPixels = [
        { id: 1, x: 0, y: 0, color: '#000000' },
        { id: 2, x: 1, y: 1, color: '#FFFFFF' },
      ];

      Pixel.findAll.mockResolvedValue(mockPixels);

      const response = await request(app)
        .get('/api/pixels')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual(mockPixels);
      expect(Pixel.findAll).toHaveBeenCalledTimes(1);
    });

    it('should handle server errors', async () => {
      Pixel.findAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/pixels')
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body).toHaveProperty('message', 'Server error');
    });
  });

  describe('GET /api/pixels/:x/:y', () => {
    it('should return a pixel by coordinates', async () => {
      const mockPixel = { id: 1, x: 0, y: 0, color: '#000000' };
      Pixel.findOne.mockResolvedValue(mockPixel);

      const response = await request(app)
        .get('/api/pixels/0/0')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual(mockPixel);
      expect(Pixel.findOne).toHaveBeenCalledWith({
        where: { x: 0, y: 0 }
      });
    });

    it('should return 404 for non-existent pixel', async () => {
      Pixel.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/pixels/999/999')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Pixel not found');
    });

    it('should return 400 for invalid coordinates', async () => {
      const response = await request(app)
        .get('/api/pixels/invalid/invalid')
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Invalid coordinates');
    });
  });

  describe('GET /api/pixels/config', () => {
    it('should return pixel configuration', async () => {
      const response = await request(app)
        .get('/api/pixels/config')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('minPrice');
      expect(response.body).toHaveProperty('maxPixels');
      expect(response.body).toHaveProperty('processingFee');
    });
  });
}); 