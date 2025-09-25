import { Card, CardContent, CardHeader, CardTitle } from './card';
import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  iconColor?: string;
  gradient?: string;
  trend?: number;
  className?: string;
  onClick?: () => void;
}

export function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  iconColor = 'text-muted-foreground',
  gradient,
  trend,
  className,
  onClick
}: StatCardProps) {
  return (
    <Card 
      className={`${gradient || ''} ${className || ''}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`h-4 w-4 ${iconColor}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-xl md:text-2xl font-bold">{String(value || 0)}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
        {trend !== undefined && (
          <p className={`text-xs flex items-center gap-1 mt-1 ${
            trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-muted-foreground'
          }`}>
            <span>
              {trend > 0 ? '↗' : trend < 0 ? '↘' : '→'}
            </span>
            {trend > 0 ? '+' : ''}{trend}%
          </p>
        )}
      </CardContent>
    </Card>
  );
}
