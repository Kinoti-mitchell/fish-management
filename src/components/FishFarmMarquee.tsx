import { useState, useEffect } from "react";
import Marquee from "./ui/marquee";
import { Fish, TrendingUp, AlertCircle, CheckCircle, Star, Award, Zap, Truck, Package, Users } from "lucide-react";

interface MarqueeItem {
  id: string;
  type: 'success' | 'info' | 'warning' | 'achievement';
  icon: React.ReactNode;
  text: string;
  bgColor: string;
  textColor: string;
}

interface DashboardStats {
  totalReadyForDispatch?: number;
  totalWarehouseEntries?: number;
  totalWeight?: number;
  totalOrders?: number;
  totalFarmers?: number;
  recentProcessingCount?: number;
  totalDispatches?: number;
}

interface FishFarmMarqueeProps {
  stats?: DashboardStats;
}

export function FishFarmMarquee({ stats }: FishFarmMarqueeProps) {
  const [marqueeItems, setMarqueeItems] = useState<MarqueeItem[]>([]);

  useEffect(() => {
    // Generate dynamic marquee items using real dashboard data
    const items: MarqueeItem[] = [
      {
        id: '1',
        type: 'success',
        icon: <Truck className="h-5 w-5" />,
        text: `🚚 Ready for Dispatch: ${stats?.totalReadyForDispatch || 0} fish ready for delivery`,
        bgColor: "bg-green-100",
        textColor: "text-green-800"
      },
      {
        id: '2',
        type: 'info',
        icon: <Package className="h-5 w-5" />,
        text: `📦 Warehouse Entries: ${stats?.totalWarehouseEntries || 0} total entries | ${(stats?.totalWeight || 0).toLocaleString()}kg total weight`,
        bgColor: "bg-blue-100",
        textColor: "text-blue-800"
      },
      {
        id: '3',
        type: 'achievement',
        icon: <CheckCircle className="h-5 w-5" />,
        text: `✅ Processing Success: +${stats?.recentProcessingCount || 0} fish processed this week`,
        bgColor: "bg-purple-100",
        textColor: "text-purple-800"
      },
      {
        id: '4',
        type: 'info',
        icon: <TrendingUp className="h-5 w-5" />,
        text: `📈 Orders & Dispatches: ${stats?.totalOrders || 0} total orders | ${stats?.totalDispatches || 0} dispatches completed`,
        bgColor: "bg-indigo-100",
        textColor: "text-indigo-800"
      },
      {
        id: '5',
        type: 'info',
        icon: <Users className="h-5 w-5" />,
        text: `👥 Farmer Network: ${stats?.totalFarmers || 0} active farmers contributing to production`,
        bgColor: "bg-yellow-100",
        textColor: "text-yellow-800"
      },
      {
        id: '6',
        type: 'success',
        icon: <Star className="h-5 w-5" />,
        text: `⭐ System Status: All operations running smoothly | Real-time data updates`,
        bgColor: "bg-emerald-100",
        textColor: "text-emerald-800"
      },
      {
        id: '7',
        type: 'info',
        icon: <Fish className="h-5 w-5" />,
        text: `🐟 Production Excellence: High-quality fish processing and distribution system`,
        bgColor: "bg-orange-100",
        textColor: "text-orange-800"
      },
      {
        id: '8',
        type: 'achievement',
        icon: <Award className="h-5 w-5" />,
        text: `🎯 Rio Fish Farm: Leading fish processing and distribution in Kenya`,
        bgColor: "bg-rose-100",
        textColor: "text-rose-800"
      }
    ];

    setMarqueeItems(items);
  }, [stats]);

  return (
    <div className="w-full bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200 shadow-sm overflow-hidden relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="relative py-2 sm:py-3 overflow-hidden">
          <div className="flex animate-marquee-simple whitespace-nowrap">
            {marqueeItems.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-1 sm:py-2 rounded-full ${item.bgColor} ${item.textColor} font-medium text-xs sm:text-sm whitespace-nowrap mx-2 sm:mx-4 shadow-sm border flex-shrink-0`}
              >
                {item.icon}
                <span>{item.text}</span>
              </div>
            ))}
            {/* Duplicate for seamless loop */}
            {marqueeItems.map((item) => (
              <div
                key={`duplicate-${item.id}`}
                className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-1 sm:py-2 rounded-full ${item.bgColor} ${item.textColor} font-medium text-xs sm:text-sm whitespace-nowrap mx-2 sm:mx-4 shadow-sm border flex-shrink-0`}
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
