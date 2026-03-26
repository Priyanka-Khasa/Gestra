# RunAnywhere AI (Gestra)

RunAnywhere AI is a desktop shell for gesture-driven control, system manipulation, and AI assistance. It enables hands-free interaction across your screen using real-time hand tracking with MediaPipe, supporting both browser-based and Python backend modes.

## Features

- **Real-time gesture recognition**: 6 gestures mapped to OS actions (scroll, click, screenshot, media control, cursor movement, pinch)
- **AI Assistant**: Multi-provider LLM support (Google Gemini, xAI Grok, OpenRouter) with voice input/output
- **Dual operating modes**: Collective (Python-controlled camera) or Local (browser-based detection)
- **Voice activation**: Wake-word detection + command parsing with direct app launching
- **System tray integration**: Window pinning, minimize, quit controls
- **Hybrid action execution**: Primary Python bridge with Electron native fallback
- **User Authentication**: Secure login and registration system with MongoDB database
- **Session Management**: JWT token-based authentication with persistent sessions

## Technology Stack

### Frontend
- Vite 6.0 - Modern build tool
- Electron 41 - Desktop application shell
- TailwindCSS 3.4 - UI styling (dark theme)
- MediaPipe.js - Browser-based hand landmark detection
- Web Speech API - Native browser voice recognition
- html2canvas - Screenshot capture

### Backend (Python)
- OpenCV 4.8+ - Video capture & frame processing
- MediaPipe 0.10.9+ - Hand landmark detection
- PyAutoGUI 0.9.54+ - OS-level mouse/keyboard automation
- Built-in HTTP server - Serves MJPEG streams and JSON state

### Authentication Backend (Node.js/Express)
- Express 4.18 - Web framework
- MongoDB 8.0+ - User database
- JWT - Token-based authentication
- bcryptjs - Password hashing
- CORS enabled - Cross-origin request support

## Prerequisites

- **Node.js** (version 18 or higher)
- **Python** (version 3.8 or higher)
- **Windows OS** (required for native speech recognition and system integration)
- **Webcam** (for gesture detection)
- **MongoDB** (local installation or MongoDB Atlas cloud account)

## Quick Start

1. **Clone or download the project**:
   ```bash
   cd "Your Path"
   ```

2. **Install all dependencies**:
   ```bash
   npm install
   cd backend && npm install && cd ..
   cd python-core && pip install -r requirements.txt && cd ..
   ```

3. **Set up MongoDB** (choose one option):

   **Option A: MongoDB Atlas (Cloud - Recommended)**:
   - Visit https://www.mongodb.com/cloud/atlas
   - Create a free account and cluster
   - Get your connection string
   - Copy `backend/.env.example` to `backend/.env`
   - Update `MONGODB_URI` with your Atlas connection string

   **Option B: Local MongoDB**:
   - Download from https://www.mongodb.com/try/download/community
   - Install and start MongoDB service
   - Use default `mongodb://localhost:27017/gestra` in `backend/.env`

4. **Start the application**:
   ```bash
   npm run dev:full
   ```

That's it! The app will open with all services running.

## Detailed Setup Instructions

### 1. Node.js Setup

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 2. MongoDB Database Setup

#### Option 1: MongoDB Atlas (Cloud - Recommended)

1. **Create Free Atlas Account**:
   - Go to https://www.mongodb.com/cloud/atlas
   - Click "Sign Up" and create a free account
   - Login to your account

2. **Create a Cluster**:
   - Click "Create" button
   - Select "M0 FREE" tier (completely free)
   - Name it "Gestra"
   - Choose your region (closest to you)
   - Click "Create" and wait for cluster creation (2-3 minutes)

3. **Get Connection String**:
   - Click "Connect" button
   - Choose "Drivers" option
   - Select "Node.js" and "version 4.0 or later"
   - Copy the connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/gestra?retryWrites=true&w=majority`)

4. **Configure Environment**:
   ```bash
   cd backend
   copy .env.example .env
   ```
   Edit `backend/.env`:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/gestra?retryWrites=true&w=majority
   JWT_SECRET=your_jwt_secret_key_here_change_in_production
   PORT=3001
   NODE_ENV=development
   ```

#### Option 2: Local MongoDB Installation

