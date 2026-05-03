import React from 'react';
import { Construction } from 'lucide-react';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-6 flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <Construction className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-gray-700">{title}</h2>
        <p className="text-gray-400 mt-1">This module is coming soon.</p>
      </div>
    </div>
  );
}
