// Authentication service for the Gestra frontend
// Communicates with the auth backend

const AUTH_API_BASE = 'http://localhost:3001/api/v1/auth';

export const authService = {
  // Store auth token in localStorage
  setToken(token) {
    // Validate token before storing (JWT should be long string with dots)
    if (token && typeof token === 'string' && token.includes('.')) {
      localStorage.setItem('gestra_auth_token', token);
    } else {
      console.error('Invalid token format - not storing:', token);
    }
  },

  // Retrieve auth token from localStorage
  getToken() {
    const token = localStorage.getItem('gestra_auth_token');
    // Validate token format (JWT has 3 parts separated by dots)
    if (token && token.includes('.') && token.split('.').length === 3) {
      return token;
    } else if (token) {
      // Token exists but is invalid format - clear it
      console.warn('Invalid token format found - clearing');
      localStorage.removeItem('gestra_auth_token');
      return null;
    }
    return null;
  },

  // Clear auth token
  clearToken() {
    localStorage.removeItem('gestra_auth_token');
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.getToken();
  },

  // Register new user
  async register(email, password, name) {
    try {
      const response = await fetch(`${AUTH_API_BASE}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.errors?.[0]?.msg || 'Registration failed');
      }

      if (data.token) {
        this.setToken(data.token);
      }

      return { success: true, ...data };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  // Login user
  async login(email, password) {
    try {
      const response = await fetch(`${AUTH_API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      if (!data.success) {
        throw new Error(data.message || 'Login failed - invalid credentials');
      }

      if (data.token) {
        this.setToken(data.token);
      }

      return { success: true, ...data };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  // Logout user
  async logout() {
    try {
      const token = this.getToken();
      
      // Send logout request to backend (optional)
      fetch(`${AUTH_API_BASE}/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }).catch(() => {}); // Ignore logout endpoint errors

      this.clearToken();
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      this.clearToken(); // Clear token anyway
      return { success: true };
    }
  },

  // Verify token and get current user
  async getCurrentUser() {
    try {
      const token = this.getToken();

      if (!token) {
        console.log('No valid token found');
        return null;
      }

      const response = await fetch(`${AUTH_API_BASE}/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      // Check if response is ok
      if (!response.ok) {
        console.warn('Token verification failed with status:', response.status);
        this.clearToken();
        return null;
      }

      const data = await response.json();

      // Validate response has required fields
      if (!data || !data.success || !data.user || !data.user.email) {
        console.warn('Invalid response from /me endpoint:', data);
        this.clearToken();
        return null;
      }

      return data.user;
    } catch (error) {
      console.error('Get current user error:', error.message);
      this.clearToken();
      return null;
    }
  },
};

export default authService;
