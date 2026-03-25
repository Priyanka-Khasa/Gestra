@echo off
REM Quick Start Script for Gestra Authentication System
REM This script starts both the backend API server and frontend dev server

echo.
echo ========================================
echo  Gestra Authentication System
echo ========================================
echo.

REM Check if backend exists
if not exist "backend" (
    echo ERROR: backend folder not found
    echo Please run this script from the Gestra root directory
    pause
    exit /b 1
)

echo Starting Gestra Authentication System...
echo.

REM Install dependencies if needed
echo Checking backend dependencies...
cd backend
if not exist "node_modules" (
    echo Installing backend dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install backend dependencies
        pause
        exit /b 1
    )
)
cd ..

echo.
echo ========================================
echo  IMPORTANT: MongoDB Setup
echo ========================================
echo.
echo The backend needs MongoDB to fully work.
echo.
echo CHOOSE ONE:
echo 1. MongoDB Atlas (Cloud - Recommended)
echo    - Go to https://www.mongodb.com/cloud/atlas
echo    - Create free account and cluster
echo    - Get connection string
echo    - Add to backend/.env: MONGODB_URI=...
echo.
echo 2. Local MongoDB
echo    - Download from https://www.mongodb.com/try/download/community
echo    - Install and start service
echo    - Already configured in backend/.env
echo.
echo ========================================
echo.
echo Starting servers in 5 seconds...
echo (Close this window to stop the servers)
timeout /t 5

REM Start backend
echo.
echo Starting backend API server on port 3001...
echo.

start cmd /k "cd backend && npm start"

REM Wait for backend to start
timeout /t 3

REM Start frontend
echo.
echo Starting frontend dev server on port 5173...
echo.
start cmd /k "npm run dev"

echo.
echo ========================================
echo  Servers Starting!
echo ========================================
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3001
echo.
echo MongoDB status will show in backend window.
echo.
echo For troubleshooting, see TROUBLESHOOTING.md
echo.
pause
