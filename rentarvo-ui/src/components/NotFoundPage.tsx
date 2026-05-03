import React from 'react';
import { Link } from 'react-router-dom';
import { MapPinOff } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-sm">
        <MapPinOff className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Page not found</h1>
        <p className="text-gray-500 mb-6">The page you're looking for doesn't exist or has been moved.</p>
        <Link
          to="/"
          className="inline-flex items-center px-6 py-2.5 bg-brand-700 text-white rounded-xl font-medium hover:bg-brand-800"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