1. **Download MongoDB Community Edition**:
   - Go to https://www.mongodb.com/try/download/community
   - Select Windows and download the .msi installer

2. **Install MongoDB**:
   - Run the installer
   - Follow the installation wizard
   - Choose "Install MongoDB as a Service"
   - Complete installation

3. **Verify Installation**:
   ```bash
   mongosh
   # You should see the MongoDB prompt
   exit
   ```

4. **Configure Environment**:
   ```bash
   cd backend
   copy .env.example .env
   ```
   The default `backend/.env` already has:
   ```env
   MONGODB_URI=mongodb://localhost:27017/gestra
   JWT_SECRET=your_jwt_secret_key_here_change_in_production
   PORT=3001
   NODE_ENV=development
   ```

### 3. Python Environment Setup

```bash
cd python-core
pip install -r requirements.txt
cd ..
```

### 4. Environment Configuration

#### Authentication Backend
The authentication backend runs on port 3001 and handles:
- User registration and login
- JWT token generation
- User session management
- MongoDB integration

Edit `backend/.env`:
```env
MONGODB_URI=mongodb://localhost:27017/gestra  # or your Atlas URI
JWT_SECRET=your_jwt_secret_key_here_change_in_production
PORT=3001
NODE_ENV=development
```

#### API Keys (Optional - for AI features)
Create a `.env` file in the root directory:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_XAI_API_KEY=your_xai_api_key
VITE_OPENROUTER_API_KEY=your_openrouter_api_key
```

#### Environment Variables
The following are automatically configured but can be overridden:

- `VITE_PYTHON_BRIDGE_URL=http://127.0.0.1:8765` (Renderer)
- `GESTRA_PYTHON_URL=http://127.0.0.1:8765` (Electron)
- `GESTRA_PYTHON_ENTRY=path/to/python-core/main.py` (Electron)

## Running the Project

### Development Mode

#### Start Individual Services

1. **Start the authentication backend** (required):
   ```bash
   cd backend
   npm run dev
   ```
   - Runs on http://localhost:3001
   - Connects to MongoDB
   - Auto-reloads on file changes

2. **Start the Python backend** (optional, for Collective mode):
   ```bash
   cd python-core
   python main.py --api
   ```
   This starts the HTTP server on port 8765.

3. **Start the Electron app** (in a new terminal):
   ```bash
   npm run dev
   ```
   This launches the application in development mode.

#### Start All Services Together
```bash
npm run dev:full
```
This requires installing `concurrently`:
```bash
npm install -D concurrently
```

### Production Mode

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Start the Python backend** (if using Collective mode):
   ```bash
   cd python-core
   python main.py --api
   ```

3. **Start the authentication backend**:
   ```bash
   cd backend
   npm start
   ```

4. **Run the built application**:
   ```bash
   npm run preview
   ```

## Usage

### Authentication System

#### First Launch
1. **Introduction Screen**: Welcome screen with app overview
2. **Sign In / Register**: Choose to log in or create a new account
3. **License Acceptance**: Accept runtime permissions
4. **App Access**: Enter the main application

#### User Registration
New users can create an account with:
- **Full Name**: Required
- **Email**: Must be valid and unique
- **Password**: Minimum 6 characters
- **Password Confirmation**: Must match password

#### User Login
Existing users can log in with:
- **Email**: Account email address
- **Password**: Account password

### Gesture Actions

| Gesture | Action |
|---------|--------|
| Open palm | Scroll up continuously while held |
| Closed fist | Scroll down continuously while held |
| Peace sign | Take screenshot |
| Thumbs up | Media play/pause |
| Index point | Move cursor |
| Pinch | Left click |

### Operating Modes

#### Collective Mode (Recommended)
- Python backend owns the camera
- Provides MJPEG stream at `GET /camera.mjpg`
- Serves HUD state at `GET /api/v1/state`
- More stable for continuous gesture detection

#### Local Camera Mode
- Browser uses `getUserMedia` API
- Falls back to Electron native actions when Python unavailable
- Lighter resource usage but may have camera conflicts

### Voice Commands

- **Wake word**: "Hey Gestra" or "Okay Gestra"
- **Direct commands**: App launching, OS actions, AI queries
- **Fallback**: Windows native speech recognition via PowerShell

