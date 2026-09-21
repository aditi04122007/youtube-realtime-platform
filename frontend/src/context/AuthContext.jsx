import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  getCurrentUser,
  loginUser,
  registerUser,
  logoutUser,
  verifyLoginOtp,
} from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize and verify authentication state on mount
  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCurrentUser();
      if (data && data.success && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      // 401 or network error -> unauthenticated
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  /**
   * Log in user with credentials { email, password }
   */
  const login = async (credentials) => {
    const data = await loginUser(credentials);
    if (data && data.success && data.user) {
      setUser(data.user);
    }
    return data;
  };

  /**
   * Register user with { username, email, password, display_name }
   */
  const register = async (userData) => {
    const data = await registerUser(userData);
    return data;
  };

  /**
   * Log out user
   */
  const logout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('[AuthContext] Logout failed on server:', err);
    } finally {
      setUser(null);
    }
  };

  /**
   * Refresh current user data from server
   */
  const refreshUser = async () => {
    try {
      const data = await getCurrentUser();
      if (data && data.success && data.user) {
        setUser(data.user);
      }
    } catch {
      setUser(null);
    }
  };

  /**
   * Complete step-up OTP login
   */
  const completeLoginWithOtp = async ({ tempToken, otp }) => {
    const data = await verifyLoginOtp({ tempToken, otp });
    if (data && data.success && data.user) {
      setUser(data.user);
    }
    return data;
  };

  /**
   * Partial in-memory user update (e.g. after profile edit or avatar upload)
   */
  const updateUserState = (updatedFields) => {
    setUser((prev) => (prev ? { ...prev, ...updatedFields } : null));
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    login,
    completeLoginWithOtp,
    register,
    logout,
    refreshUser,
    updateUserState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;

};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
