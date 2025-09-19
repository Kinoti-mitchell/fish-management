import React from 'react';
import { RioFishLogo } from './RioFishLogo';

export const LogoPreview = () => {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="text-center space-y-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-8">Rio Fish Logo Preview</h1>
        
        {/* Small Logo */}
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Small (sm)</p>
          <RioFishLogo size="sm" showText={true} />
        </div>
        
        {/* Medium Logo */}
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Medium (md)</p>
          <RioFishLogo size="md" showText={true} />
        </div>
        
        {/* Large Logo */}
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Large (lg)</p>
          <RioFishLogo size="lg" showText={true} />
        </div>
        
        {/* Extra Large Logo */}
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Extra Large (xl)</p>
          <RioFishLogo size="xl" showText={true} />
        </div>
        
        {/* Logo Only (no text) */}
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Logo Only (no text)</p>
          <RioFishLogo size="lg" showText={false} />
        </div>
        
        {/* Direct SVG Display */}
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Direct SVG (300x120)</p>
          <img 
            src="/fish-management/riofish-logo.png" 
            alt="Rio Fish Logo" 
            className="mx-auto"
            style={{ width: '300px', height: '120px' }}
          />
        </div>
      </div>
    </div>
  );
};