### AI Assistant

- Supports multiple LLM providers
- Voice input/output integration
- Context-aware responses
- Direct command execution

## API Documentation

### Authentication Endpoints (`/api/v1/auth`)

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

## Project Architecture

```
┌─ Electron Main ─────────────────────────────────┐
│  IPC routing, window mgmt, Python launcher      │
└────────────────────────────────┬────────────────┘
                                 │ IPC/HTTP
           ┌─────────────────────┴──────────────────┐
           │  Vite Renderer (Web UI)                 │
           │  Auth flow, gesture detection, actions  │
           │  AI assistant, voice control            │
           └─────────────────────┬──────────────────┘
                                 │ HTTP
           ┌─────────────────────┼──────────────────┐
           │                     │                  │
    ┌──────┴──────────────┐  ┌──┴──────────────┐   │
    │  Auth Backend       │  │  Python Backend │   │
    │  (Node.js/Express)  │  │  (Optional)     │   │
    │  port: 3001         │  │  port: 8765     │   │
    │  MongoDB            │  │  Camera → ML    │   │
    └─────────────────────┘  └─────────────────┘   │
```

## Key Components

### Frontend (`src/`)
- `main.js` - App orchestration, authentication flow, and startup
- `auth.js` - Authentication service (login, register, token management)
- `gesture-mediapipe.js` - Browser hand detection and classification
- `actions.js` - Gesture-to-action mapping and execution
- `voice.js` - Voice recognition and wake-word detection
- `assistant.js` - AI assistant interface
- `ai.js` - LLM provider abstraction
- `tts.js` - Text-to-speech for feedback
- `ui.js` - HUD updates and interface management

### Electron (`electron/`)
- `main.cjs` - Window management and IPC handlers
- `preload.cjs` - Context bridge for secure API exposure
- `windows-voice-once.ps1` - PowerShell speech recognition fallback

### Python (`python-core/`)
- `main.py` - HTTP server and camera processing loop
- `gesture.py` - MediaPipe landmark classification
- `actions.py` - PyAutoGUI action execution with smoothing

### Authentication Backend (`backend/`)
- `server.js` - Express app setup, MongoDB connection, middleware
- `routes/auth.js` - Authentication endpoints (register, login, verify token)
- `models/User.js` - MongoDB user schema with password hashing

## Building for Distribution

1. **Build the web assets**:
   ```bash
   npm run build
   ```

2. **Create Windows installer**:
   ```bash
   npm run dist
   ```
   This generates an NSIS installer in the `dist/` directory.

## Performance Tuning

- **Gesture confidence threshold**: 0.7 (configurable via UI slider)
- **Stability requirement**: 6 consecutive frames of same gesture
- **Action cooldowns**: 700-1400ms per action type
- **Mouse smoothing**: Exponential moving average (alpha 0.38)
- **Scroll repeat**: 120ms intervals, 6 clicks per tick

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running: `mongosh` should connect
- Check if MONGODB_URI in `backend/.env` is correct
- Ensure port 27017 (local) or Atlas connection string is valid
- Check firewall settings for MongoDB port

### Backend Server Issues
- Verify Node.js version: `node --version` (should be 18+)
- Check if port 3001 is available: `netstat -ano | findstr :3001`
- Ensure all dependencies are installed: `cd backend && npm install`

### Python Backend Issues
- Ensure Python 3.8+ is installed: `python --version`
- Check that `requirements.txt` packages are installed
- Verify camera permissions
- Check port 8765 availability

### Camera Access
- Grant browser camera permissions when prompted
- Close other applications using the camera
- Try switching between Collective and Local modes

### Authentication Issues
- Clear browser localStorage if login problems persist
- Check JWT_SECRET in `backend/.env` is set
- Verify MongoDB connection status in backend logs

### Build Issues
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Update Node.js to latest LTS version
- Check for conflicting global packages

## Security Notes

1. **Passwords**: All passwords are hashed using bcryptjs with 10 salt rounds before storing
2. **JWT**: Tokens expire after 7 days
3. **CORS**: Configured to allow requests from localhost during development
4. **Never commit `.env`**: Make sure to add it to `.gitignore`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly in both modes
5. Submit a pull request

## License

This project is proprietary software. See LICENSE file for details.
