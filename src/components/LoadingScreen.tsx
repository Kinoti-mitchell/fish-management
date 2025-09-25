import React from 'react';
import { RioFishLogo } from './RioFishLogo';

export const LoadingScreen = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 content-container">
      <div className="text-center">
        <div className="mb-8">
          <div className="flex justify-center mb-4">
            <RioFishLogo size="xl" showText={true} />
          </div>
        </div>
        
        <div className="flex items-center justify-center space-x-2">
          <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
        
        <p className="text-sm text-gray-500 mt-4">Loading application...</p>
      </div>
    </div>
  );
};
