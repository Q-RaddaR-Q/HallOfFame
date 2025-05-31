# Hall of Fame Project Documentation

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

## Project Overview

The Hall of Fame project is a full-stack web application that provides a platform for showcasing and managing notable achievements and contributions. The application features a modern, responsive user interface and robust backend services.

### Key Features
- User authentication and authorization
- Interactive achievement display
- Real-time updates
- Payment processing integration
- Responsive design
- Data visualization

## Architecture

The project follows a modern client-server architecture with clear separation of concerns:

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
- **Framework**: React 19.1.0 with TypeScript
- **UI Library**: Material-UI (MUI) 7.0.2
- **State Management**: React Hooks
- **HTTP Client**: Axios
- **Additional Libraries**:
  - react-colorful: For color picker functionality
  - react-zoom-pan-pinch: For interactive zoom features
  - date-fns: For date manipulation
  - Stripe: For payment processing

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite (development) / MySQL (production)
- **ORM**: Sequelize
- **API Documentation**: Swagger/OpenAPI
- **WebSocket**: ws for real-time features
- **Payment Processing**: Stripe integration

## Backend Documentation

### Server Structure
The backend follows a modular architecture with clear separation of concerns:

1. **Models**: Define database schema and relationships
2. **Routes**: Handle API endpoints and request processing
3. **Config**: Manage environment-specific configurations
4. **Migrations**: Handle database schema changes

### Key Features
- RESTful API endpoints
- WebSocket support for real-time updates
- Database migrations
- Input validation
- Error handling
- CORS support
- Swagger API documentation

## Frontend Documentation

### Component Structure
The frontend is built using React with TypeScript, following modern best practices:

1. **Components**: Reusable UI elements
2. **Services**: API integration and data fetching
3. **Styles**: CSS modules and Material-UI theming

### Key Features
- Responsive design
- Material-UI components
- TypeScript type safety
- Real-time updates
- Interactive visualizations
- Payment integration

## Database Schema

The application uses Sequelize ORM with the following main models:

1. **Users**
   - Authentication and user management
   - Profile information
   - Role-based access control

2. **Achievements**
   - Achievement details
   - Categories and tags
   - Media attachments

3. **Transactions**
   - Payment records
   - Subscription management
   - Transaction history

## API Documentation

The API follows RESTful principles and is documented using Swagger/OpenAPI. Key endpoints include:

### Authentication
- POST /api/auth/login
- POST /api/auth/register
- GET /api/auth/profile

### Achievements
- GET /api/achievements
- POST /api/achievements
- PUT /api/achievements/:id
- DELETE /api/achievements/:id

### Users
- GET /api/users
- GET /api/users/:id
- PUT /api/users/:id

### Payments
- POST /api/payments/create-intent
- POST /api/payments/confirm

## Development Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- SQLite (development)
- MySQL (production)

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

4. Run database migrations
```bash
cd server
npm run migrate
```

5. Start development servers
```bash
# Start backend server
cd server
npm run dev

# Start frontend server
cd client
npm start
```

## Deployment

The application can be deployed using various methods:

### Backend Deployment
1. Set up a Node.js environment
2. Configure environment variables
3. Run database migrations
4. Start the server using PM2 or similar process manager

### Frontend Deployment
1. Build the React application
```bash
cd client
npm run build
```
2. Deploy the build folder to a static hosting service

### Database Deployment
1. Set up MySQL database
2. Run migrations
3. Configure connection settings

## Testing

The project includes comprehensive testing setup:

### Backend Testing
- Jest for unit testing
- Supertest for API testing
- Test coverage reporting

### Frontend Testing
- Jest for unit testing
- React Testing Library for component testing
- End-to-end testing capabilities

### Running Tests
```bash
# Backend tests
cd server
npm test

# Frontend tests
cd client
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

[Specify your license here]

---

This documentation is maintained by the development team. For questions or support, please contact [contact information]. 