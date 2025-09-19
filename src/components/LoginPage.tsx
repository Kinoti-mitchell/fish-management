import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Fish, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { RioFishLogo } from "./RioFishLogo";

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<boolean>;
  onBack: () => void;
}

export function LoginPage({ onLogin, onBack }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await onLogin(email, password);
      if (!result.success) {
        setError(result.error || "Login failed. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please check your connection and try again.");
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

          <Card className="shadow-lg border-0">
            <CardHeader className="space-y-1 pb-6">
              <div className="hidden lg:flex items-center justify-center mb-4">
                <RioFishLogo size="lg" showText={false} />
              </div>

              <CardTitle className="text-2xl text-center">
                {isSignUp ? "Create Account" : "Welcome Back"}
              </CardTitle>
              <p className="text-center text-gray-600">
                {isSignUp
                  ? "Start managing your fish operations"
                  : "Sign in to your account"}
              </p>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
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
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
                

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading
                    ? "Please wait..."
                    : isSignUp
                    ? "Create Account"
                    : "Sign In"}
                </Button>

                <div className="text-center text-sm text-gray-600">
                  {isSignUp
                    ? "Already have an account?"
                    : "Don't have an account?"}{" "}
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto text-blue-600"
                    onClick={() => setIsSignUp(!isSignUp)}
                  >
                    {isSignUp ? "Sign in" : "Sign up"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
