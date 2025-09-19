import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Fish, BarChart3, Shield, Users, ArrowRight, MapPin, Building, Target, Heart, Globe, Zap, Award, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { RioFishLogo } from "./RioFishLogo";

interface LandingPageProps {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [womenFarmers, setWomenFarmers] = useState(0);
  const [womenTraders, setWomenTraders] = useState(0);
  const [totalFarmers, setTotalFarmers] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Hero section images
  const heroImages = [
    "/fish-management/login-image.jpeg",
    "/fish-management/fishpic.jpg",
    "/fish-management/papo1.jpg",
    "/fish-management/papo2.jpg",
    "/fish-management/papo4.png"
  ];

  // Target values for counting animation
  const targetValues = {
    womenFarmers: 500,
    womenTraders: 500,
    totalFarmers: 2000
  };

  // Auto-rotate hero images
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => 
        prevIndex === heroImages.length - 1 ? 0 : prevIndex + 1
      );
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(interval);
  }, [heroImages.length]);

  // Animate counting numbers when section comes into view
  useEffect(() => {
    const animateValue = (start: number, end: number, duration: number, setter: (value: number) => void) => {
      const startTime = performance.now();
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(start + (end - start) * easeOutQuart);
        setter(current);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            // Start animations with slight delays
            setTimeout(() => animateValue(0, targetValues.womenFarmers, 2000, setWomenFarmers), 500);
            setTimeout(() => animateValue(0, targetValues.womenTraders, 2000, setWomenTraders), 1000);
            setTimeout(() => animateValue(0, targetValues.totalFarmers, 2000, setTotalFarmers), 1500);
          }
        });
      },
      { threshold: 0.3 }
    );

    const impactSection = document.getElementById('impact-section');
    if (impactSection) {
      observer.observe(impactSection);
    }

    return () => {
      if (impactSection) {
        observer.unobserve(impactSection);
      }
    };
  }, [hasAnimated, targetValues]);

  const features = [
    {
      icon: Fish,
      title: "Sustainable Aquaculture",
      description: "Promoting sustainable fish farming practices that protect Lake Victoria's ecosystem while ensuring food security."
    },
    {
      icon: Users,
      title: "Women Empowerment",
      description: "Empowering women fish farmers and traders with economic opportunities and breaking down gender barriers in aquaculture."
    },
    {
      icon: Target,
      title: "Market Access",
      description: "Connecting smallholder farmers directly to markets through our innovative digital platform and aggregation system."
    },
    {
      icon: Zap,
      title: "Technology Innovation",
      description: "Leveraging cutting-edge technology to optimize supply chains and implement smart farming tools for better yields."
    }
  ];

  const sdgs = [
    {
      icon: Target,
      title: "No Poverty (SDG 1)",
      description: "Creating sustainable livelihoods and economic opportunities for women in the fishing industry."
    },
    {
      icon: Heart,
      title: "Zero Hunger (SDG 2)",
      description: "Promoting sustainable fishing practices to ensure food security and improved nutrition."
    },
    {
      icon: Users,
      title: "Gender Equality (SDG 5)",
      description: "Empowering women in aquaculture through leadership opportunities and economic independence."
    },
    {
      icon: Globe,
      title: "Climate Action (SDG 13)",
      description: "Implementing climate-resilient practices that protect marine ecosystems and reduce carbon emissions."
    }
  ];

  const products = [
    {
      name: "Tilapia",
      description: "Mild, sweet flavor with lean, white flesh. Perfect for grilling, baking, or frying.",
      image: "/fish-management/tilapia.jpg"
    },
    {
      name: "Nile Perch",
      description: "Succulent and tender meat with rich taste and firm texture for gourmet meals.",
      image: "/fish-management/papo2.jpg"
    },
    {
      name: "Smoked Fish",
      description: "Traditional smoking process that enhances flavor while preserving nutritional value.",
      image: "/fish-management/papo4.png"
    },
    {
      name: "Fish Sausages",
      description: "Artisan fish sausages crafted with locally sourced fish and perfectly seasoned pastry.",
      image: "/fish-management/saus.jpeg"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden h-screen">
        <div className="absolute inset-0">
          <ImageWithFallback
            src={heroImages[currentImageIndex]}
            alt="Fish farmers on Lake Victoria with traditional fishing boats"
            className="w-full h-full object-cover opacity-30 transition-opacity duration-1000"
          />
          {/* Navigation dots */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-3">
            {heroImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentImageIndex ? 'bg-white shadow-lg' : 'bg-white/60 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </div>
        
        <div className="relative container mx-auto px-4 py-12 md:py-20">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center mb-6">
              <RioFishLogo size="xl" showText={true} className="justify-center" />
            </div>
            
            {/* Text overlay with better contrast */}
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-8 mb-8 border border-white/20">
              <p className="text-2xl md:text-3xl font-bold text-white mb-4 drop-shadow-2xl">
                Nourishing Communities and Empowering Economies through Fish
              </p>
              
              <p className="text-lg md:text-xl text-blue-100 mb-6 max-w-3xl mx-auto drop-shadow-lg leading-relaxed">
                We are dedicated to driving positive change at the intersection of innovation and sustainability. 
                At Rio Fish, we are more than a company – we are a community of changemakers committed to 
                shaping a brighter, more equitable future for all.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={onGetStarted} className="gap-2 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white shadow-lg hover:shadow-xl transition-all duration-300 font-semibold">
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="gap-2 border-white/60 text-white hover:bg-white/20 hover:border-white/80 bg-white/10 backdrop-blur-sm font-semibold"
                onClick={() => window.open('https://riofish.co.ke', '_blank', 'noopener,noreferrer')}
              >
                <Building className="w-4 h-4" />
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Partners Section */}
      <div className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Our Partners
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Working together with leading organizations to transform Kenya's aquaculture sector
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center justify-items-center">
            <div className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-all duration-300 w-full max-w-40 hover:scale-105">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-blue-600">Y</span>
                </div>
                <div className="text-sm font-semibold text-gray-800 mb-1">Ygap</div>
                <div className="text-xs text-gray-500">Accelerator</div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-all duration-300 w-full max-w-40 hover:scale-105">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center">
                  <span className="text-lg font-bold text-green-600">HB</span>
                </div>
                <div className="text-sm font-semibold text-gray-800 mb-1">Homa Bay</div>
                <div className="text-xs text-gray-500">County</div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-all duration-300 w-full max-w-40 hover:scale-105">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center">
                  <span className="text-lg font-bold text-purple-600">K</span>
                </div>
                <div className="text-sm font-semibold text-gray-800 mb-1">KMFRI</div>
                <div className="text-xs text-gray-500">Research</div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-all duration-300 w-full max-w-40 hover:scale-105">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center">
                  <span className="text-lg font-bold text-orange-600">O</span>
                </div>
                <div className="text-sm font-semibold text-gray-800 mb-1">OPES</div>
                <div className="text-xs text-gray-500">Development</div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-all duration-300 w-full max-w-40 hover:scale-105">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center">
                  <span className="text-lg font-bold text-red-600">A</span>
                </div>
                <div className="text-sm font-semibold text-gray-800 mb-1">AECF</div>
                <div className="text-xs text-gray-500">Foundation</div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-all duration-300 w-full max-w-40 hover:scale-105">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-full flex items-center justify-center">
                  <span className="text-lg font-bold text-indigo-600">U</span>
                </div>
                <div className="text-sm font-semibold text-gray-800 mb-1">USAID</div>
                <div className="text-xs text-gray-500">Kenya</div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-gray-600 text-sm">
              And many more organizations committed to sustainable aquaculture development
            </p>
          </div>
        </div>
      </div>

      {/* Impact Statistics */}
      <div id="impact-section" className="py-16 bg-gradient-to-r from-blue-600 to-blue-800 relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 drop-shadow-lg">
              Our Impact
            </h2>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto drop-shadow-md">
              Rio Fish delivers measurable impact, advancing food and nutrition security across Kenya
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="bg-white/20 backdrop-blur-md rounded-xl p-8 border border-white/20 shadow-2xl hover:bg-white/25 transition-all duration-300">
              <div className="text-5xl font-bold text-white mb-3 drop-shadow-lg">
                {womenFarmers.toLocaleString()}+
              </div>
              <div className="text-blue-100 text-lg font-medium drop-shadow-md">Women farmers recruited</div>
            </div>
            <div className="bg-white/20 backdrop-blur-md rounded-xl p-8 border border-white/20 shadow-2xl hover:bg-white/25 transition-all duration-300">
              <div className="text-5xl font-bold text-white mb-3 drop-shadow-lg">
                {womenTraders.toLocaleString()}+
              </div>
              <div className="text-blue-100 text-lg font-medium drop-shadow-md">Women Traders Supplied</div>
            </div>
            <div className="bg-white/20 backdrop-blur-md rounded-xl p-8 border border-white/20 shadow-2xl hover:bg-white/25 transition-all duration-300">
              <div className="text-5xl font-bold text-white mb-3 drop-shadow-lg">
                {totalFarmers.toLocaleString()}+
              </div>
              <div className="text-blue-100 text-lg font-medium drop-shadow-md">Total farmers aggregated</div>
            </div>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                The Challenge We Address
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Kenya faces a critical fish supply gap, with domestic production meeting only 30% of the nation's demand. 
                This shortfall stems from multiple challenges: depleted water bodies due to overfishing, environmental 
                degradation, climate change impacts, and inadequate aquaculture standards.
              </p>
              <div className="flex items-center gap-2 text-blue-600 mb-4">
                <Heart className="w-5 h-5" />
                <span className="font-medium">Combatting 'Jaboya' and HIV/AIDS Impact</span>
              </div>
              <p className="text-gray-600 mb-4">
                Our work actively combats 'jaboya' – a predatory practice where male fishermen sexually exploit women 
                traders in exchange for access to scarce fish. Through our sustainable supply chain and direct market 
                access, Rio Fish empowers women traders to operate independently and safely.
              </p>
            </div>
            <div className="relative">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1606844842584-4fb9bb2ec649?w=600&h=400&fit=crop&crop=center"
                alt="Fresh fish processing facility"
                className="rounded-lg shadow-xl w-full"
              />
              <div className="absolute -bottom-6 -right-6 w-32 h-32 hidden md:block">
                <ImageWithFallback
                  src="/fish-management/fishpic.jpg"
                  alt="Fish warehouse storage"
                  className="rounded-lg shadow-lg w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Our Strategies
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              A unique end-to-end model leveraging an integrated digital platform to transform Kenya's aquaculture sector.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="text-center p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-white/90 backdrop-blur-sm">
                  <CardContent className="space-y-4">
                    <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center shadow-md">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                    <p className="text-gray-600 text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* SDGs Section */}
      <div className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Sustainable Development Goals
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our commitment to advancing the United Nations Sustainable Development Goals through sustainable aquaculture.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {sdgs.map((sdg, index) => {
              const Icon = sdg.icon;
              return (
                <Card key={index} className="text-center p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-green-50 to-blue-50">
                  <CardContent className="space-y-4">
                    <div className="mx-auto w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center shadow-md">
                      <Icon className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">{sdg.title}</h3>
                    <p className="text-gray-600 text-sm">{sdg.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Products Section */}
      <div className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Discover the Finest Freshwater Fish
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Pure, Local, Exceptional. We specialize in premium freshwater fish sourced from the region's pristine lakes and ponds.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product, index) => (
              <Card key={index} className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-white">
                <div className="aspect-square overflow-hidden">
                  <ImageWithFallback
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">{product.name}</h3>
                  <p className="text-gray-600 text-sm">{product.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Our Processing Operations
          </h2>
          
          {/* Simple image grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-6">
              <ImageWithFallback
                src="/fish-management/5.jpg"
                alt="Fish processing warehouse"
                className="rounded-lg shadow-md w-full h-64 object-cover"
              />
              <ImageWithFallback
                src="/fish-management/1.jpg"
                alt="Fresh fish processing"
                className="rounded-lg shadow-md w-full h-48 object-cover"
              />
            </div>
            <div className="space-y-6">
              <ImageWithFallback
                src="/fish-management/2.jpg"
                alt="Cold storage facility"
                className="rounded-lg shadow-md w-full h-48 object-cover"
              />
              <ImageWithFallback
                src="/fish-management/3.jpeg"
                alt="Quality control process"
                className="rounded-lg shadow-md w-full h-64 object-cover"
              />
            </div>
            <div className="space-y-6">
              <ImageWithFallback
                src="/fish-management/process4.jpg"
                alt="Fish warehouse operations"
                className="rounded-lg shadow-md w-full h-64 object-cover"
              />
              <ImageWithFallback
                src="/fish-management/fishpic.jpg"
                alt="Fish distribution center"
                className="rounded-lg shadow-md w-full h-48 object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contact Section */}
      <div className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Let's Talk Fish
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              At Rio Fish, we are passionate about connecting with our customers, partners, and fish enthusiasts. 
              Whether you have questions about our freshwater fish, want to discuss a potential collaboration, 
              or simply wish to learn more about our offerings, our team is ready to listen.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Get in Touch</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Phone</p>
                    <p className="text-gray-600">+254700938040</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Heart className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Email</p>
                    <p className="text-gray-600">info@riofish.co.ke</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-8">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Join Our Team</h4>
                <p className="text-gray-600 mb-4">
                  We are always on the lookout for talented individuals who are passionate about our mission. 
                  We actively recruit from the communities we serve, building a diverse and inclusive environment.
                </p>
                <Button 
                  variant="outline" 
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                  onClick={() => window.open('https://riofish.co.ke/opportunities/', '_blank', 'noopener,noreferrer')}
                >
                  View Opportunities
                </Button>
              </div>
            </div>
            
            <div className="relative">
              <ImageWithFallback
                src="/fish-management/papo1.jpg"
                alt="Rio Fish team and operations"
                className="rounded-lg shadow-xl w-full"
              />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 hidden md:block">
                <ImageWithFallback
                  src="/fish-management/papo2.jpg"
                  alt="Fresh fish processing"
                  className="rounded-lg shadow-lg w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-16 bg-gradient-to-r from-blue-600 to-blue-800">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Discover Our World
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Ready to explore the world of premium freshwater fish? Visit our depots and immerse yourself in the Rio Fish experience. 
            Our passionate team is eager to guide you through our selection.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" variant="secondary" onClick={onGetStarted} className="gap-2 bg-white text-blue-600 hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all duration-300">
              Start Your Journey
            <ArrowRight className="w-4 h-4" />
          </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="gap-2 border-white text-white hover:bg-white/10"
              onClick={() => window.open('https://riofish.co.ke/gallery/', '_blank', 'noopener,noreferrer')}
            >
              <Building className="w-4 h-4" />
              View Gallery
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}