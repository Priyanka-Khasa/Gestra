# Quick Diagnostics Script

Run this in your browser console (F12 → Console) to see what's happening:

## Copy & Paste This Entire Block:

```javascript
// ===== GESTRA DEBUG SCRIPT =====
console.log('%c=== GESTRA Authentication Debug ===', 'font-size: 14px; color: #00ff00; font-weight: bold;');

// Check if token exists
const token = localStorage.getItem('gestra_auth_token');
console.log('1. Token in localStorage:', token ? `EXISTS (${token.length} chars)` : 'NOT FOUND');

// Check auth service state
console.log('2. authService.isAuthenticated():', authService.isAuthenticated());

// Try to verify token
console.log('3. Checking if token is valid...');
authService.getCurrentUser().then(user => {
  if (user) {
    console.log('%c✅ Token is VALID - User:', 'color: green; font-weight: bold;', user.email);
  } else {
    console.log('%c❌ Token is INVALID - User data is null', 'color: red; font-weight: bold;');
  }
}).catch(err => {
  console.log('%c❌ Token verification failed:', 'color: red; font-weight: bold;', err.message);
});

// Check backend connectivity
console.log('4. Testing backend connectivity...');
fetch('http://localhost:3001/health')
  .then(r => r.json())
  .then(data => {
    console.log('%c✅ Backend is RUNNING:', 'color: green; font-weight: bold;', data);
  })
  .catch(err => {
    console.log('%c❌ Backend is NOT RUNNING:', 'color: red; font-weight: bold;', err.message);
  });

console.log('%c=== END DEBUG ===', 'font-size: 14px; color: #00ff00; font-weight: bold;');
```

## What Each Line Means:

| Line | What It Shows |
|------|---------------|
| **1. Token in localStorage** | Is there a saved token? If EXISTS, you have an old session |
| **2. isAuthenticated()** | Frontend thinks you're logged in? |
| **3. Token is VALID** | Does the backend accept the token? |
| **4. Backend running** | Is the backend server reachable? |

## Expected Outputs:

### Fresh Start (No Login Yet)
```
1. Token in localStorage: NOT FOUND ✅
2. authService.isAuthenticated(): false ✅
3. Token is INVALID - User data is null ✅
4. Backend is RUNNING ✅
→ You should see INTRO screen
```

### After Successful Login
```
1. Token in localStorage: EXISTS (500+ chars) ✅
2. authService.isAuthenticated(): true ✅
3. Token is VALID - User: test@example.com ✅
4. Backend is RUNNING ✅
→ You should see LICENSE screen
```

### If Token Is OLD/EXPIRED
```
1. Token in localStorage: EXISTS (500+ chars) ⚠️
2. authService.isAuthenticated(): true ⚠️
3. Token is INVALID - User data is null ❌
4. Backend is RUNNING ✅
→ Likely Issue: Old token, need to clear cache
```

### If Backend Not Running
```
1. Token in localStorage: [whatever] 
2. authService.isAuthenticated(): [whatever]
3. Token verification failed: Failed to fetch ❌
4. Backend is NOT RUNNING ❌
→ Start backend: npm start (in backend folder)
```

---

## Quick Fix Steps:

### If You See "Token EXISTS but INVALID":
```javascript
// Run in console:
localStorage.removeItem('gestra_auth_token');
location.reload();
// Page will refresh and show fresh intro screen
```

### If Backend Not Running:
```bash
# In terminal:
cd backend
npm start
# Wait for: "Auth server running on http://localhost:3001"
```

### If Everything Is Wrong:
```javascript
// Full reset - run in console:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

## Report Template

After running the debug script, tell me:

```
Frontend State:
- Token exists: YES / NO
- Token is valid: YES / NO
- Currently see: [intro / login / license / app]

Backend State:
- Backend running: YES / NO
- MongoDB connected: YES / NO

Problem:
- [Describe what happens when you try to login]
- [Describe what happens on app start]
```

This will help me fix the issue quickly!
