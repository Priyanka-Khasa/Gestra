# Quick MongoDB Setup with MongoDB Atlas

## Option 1: MongoDB Atlas (Recommended - Cloud, No Installation)

### Step 1: Create Free Atlas Account
1. Go to https://www.mongodb.com/cloud/atlas
2. Click "Sign Up" 
3. Create a free account
4. Login

### Step 2: Create a Cluster
1. Click "Create" button
2. Select "M0 FREE" tier (completely free)
3. Name it "Gestra"
4. Choose your region (closest to you)
5. Click "Create"
6. Wait for cluster to be created (2-3 minutes)

### Step 3: Get Connection String
1. Click "Connect" button
2. Choose "Drivers" option
3. Select "Node.js" and "version 4.0 or later"
4. Copy the connection string
5. It will look like: `mongodb+srv://username:password@cluster.mongodb.net/gestra?retryWrites=true&w=majority`

### Step 4: Update Your .env File
Edit `backend/.env`:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/gestra?retryWrites=true&w=majority
JWT_SECRET=gestra_jwt_secret_key_change_this_in_production_2024
PORT=3001
NODE_ENV=development
```

Replace `username` and `password` with the credentials you created in Atlas.

### Step 5: Restart Backend
Kill the running backend (Ctrl+C) and start it again:

```bash
cd backend
npm start
```

---

## Option 2: Local MongoDB Installation

### For Windows:

1. **Download MongoDB Community Edition**
   - Go to https://www.mongodb.com/try/download/community
   - Select Windows
   - Download the .msi installer
   
2. **Install MongoDB**
   - Run the installer
   - Follow the installation wizard
   - Choose "Install MongoDB as a Service"
   - Complete installation

3. **Verify Installation**
   - Open Command Prompt
   - Type: `mongosh`
   - You should see the MongoDB prompt
   - Type: `exit` to quit

4. **Your .env is Already Set**
   - `backend/.env` already has: `MONGODB_URI=mongodb://localhost:27017/gestra`
   - No changes needed

5. **Restart Backend**
   ```bash
   cd backend
   npm start
   ```

---

## How to Know It's Working

After you set up MongoDB and restart the backend, you should see:

```
Auth server running on http://localhost:3001
MongoDB status: Connected
```

If you see "MongoDB status: Connected", you're ready to use the app!

---

## Quick Check

Run this command in PowerShell to verify backend is responding:

```powershell
Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing | Select-Object StatusCode, @{name="MongoDB";expression={$_.Content | ConvertFrom-Json | Select-Object -ExpandProperty mongoConnected}}
```

You should see:
```
StatusCode MongoDB
---------- -------
        200 True
```

Or with MongoDB Atlas, it might show `False` initially (connection takes a moment).

---

## Recommended: MongoDB Atlas (Cloud)

✅ No installation needed
✅ Free tier is generous
✅ Works from anywhere (Electron app can use it)
✅ No local setup required
✅ Easy to scale later

This is the easiest and fastest option! Go with MongoDB Atlas.
