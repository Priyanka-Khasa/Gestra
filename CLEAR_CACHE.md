# How to Clear Cache and Test Fresh

## Step 1: Clear Browser Storage

Open your browser (at http://localhost:5173) and do the following:

### Option A: Using DevTools (Easiest)
1. Press **F12** to open Developer Tools
2. Go to **Application** tab (or **Storage** in Firefox)
3. Click **Local Storage** on the left
4. Click **http://localhost:5173**
5. Right-click on any item and select **Delete All** or:
   - Find the key **gestra_auth_token** and delete it
6. Close DevTools (F12 again)
7. **Refresh the page** (Ctrl+R or Cmd+R)

### Option B: Using Console Command
1. Press **F12** to open Developer Tools
2. Go to **Console** tab
3. Paste this command:
```javascript
localStorage.removeItem('gestra_auth_token'); 
console.log('Token cleared! Refresh the page now.');
```
4. Press Enter
5. Refresh the page (Ctrl+R)

## Step 2: Verify Fresh State

After clearing cache, you should see:
- ✅ **Intro screen** with "Sign In" and "Create Account" buttons
- ❌ **NOT** the license screen

If you still see the license screen after refresh, there's a deeper issue.

## Step 3: Test Login Flow

### Test 1: Wrong Password (Should FAIL)
1. Click "Sign In"
2. Enter: `test@example.com` (or any valid email in your DB)
3. Enter password: `WRONGPASSWORD123`
4. Click "Continue"
5. Expected: See error "Invalid email or password"
   - License screen should **NOT** appear
   - Should stay on login screen

### Test 2: Wrong Email (Should FAIL)
1. Click "Sign In"
2. Enter: `nonexistent@example.com`
3. Enter password: `anypassword123`
4. Click "Continue"
5. Expected: See error "Invalid email or password"
   - License screen should **NOT** appear

### Test 3: Correct Credentials (Should SUCCEED)
1. Click "Sign In"
2. Enter: `test@example.com` (or your test account)
3. Enter password: `Test123456` (or your test password)
4. Click "Continue"
5. Expected: See success message "Login successful! Proceeding to license..."
   - License screen **SHOULD** appear
   - Check checkbox and click "Accept Gestra"

### Test 4: Session Persistence
1. After successful login and accepting license, use the app
2. Close the app (or refresh page with Ctrl+R)
3. Expected: License screen appears again (due to saved token)
   - You don't need to login again
4. Click "Accept Gestra" again
5. App should load

## Step 5: Debug Console Output

If tests fail, check the browser console for errors:

1. Press **F12** → **Console** tab
2. Look for messages like:
   - ✅ "Valid token found" = Token is working
   - ❌ "Token validation failed" = Token expired/invalid
   - ❌ "No valid token found" = Fresh state (intro screen)
   - ❌ "Login error details:" = Login failed

## Common Issues

### Issue: Still See License Screen After Cache Clear
**Solution**:
1. Make sure you cleared **gestra_auth_token** from Local Storage
2. Make sure you **refreshed** the page (Ctrl+R)
3. Check browser console for error messages
4. If backend not running: See error "Token verification error"

### Issue: Login Fails with "Failed to fetch"
**Solution**:
1. Make sure backend is running: `npm start` in `backend/` folder
2. Check that backend shows: `MongoDB status: Connected`
3. If not: Run MongoDB setup first (see MONGODB_SETUP.md)

### Issue: Can Login but Can't Accept License
**Solution**:
1. Check browser console for errors
2. Make sure you clicked the checkbox before "Accept Gestra"
3. Try closing and re-opening browser

---

**After doing these steps, report back with:**
1. ✅/❌ Whether intro screen appears on fresh load
2. ✅/❌ Whether wrong password shows error
3. ✅/❌ Whether correct password allows license screen
4. Any error messages from browser console

This will help me diagnose the exact issue!
