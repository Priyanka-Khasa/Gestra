# Quick Start Guide - Gestra with Authentication

This guide covers the complete setup process for running Gestra with the new authentication system.

## Prerequisites

- **Node.js** (version 18+) - https://nodejs.org/
- **Python** (version 3.8+) - https://www.python.org/
- **MongoDB** - Download from https://www.mongodb.com/try/download/community
- **Git** (optional) - for version control

## Installation Steps

### Step 1: Install Node Dependencies

```bash
cd "path/to/Gestra"
npm install
```

### Step 2: Set up MongoDB

#### Option A: Local MongoDB (Recommended for Development)
1. Download MongoDB Community Edition: https://www.mongodb.com/try/download/community
2. Install and start MongoDB
3. Verify connection: Open Command Prompt and type `mongosh`
4. Default connection string: `mongodb://localhost:27017/gestra`

#### Option B: MongoDB Atlas (Cloud)
1. Visit https://www.mongodb.com/cloud/atlas
2. Create free account and cluster
3. Get connection string
4. Use the connection string in `backend/.env`

### Step 3: Set up Authentication Backend

```bash
cd backend
npm install
```

Create `.env` file by copying `.env.example`:
```bash
copy .env.example .env
```

Edit `backend/.env` with your settings:
```env
MONGODB_URI=mongodb://localhost:27017/gestra
JWT_SECRET=your_secret_key_change_this_in_production
PORT=3001
NODE_ENV=development
```

Return to root:
```bash
cd ..
```

### Step 4: Set up Python Backend (Optional)

```bash
cd python-core
pip install -r requirements.txt
cd ..
```

### Step 5: Create Root .env (Optional - for AI features)

Create `.env` in the root directory for AI provider keys:
```env
VITE_GEMINI_API_KEY=your_gemini_key
VITE_XAI_API_KEY=your_xai_key
VITE_OPENROUTER_API_KEY=your_openrouter_key
```

## Running the Application

### Option A: Run All Services Together (Easiest)

```bash
npm run dev:full
```

This will:
1. Start the authentication backend on port 3001
2. Start the Vite dev server on port 5173
3. Auto-reload on file changes

Your app will be available at http://localhost:5173

### Option B: Run Services Separately

**Terminal 1 - Authentication Backend:**
```bash
cd backend
npm run dev
```
Backend runs on http://localhost:3001

**Terminal 2 - Vite Dev Server:**
```bash
npm run dev
```
Frontend runs on http://localhost:5173

**Terminal 3 - Python Backend (Optional):**
```bash
cd python-core
python main.py --api
```
Python API runs on http://localhost:8765

## First Time Usage

1. **Launch**: Open http://localhost:5173 (or your app if running Electron)
2. **See Intro Screen**: View the RunAnywhere AI introduction
3. **Create Account**: Click "Create Account" and:
   - Enter your full name
   - Enter your email
   - Create a password (min 6 characters)
   - Confirm your password
   - Click "Create Account"
4. **Accept License**: Read and accept the runtime permissions
5. **Start App**: License will proceed to the main application
6. **Enable Camera**: Grant camera permissions when prompted

## Subsequent Usage

1. **Open App**: Navigate to http://localhost:5173
2. **Login**: Use your registered email and password
3. **Accept License**: Accept runtime permissions
4. **Use App**: Start using the gesture control features

## Testing the Authentication

### Register Successfully
- Email: test@example.com
- Password: Test123456
- Name: Test User
- Expected: Account created, token saved, proceeds to license

### Login Successfully
- Email: test@example.com
- Password: Test123456
- Expected: Logged in, token saved, proceeds to license

### Invalid Credentials
- Email: nonexistent@example.com
- Password: wrongpassword
- Expected: "Invalid email or password" error

### Password Validation
- Password too short (less than 6 characters)
- Expected: "Password must be at least 6 characters" error

### Password Mismatch
- Password: Test123456
- Confirm: Test123457
- Expected: "Passwords do not match" error

## Architecture Overview

```
Frontend (Vite)
    ↓
Authentication Backend (Node.js/Express) on port 3001
    ↓
MongoDB
    ↓
User Data Storage

                +
                
Python Backend (Optional) on port 8765
    ↓
Camera/MediaPipe/Vision
    ↓
Gesture Processing
```

## Troubleshooting

### MongoDB Connection Error
**Error**: "connect ECONNREFUSED 127.0.0.1:27017"
- **Solution**: Start MongoDB service
  - Windows: MongoDB should auto-start
  - Manual: `mongosh` to test connection
  - Or use MongoDB Atlas cloud

### Port Already in Use
**Error**: "Port 3001 is already in use"
- **Solution**: Change PORT in `backend/.env` or kill the process:
  ```bash
  netstat -ano | findstr :3001
  taskkill /PID <PID> /F
  ```

### Auth Backend Not Starting
**Error**: Backend crashes on startup
- **Check**: MongoDB is running
- **Check**: `.env` file exists and has MONGODB_URI
- **Check**: Node.js version is 18+

### Frontend Can't Reach Backend
**Error**: "Failed to fetch" on login/register
- **Check**: Backend is running on port 3001
- **Check**: No CORS issues (backend allows localhost)
- **Check**: Firewall allows local connections

### Camera Permissions Denied
**Error**: "Camera access denied"
- **Solution**: Windows Settings → Privacy & Security → Camera
  - Enable camera access for your browser/Electron app

## Environment Variables Reference

### `backend/.env`
```env
MONGODB_URI           # MongoDB connection string (required)
JWT_SECRET           # JWT signing key (required, change in production)
PORT                 # Backend port (default: 3001)
NODE_ENV             # Environment: development or production
```

### `root/.env` (Optional)
```env
VITE_GEMINI_API_KEY      # Google Gemini API key
VITE_XAI_API_KEY         # xAI Grok API key
VITE_OPENROUTER_API_KEY  # OpenRouter API key
VITE_PYTHON_BRIDGE_URL   # Python backend URL (default: http://127.0.0.1:8765)
```

## Next Steps

- **Configure AI Providers**: Add API keys to `.env` for AI features
- **Start Python Backend**: Optional, enables collective vision mode
- **Deploy**: See Production Deployment section in main README

## Features to Test

- ✅ User Registration
- ✅ User Login
- ✅ Session Persistence (token saved in localStorage)
- ✅ License Acceptance Flow
- ✅ App Initialization After Auth
- ✅ Gesture Detection (if Python backend running)
- ✅ AI Assistant (if API keys configured)
- ✅ Voice Commands (if microphone available)

## Support Files

- Main documentation: `README.md`
- Backend API docs: `backend/README.md`
- Backend setup: `backend/.env.example`
- Frontend auth service: `src/auth.js`
- Frontend main app: `src/main.js`

## Security Notes for Deployment

Before deploying to production:

1. **Change JWT_SECRET** in `backend/.env` to a strong random value
2. **Set NODE_ENV** to `production` in `backend/.env`
3. **Update CORS** in `backend/server.js` to only allow your domain
4. **Use HTTPS** in production
5. **Enable MongoDB Authentication** for your database
6. **Set strong database passwords**
7. **Regular backups** of your MongoDB database
8. **Monitor logs** for suspicious activity

## Questions or Issues?

Check the troubleshooting section above or refer to:
- Main README: `README.md`
- Backend README: `backend/README.md`
- This guide: `SETUP.md`
