# Backend API

Express.js backend with CORS and JWT authentication.

## Features

- ✅ CORS enabled for frontend communication
- ✅ JWT authentication (register, login)
- ✅ Protected routes with authentication middleware
- ✅ Password hashing with bcryptjs
- ✅ Environment variable configuration

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:
   - Set `JWT_SECRET` to a strong random string
   - Set `FRONTEND_URL` to match your frontend URL
   - Set `PORT` if you want to use a different port (default: 5000)

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### Public Endpoints

- `GET /api/health` - Health check
- `POST /api/auth/register` - Register a new user
  - Body: `{ "username": "string", "email": "string", "password": "string" }`
- `POST /api/auth/login` - Login user
  - Body: `{ "email": "string", "password": "string" }`

### Protected Endpoints (Require JWT Token)

- `GET /api/protected/profile` - Get user profile
- `GET /api/protected/data` - Get protected data
- `PUT /api/protected/profile` - Update user profile

### Authentication

Protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Example Usage

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Access Protected Route
```bash
curl -X GET http://localhost:5000/api/protected/profile \
  -H "Authorization: Bearer <your-jwt-token>"
```

## Notes

- Currently uses in-memory user storage. Replace with a database (MongoDB, PostgreSQL, etc.) for production.
- Change the `JWT_SECRET` in production to a strong random string.
- Adjust CORS settings in `server.js` for production deployment.

