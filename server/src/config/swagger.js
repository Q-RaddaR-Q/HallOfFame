const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hall of Fame API',
      version: '1.0.0',
      description: 'API documentation for the Internet Hall of Fame application',
    },
    servers: [
      {
        url: process.env.REACT_APP_API_URL || 'http://localhost:5000',
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        Pixel: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            x: { type: 'integer' },
            y: { type: 'integer' },
            color: { type: 'string' },
            userId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            status: { type: 'string' },
            userId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'], // Path to the API routes
};

const specs = swaggerJsdoc(options);

module.exports = specs; 