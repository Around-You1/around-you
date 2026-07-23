import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";

interface CategoryStats {
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
}

interface PartnerCategoryMetricsProps {
  title: string;
  icon: LucideIcon;
  color: string;
  stats: CategoryStats;
}

export default function PartnerCategoryMetrics({ title, icon: Icon, color, stats }: PartnerCategoryMetricsProps) {
  const activePercentage = stats.totalCount > 0 
    ? Math.round((stats.activeCount / stats.totalCount) * 100) 
    : 0;

  return (
    <Card className="overflow-hidden border-l-2 transition-all hover:shadow-lg" style={{ borderLeftColor: color }}>
      <CardHeader className="pb-0 pt-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold flex items-center gap-1">
            <Icon className="h-3 w-3" style={{ color }} />
            {title}
          </CardTitle>
          <div className="text-lg font-bold" style={{ color }}>
            {stats.totalCount}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-0.5 pb-2 pt-1.5 px-3">
        <div className="space-y-0.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Badge 
                variant="outline" 
                className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 text-[10px] px-1 py-0 h-4"
              >
                Active
              </Badge>
              <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                {stats.activeCount}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {activePercentage}%
            </div>
          </div>

          <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
            <div 
              className="bg-green-500 h-full transition-all duration-500 ease-out"
              style={{ width: `${activePercentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Badge 
                variant="outline" 
                className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800 text-[10px] px-1 py-0 h-4"
              >
                Inactive
              </Badge>
              <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                {stats.inactiveCount}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {100 - activePercentage}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
