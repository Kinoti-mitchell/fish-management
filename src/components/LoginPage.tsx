import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Fish, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { RioFishLogo } from "./RioFishLogo";

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onBack: () => void;
}

export function LoginPage({ onLogin, onBack }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Debug: Log when error state changes
  useEffect(() => {
    console.log('🔍 [LoginPage] Error state changed to:', error);
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('🔍 [LoginPage] handleSubmit called!');
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🔍 [LoginPage] Form submitted with:', { email, password: '***' });
    
    // Clear any existing messages first
    setError(null);
    setSuccess(null);
    setLoading(true);
    
    // Debug: Check if error state is working
    console.log('🔍 [LoginPage] Error state before:', error);

    try {
      console.log('🔍 [LoginPage] Calling onLogin...');
      const result = await onLogin(email, password);
      console.log('🔍 [LoginPage] Login result:', result);
      
      if (!result.success) {
        console.log('❌ [LoginPage] Login failed:', result.error);
        const errorMessage = result.error || "Login failed. Please try again.";
        console.log('🔍 [LoginPage] Setting error message:', errorMessage);
        setError(errorMessage);
        console.log('🔍 [LoginPage] Error state after setting:', error);
      } else {
        console.log('✅ [LoginPage] Login successful');
        setSuccess("Login successful! Redirecting...");
        // Clear form on success
        setEmail("");
        setPassword("");
      }
    } catch (err: any) {
      console.error('❌ [LoginPage] Login error:', err);
      
      // Handle network errors specifically
      if (err.message?.includes('fetch') || 
          err.message?.includes('network') || 
          err.message?.includes('ERR_NETWORK') ||
          err.message?.includes('ERR_NAME_NOT_RESOLVED')) {
        setError("No network connection. Please check your internet connection and try again.");
      } else {
        setError(err.message || "Authentication failed. Please check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Mobile: Full-width image with overlay text */}
      <div className="lg:hidden relative h-80 w-full">
        <ImageWithFallback
          src="/fish-management/login-image.jpeg"
          alt="Fish farmers on Lake Victoria with traditional fishing boats"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>
        <div className="relative z-10 p-6 text-white flex flex-col justify-center items-center text-center h-full">
          <h2 className="text-2xl font-bold mb-3">Welcome to RIO FISH FARM</h2>
          <p className="text-lg opacity-90">
            Professional fish processing management
          </p>
        </div>
      </div>

      {/* Desktop: Left Side - Image */}
      <div className="hidden lg:flex lg:w-3/4 relative">
        <ImageWithFallback
          src="/fish-management/login-image.jpeg"
          alt="Fish farmers on Lake Victoria with traditional fishing boats"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative z-10 p-8 text-white flex flex-col justify-end">
          <h2 className="text-3xl font-bold mb-4">Welcome to RIO FISH FARM</h2>
          <p className="text-xl opacity-90 mb-2">
            Professional fish processing management
          </p>
          <p className="opacity-75">
            Streamline your fish processing operations with our management
            system.
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/4 flex items-center justify-center p-4 bg-gray-50 lg:min-h-screen">
        <div className="w-full max-w-md">
          <Button
            variant="ghost"
            onClick={onBack}
            className="mb-6 gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>

          <Card className="shadow-xl border border-gray-200 rounded-xl bg-white">
            <CardHeader className="space-y-1 pb-8 pt-8 px-8">
              <div className="hidden lg:flex items-center justify-center mb-6">
                <RioFishLogo size="lg" showText={false} />
              </div>

              <CardTitle className="text-2xl font-semibold text-center text-gray-900">
                Welcome Back
              </CardTitle>
              <p className="text-center text-gray-600 text-sm">
                Sign in to your account
              </p>
            </CardHeader>

            <CardContent className="px-8 pb-8">
              <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                <div className="space-y-3">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-red-700">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-green-700">{success}</p>
                      </div>
                    </div>
                  </div>
                )}
                

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Please wait...
                    </div>
                  ) : (
                    "Sign In"
                  )}
                </button>


              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
