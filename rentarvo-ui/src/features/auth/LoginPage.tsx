import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { ApiError } from '../../lib/api';

export function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  // Ensure password field is empty on mount (after logout)
  useEffect(() => { setPassword(''); }, []);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      // Clear password on failed login for security
      setPassword('');
      // Translate error codes to user-friendly messages
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('Invalid email or password');
        } else if (err.status === 0) {
          setError(err.message); // Already user-friendly from api.ts (timeout / unreachable)
        } else if (err.status >= 500) {
          setError("We can't reach the server. Please try again.");
        } else {
          setError(err.message || 'Something went wrong');
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-700">Rentarvo</h1>
          <p className="text-gray-500 mt-1">Property management, simplified.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">{isRegister ? 'Create Account' : 'Sign In'}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                required
                minLength={8}
                autoComplete="new-password"
                key="login-password"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-brand-700 text-white font-medium rounded-lg hover:bg-brand-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          {isRegister && (
            <div className="mt-4 text-center">
              <button
                onClick={() => { setIsRegister(false); setError(''); }}
                className="text-sm text-brand-600 hover:underline"
              >
                Already have an account? Sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
