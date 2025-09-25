import { useState, useEffect } from "react";
import Marquee from "./ui/marquee";
import { Trash2, AlertTriangle, TrendingDown, Clock, DollarSign, Package, Scale, Activity } from "lucide-react";

interface DisposalStats {
  totalDisposals?: number;
  totalDisposedWeight?: number;
  totalDisposalCost?: number;
  pendingDisposals?: number;
  recentDisposals?: number;
  averageDisposalAge?: number;
  topDisposalReason?: string;
  monthlyDisposalTrend?: number;
}

interface DisposalMarqueeProps {
  stats?: DisposalStats;
}

export function DisposalMarquee({ stats }: DisposalMarqueeProps) {
  const [marqueeItems, setMarqueeItems] = useState<any[]>([]);

  useEffect(() => {
    // Generate dynamic disposal marquee items using real data
    const items = [
      {
        id: '1',
        type: 'warning',
        icon: <Trash2 className="h-5 w-5" />,
        text: `🗑️ Total Disposals: ${stats?.totalDisposals || 0} records | ${(stats?.totalDisposedWeight || 0).toFixed(1)}kg disposed`,
        bgColor: "bg-orange-100",
        textColor: "text-orange-800"
      },
      {
        id: '2',
        type: 'info',
        icon: <DollarSign className="h-5 w-5" />,
        text: `💰 Disposal Costs: KES ${(stats?.totalDisposalCost || 0).toLocaleString()} total cost | ${(stats?.averageDisposalAge || 0).toFixed(1)} days avg age`,
        bgColor: "bg-red-100",
        textColor: "text-red-800"
      },
      {
        id: '3',
        type: 'warning',
        icon: <AlertTriangle className="h-5 w-5" />,
        text: `⚠️ Pending Disposals: ${stats?.pendingDisposals || 0} awaiting approval | ${stats?.recentDisposals || 0} this week`,
        bgColor: "bg-yellow-100",
        textColor: "text-yellow-800"
      },
      {
        id: '4',
        type: 'info',
        icon: <TrendingDown className="h-5 w-5" />,
        text: `📉 Disposal Trend: ${stats?.monthlyDisposalTrend || 0}% change this month | Top reason: ${stats?.topDisposalReason || 'Age'}`,
        bgColor: "bg-purple-100",
        textColor: "text-purple-800"
      },
      {
        id: '5',
        type: 'info',
        icon: <Clock className="h-5 w-5" />,
        text: `⏰ Average Age: ${(stats?.averageDisposalAge || 0).toFixed(1)} days before disposal | Quality control active`,
        bgColor: "bg-indigo-100",
        textColor: "text-indigo-800"
      },
      {
        id: '6',
        type: 'success',
        icon: <Package className="h-5 w-5" />,
        text: `📦 Waste Management: Efficient disposal system | Environmental compliance maintained`,
        bgColor: "bg-green-100",
        textColor: "text-green-800"
      },
      {
        id: '7',
        type: 'info',
        icon: <Scale className="h-5 w-5" />,
        text: `⚖️ Quality Control: Automated disposal triggers | Storage optimization active`,
        bgColor: "bg-blue-100",
        textColor: "text-blue-800"
      },
      {
        id: '8',
        type: 'achievement',
        icon: <Activity className="h-5 w-5" />,
        text: `🎯 Rio Fish Farm: Leading waste management practices in Kenya's fish industry`,
        bgColor: "bg-emerald-100",
        textColor: "text-emerald-800"
      }
    ];

    setMarqueeItems(items);
  }, [stats]);

  return (
    <div className="w-full bg-gradient-to-r from-orange-50 to-red-50 border-b border-orange-200 shadow-sm overflow-hidden relative z-10">
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
