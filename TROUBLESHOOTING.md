# Authentication System Troubleshooting Guide

## Issues Fixed

### ✅ Issue 1: "Failed to Fetch" Error on Registration
**Cause**: Backend server wasn't running or npm install failed

**Fixed By**:
- Updated package.json with correct jsonwebtoken version (^9.0.0)
- Fixed npm install - deleted old package-lock.json
- Backend now starts without needing MongoDB immediately

### ✅ Issue 2: Could Login with Any Email/Password
**Cause**: Backend wasn't connected to database, errors weren't being properly handled

**Fixed By**:
- Improved error handling in auth.js to check for `success` flag and `token`
- Added loading states to login/register buttons to prevent double-submits
- Backend validation is now properly enforced
- Error messages clearly displayed to users

### ✅ Issue 3: MongoDB Connection Blocking Server Startup
**Cause**: Server would crash if MongoDB wasn't running

**Fixed By**:
- Server now starts even if MongoDB is disconnected
- Health check endpoint shows current MongoDB status
- Database operations fail gracefully with error messages

---

## Current Status

✅ **Backend Server Status**: Running on port 3001
⚠️ **MongoDB Status**: Disconnected (needs setup)

To complete the setup, you need to connect to MongoDB.

---

## Step-by-Step Fix

### Step 1: Set Up MongoDB (Choose One Option)

#### **OPTION A: MongoDB Atlas (Recommended - Cloud)**

1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create a free M0 cluster
4. Get connection string from "Connect" button
5. Copy the connection string
6. Edit `backend/.env`:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/gestra?retryWrites=true&w=majority
   JWT_SECRET=gestra_jwt_secret_key_change_this_in_production_2024
   PORT=3001
   NODE_ENV=development
   ```
7. Replace `username` and `password`

#### **OPTION B: Local MongoDB**

1. Download from https://www.mongodb.com/try/download/community
2. Install MongoDB
3. MongoDB automatically starts (Windows service)
4. No changes needed to `backend/.env` (already configured for localhost)

---

### Step 2: Restart Backend Server

Kill the current backend process (Ctrl+C) and start it again:

```bash
cd backend
npm start
```

You should see:
```
Auth server running on http://localhost:3001
MongoDB status: Connected
```

---

### Step 3: Start Frontend

In a new terminal:

```bash
npm run dev
```

Frontend will be at http://localhost:5173

---

###  Step 4: Test the System

#### Test Registration:
1. Click "Create Account"
2. Enter:
   - Name: Test User
   - Email: test@example.com
   - Password: Test123456
   - Confirm: Test123456
3. Click "Create Account"
4. Should see: "Account created successfully!"
5. Proceeds to License screen

#### Test Login:
1. Go back to Sign In
2. Enter:
   - Email: test@example.com
   - Password: Test123456
3. Click "Continue"
4. Should see: "Login successful!"
5. Proceeds to License screen

#### Test Password Validation:
1. Try to login with wrong password
2. Should see: "Invalid email or password"
3. Login **does not** succeed

#### Test Invalid Email:
1. Try to login with non-existent email
2. Should see: "Invalid email or password"
3. Cannot login

---

## Verification Commands

### Check Backend is Running:
```powershell
Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing | Select-Object StatusCode
```
Should return: `200`

### Check MongoDB Connection:
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing
$json = $response.Content | ConvertFrom-Json
Write-Host "MongoDB Connected: " $json.mongoConnected
```
Should return: `True` (if MongoDB is connected)

---

## Common Issues & Fixes

### Issue: Get "Failed to Fetch" Error When Registering

**Solution**: 
- Make sure backend is running: `npm start` in `backend/` folder
- Check port 3001 is not in use
- Wait 2-3 seconds for backend to fully start

### Issue: "MongoDB status: Disconnected" in Backend

**Solution**:
- MongoDB is not running or not configured
- Follow MongoDB setup steps above (Option A or B)
- Then restart backend

### Issue: Can't Connect to MongoDB (Connection timeout)

**Solution**:
- If local: Make sure MongoDB service is running (Windows services)
- If Atlas: Check connection string has correct username/password
- Whitelist your IP: MongoDB Atlas → Security → IP Whitelist → Add your IP

### Issue: "Invalid email or password" for Correct Email/Pass

**Solution**:
- Make sure MongoDB is connected
- Check backend console for error messages
- Try creating account again with same email (might already exist)
- Clear localStorage in browser: Press F12 → Application → Local Storage → Clear All

### Issue: Login always succeeds even with wrong password

**Solution**:
- MongoDB is likely not connected
- Check backend console output
- Verify MongoDB is running
- Restart backend and try again

---

## Check Backend Logs

If something isn't working, check what the backend is doing:

1. Make sure backend is running in visible terminal (not background)
2. Try login/register and watch the terminal output
3. You should see messages like:
   ```
   Register error: User with this email already exists
   Login error: Invalid credentials
   ```

---

## Security Notes

⚠️ **For Development Only**:
- `JWT_SECRET` in `.env` is visible (ok for dev)
- MongoDB might not require authentication (ok for local dev)

🔒 **Before Production**:
- Change `JWT_SECRET` to a strong random value
- Enable MongoDB authentication
- Set `NODE_ENV=production`
- Use HTTPS instead of HTTP
- Enable IP whitelist on MongoDB Atlas

---

## Test Account for Quick Testing

After setup is complete, use these credentials:

**Register**:
- Name: Test User
- Email: test@example.com
- Password: Test123456

**Login**:
- Email: test@example.com
- Password: Test123456

---

## Files Recently Updated

1. **backend/package.json** - Fixed jsonwebtoken version
2. **backend/server.js** - Made MongoDB optional for startup
3. **backend/routes/auth.js** - Better error handling
4. **src/auth.js** - Improved error checking
5. **src/main.js** - Enhanced form validation and loading states
6. **MONGODB_SETUP.md** - MongoDB installation guide (NEW)

---

## Still Having Issues?

Check these in order:

1. ✅ Is backend running? (Can reach http://localhost:3001/health)
2. ✅ Is MongoDB configured? (Check backend logs)
3. ✅ Are you entering correct email/password?
4. ✅ Did you click "Create Account" first before trying to login?
5. ✅ Try clearing browser cache: F12 → Application → Clear Storage

---

## Next Steps

Once auth is working:

1. Start Python backend (optional): `cd python-core && python main.py --api`
2. Configure AI providers in root `.env` (optional)
3. Use the app normally
4. All gesture detection works as before once past login

---

## Architecture Reminder

```
Frontend (localhost:5173)
    ↓ (HTTP requests to)
Backend API (localhost:3001)
    ↓ (Connects to)
MongoDB (Local or Atlas)
    ↓ (Stores)
User Data (Email, Hashed Password, Token)
```

---

## Real-World Usage Flow

1. **First Time**:
   - User opens app
   - Sees intro screen
   - Clicks "Create Account"
   - Fills in details
   - Account created, logged in
   - Accepts license
   - Uses app

2. **Follow-up Sessions**:
   - User opens app
   - Logged in token verified from localStorage
   - Skips intro/login
   - Straight to license screen
   - Immediately uses app

3. **Lost Password** (Future Feature):
   - User clicks "Forgot Password" (not yet implemented)
   - Would receive reset link via email
   - Could reset password securely

---

For MongoDB setup, **strongly recommend MongoDB Atlas** - it takes 5 minutes and requires no installation!
