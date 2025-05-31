# Internet Hall of Fame Project Documentation

## Live Demo
The application is currently deployed and can be accessed at: [https://halloffame-production.up.railway.app/](https://halloffame-production.up.railway.app/)

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Backend Documentation](#backend-documentation)
5. [Frontend Documentation](#frontend-documentation)
6. [Database Schema](#database-schema)
7. [API Documentation](#api-documentation)
8. [Development Setup](#development-setup)
9. [Deployment](#deployment)
10. [Testing](#testing)
11. [Docker Support](#docker-support)

## Project Overview

The Internet Hall of Fame project is a full-stack web application that provides a platform for users to place and manage pixels on a shared canvas. The application features real-time updates, payment processing, and a modern user interface.

### Key Features
- Interactive pixel canvas
- Real-time updates using WebSocket
- Payment processing with Stripe
- User authentication
- Pixel placement and management
- Color customization

## Architecture

The project follows a modern client-server architecture:

```
HallOfFame/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── services/      # API services
│   │   └── ...
│   └── public/            # Static assets
└── server/                # Backend Node.js application
    ├── src/
    │   ├── config/       # Configuration files
    │   ├── models/       # Database models
    │   ├── routes/       # API routes
    │   └── migrations/   # Database migrations
    └── __tests__/        # Test files
```

## Technology Stack

### Frontend
- **Framework**: React with TypeScript
- **UI Library**: Material-UI (MUI)
- **State Management**: React Hooks
- **HTTP Client**: Axios
- **Additional Libraries**:
  - react-colorful: For color picker functionality
  - react-zoom-pan-pinch: For interactive canvas features
  - Stripe: For payment processing

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite
- **ORM**: Sequelize
- **API Documentation**: Swagger/OpenAPI
- **WebSocket**: ws for real-time updates
- **Payment Processing**: Stripe integration

## Backend Documentation

### Server Structure
The backend follows a modular architecture:

1. **Models**: Define database schema and relationships
2. **Routes**: Handle API endpoints and request processing
3. **Config**: Manage environment-specific configurations
4. **Migrations**: Handle database schema changes

### Key Features
- RESTful API endpoints
- WebSocket support for real-time pixel updates
- SQLite database with Sequelize ORM
- Input validation
- Error handling
- CORS support
- Swagger API documentation

## Frontend Documentation

### Component Structure
The frontend is built using React with TypeScript:

1. **Components**: Reusable UI elements
2. **Services**: API integration and data fetching
3. **Styles**: CSS modules and Material-UI theming

### Key Features
- Interactive pixel canvas
- Real-time updates via WebSocket
- Color picker for pixel customization
- Payment integration
- Responsive design

## Database Schema

The application uses SQLite with Sequelize ORM. Main models include:

1. **Pixels**
   - id (UUID)
   - x (integer)
   - y (integer)
   - color (string)
   - userId (UUID)
   - timestamps

2. **Payments**
   - id (UUID)
   - amount (number)
   - currency (string)
   - status (string)
   - userId (UUID)
   - timestamps

## API Documentation

The API is documented using Swagger/OpenAPI. Key endpoints include:

### Pixels
- GET /api/pixels - Get all pixels
- POST /api/pixels - Place a new pixel
- PUT /api/pixels/:id - Update a pixel
- DELETE /api/pixels/:id - Delete a pixel

### Payments
- POST /api/payments/create-intent - Create payment intent
- POST /api/payments/webhook - Handle Stripe webhooks

Check out the full Swagger/OpenAPI documentation here: [https://halloffame-production.up.railway.app/api-docs/]

## Development Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- SQLite

### Installation Steps

1. Clone the repository
```bash
git clone [repository-url]
cd HallOfFame
```

2. Install dependencies
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

3. Set up environment variables
```bash
# Server
cp .env.example .env
# Edit .env with your configuration

# Client
cp .env.example .env
# Edit .env with your configuration
```

4. Start development servers
```bash
# Start backend server
cd server
npm run dev

# Start frontend server
cd client
npm start
```

## Docker Support

The application is containerized using Docker for consistent development and deployment environments.

### Docker Compose

For local development with both frontend and backend services:

```bash
docker compose up --build
```

This will start:
- Frontend service on port 3000
- Backend service on port 5000
- SQLite database

## Deployment

The application is deployed on Railway.app and can be accessed at [https://halloffame-production.up.railway.app/](https://halloffame-production.up.railway.app/)

### Backend Deployment
1. Set up a Node.js environment
2. Configure environment variables
3. Start the server using PM2 or similar process manager

### Frontend Deployment
1. Build the React application
```bash
cd client
npm run build
```
2. Deploy the build folder to a static hosting service

## Testing

The project includes testing setup:

### Backend Testing
- Jest for unit testing
- Supertest for API testing

### Frontend Testing
- Jest for unit testing
- React Testing Library for component testing

### Running Tests
```bash
# Backend tests
cd server
npm test

# Frontend tests
cd client
npm test
```

---

**Q-RaddaR-Q**