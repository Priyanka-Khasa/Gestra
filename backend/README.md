# Gestra Authentication Backend

This is the Node.js/Express backend server that handles user authentication and MongoDB database operations for the Gestra application.

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure MongoDB

You need to have MongoDB installed and running locally. If you don't have it:

**Windows users:**
- Download MongoDB Community Edition from https://www.mongodb.com/try/download/community
- Install and start the MongoDB service
- By default it runs on `mongodb://localhost:27017`

**Alternative - Use MongoDB Atlas (Cloud):**
- Visit https://www.mongodb.com/cloud/atlas
- Create a free account and cluster
- Get your connection string and update `.env` with it

### 3. Setup Environment Variables

Copy `.env.example` to `.env` and update values if needed:

```bash
copy .env.example .env
```

Edit `.env`:
```
MONGODB_URI=mongodb://localhost:27017/gestra
JWT_SECRET=your_jwt_secret_key_here_change_in_production
PORT=3001
NODE_ENV=development
```

**For production deployment, change:**
- `JWT_SECRET` to a strong random string
- `NODE_ENV` to `production`
- `MONGODB_URI` to your production MongoDB connection

### 4. Start the Server

**Development mode with auto-reload:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on http://localhost:3001

## API Endpoints

### Authentication Routes (`/api/v1/auth`)

#### Register
```
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}

Response:
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "_id": "...",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Login
```
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "_id": "...",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### Get Current User
```
GET /api/v1/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

Response:
{
  "success": true,
  "user": {
    "_id": "...",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### Logout
```
POST /api/v1/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

Response:
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### Health Check
```
GET /health

Response:
{
  "ok": true,
  "service": "gestra-auth-server"
}
```

## Running Frontend with Backend

To start both the frontend and backend servers together with auto-reload:

```bash
# From the root Gestra directory
npm run dev:full
```

This requires `concurrently` to be installed globally or as a dev dependency in the root package.json.

## Database Schema

### User Model
```javascript
{
  email: String (required, unique, lowercase),
  password: String (required, hashed with bcryptjs),
  name: String (required),
  createdAt: Date (default: now),
  lastLogin: Date (optional),
  updatedAt: Date (auto-updated)
}
```

## Security Notes

1. **Passwords**: All passwords are hashed using bcryptjs with 10 salt rounds before storing
2. **JWT**: Tokens expire after 7 days
3. **CORS**: Configured to allow requests from localhost during development
4. **Never commit `.env`**: Make sure to add it to `.gitignore`

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running: `mongosh` should connect
- Check if MONGODB_URI in .env is correct
- Ensure port 27017 is not blocked by firewall

### Port Already in Use
- Change PORT in .env to another available port (e.g., 3002)
- Or kill the process using port 3001: `netstat -ano | findstr :3001`

### JWT Secret Issues
- Ensure JWT_SECRET is set in .env
- Never use the default secret in production

## Future Enhancements

- [ ] Email verification
- [ ] Password reset functionality
- [ ] Refresh token rotation
- [ ] OAuth integration (Google, GitHub)
- [ ] Two-factor authentication
- [ ] User profile updates
- [ ] Token blacklisting for logout

## Architecture

```
backend/
├── server.js          - Express app setup and middleware
├── routes/
│   └── auth.js        - Authentication endpoints
├── models/
│   └── User.js        - MongoDB user schema
├── package.json       - Dependencies
├── .env               - Environment variables (git-ignored)
└── .env.example       - Example environment variables
```
