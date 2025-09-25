import { useState, useEffect } from "react";
import Marquee from "./ui/marquee";
import { Fish, TrendingUp, AlertCircle, CheckCircle, Star, Award, Zap } from "lucide-react";

interface MarqueeItem {
  id: string;
  type: 'success' | 'info' | 'warning' | 'achievement';
  icon: React.ReactNode;
  text: string;
  bgColor: string;
  textColor: string;
}

export function FishFarmMarquee() {
  const [marqueeItems, setMarqueeItems] = useState<MarqueeItem[]>([]);

  useEffect(() => {
    // Generate dynamic marquee items
    const items: MarqueeItem[] = [
      {
        id: '1',
        type: 'success',
        icon: <CheckCircle className="h-5 w-5" />,
        text: "🎉 Fresh Tilapia Batch Processed - 2,500kg Ready for Distribution",
        bgColor: "bg-green-100",
        textColor: "text-green-800"
      },
      {
        id: '2',
        type: 'info',
        icon: <Fish className="h-5 w-5" />,
        text: "📊 Daily Production: 1,200kg Nile Perch | 800kg Tilapia | 600kg Catfish",
        bgColor: "bg-blue-100",
        textColor: "text-blue-800"
      },
      {
        id: '3',
        type: 'achievement',
        icon: <Award className="h-5 w-5" />,
        text: "🏆 Quality Excellence: 98.5% Grade A Fish This Month",
        bgColor: "bg-purple-100",
        textColor: "text-purple-800"
      },
      {
        id: '4',
        type: 'info',
        icon: <TrendingUp className="h-5 w-5" />,
        text: "📈 Revenue Growth: +15% This Quarter | New Outlets Added",
        bgColor: "bg-indigo-100",
        textColor: "text-indigo-800"
      },
      {
        id: '5',
        type: 'warning',
        icon: <AlertCircle className="h-5 w-5" />,
        text: "⚠️ Temperature Alert: Cold Storage at Optimal 2°C",
        bgColor: "bg-yellow-100",
        textColor: "text-yellow-800"
      },
      {
        id: '6',
        type: 'success',
        icon: <Star className="h-5 w-5" />,
        text: "⭐ Customer Satisfaction: 4.9/5 Rating | 50+ Happy Outlets",
        bgColor: "bg-emerald-100",
        textColor: "text-emerald-800"
      },
      {
        id: '7',
        type: 'info',
        icon: <Zap className="h-5 w-5" />,
        text: "⚡ Processing Speed: 3.2kg/minute | Efficiency Record Broken",
        bgColor: "bg-orange-100",
        textColor: "text-orange-800"
      },
      {
        id: '8',
        type: 'achievement',
        icon: <Award className="h-5 w-5" />,
        text: "🎯 Target Achieved: 15,000kg Monthly Production Goal Met",
        bgColor: "bg-rose-100",
        textColor: "text-rose-800"
      }
    ];

    setMarqueeItems(items);
  }, []);

  return (
    <div className="w-full bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200 shadow-sm overflow-hidden relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="relative py-2 overflow-hidden">
          <div className="flex animate-marquee-simple whitespace-nowrap">
            {marqueeItems.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-6 py-2 rounded-full ${item.bgColor} ${item.textColor} font-medium text-sm whitespace-nowrap mx-4 shadow-sm border flex-shrink-0`}
              >
                {item.icon}
                <span>{item.text}</span>
              </div>
            ))}
            {/* Duplicate for seamless loop */}
            {marqueeItems.map((item) => (
              <div
                key={`duplicate-${item.id}`}
                className={`flex items-center gap-3 px-6 py-2 rounded-full ${item.bgColor} ${item.textColor} font-medium text-sm whitespace-nowrap mx-4 shadow-sm border flex-shrink-0`}
              >
                {item.icon}
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
