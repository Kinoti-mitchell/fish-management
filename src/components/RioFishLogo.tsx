import React from 'react';

interface RioFishLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const RioFishLogo: React.FC<RioFishLogoProps> = ({ 
  size = 'md', 
  showText = true, 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-20 h-12',
    md: 'w-28 h-16', 
    lg: 'w-40 h-24',
    xl: 'w-48 h-32'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
    xl: 'text-xl'
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Rio Fish Logo - Using original website logo */}
      <div className={`${sizeClasses[size]} flex-shrink-0`}>
        <img 
          src="/fish-management/riofish-logo.png"
          alt="Rio Fish Logo"
          className="w-full h-full object-contain"
          style={{ imageRendering: 'crisp-edges' }}
          onError={(e) => {
            console.log('Logo failed to load, trying fallback');
            const target = e.target as HTMLImageElement;
            target.src = "https://riofish.co.ke/wp-content/uploads/2024/01/riofish_logo_copy-removed-background-white.png";
          }}
        />
      </div>
      
      {showText && (
        <div className="flex flex-col">
          <h1 className={`${textSizeClasses[size]} font-bold bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent`}>
            RIO FISH FARM
          </h1>
          <p className="text-xs text-gray-600">Kenya Operations</p>
        </div>
      )}
    </div>
  );
};