'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin } from '@/utils/api';

// Create auth context
const AuthContext = createContext();

// Hook to use auth context
export function useAuth() {
  return useContext(AuthContext);
}

// Provider component that wraps the app
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Check for saved auth on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setToken(savedToken);
    }
    
    setLoading(false);
  }, []);
  
  // Login function
  async function login(email) {
    try {
      const result = await apiLogin(email);
      
      if (result.success) {
        setUser(result.user);
        setToken(result.token);
        
        // Save to localStorage
        localStorage.setItem('user', JSON.stringify(result.user));
        localStorage.setItem('token', result.token);
        
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }
// Logout function
function logout() {
  // Clear from state
  setUser(null);
  setToken(null);
  
  // Remove from localStorage
  localStorage.removeItem('user');
  localStorage.removeItem('token');
}

// Context value
const value = {
  user,
  token,
  login,
  logout,
  isAuthenticated: !!token,
};

return (
  <AuthContext.Provider value={value}>
    {!loading && children}
  </AuthContext.Provider>
);
