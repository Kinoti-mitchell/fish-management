import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Fish } from '../../types';
import { getStatusBadge, formatDate } from '../../utils/helpers';
import { Edit, Trash2, MapPin, Calendar } from 'lucide-react';

interface FishCardProps {
  fish: Fish;
  onEdit: (fishId: string) => void;
  onDelete?: (fishId: string) => void;
}

export function FishCard({ fish, onEdit, onDelete }: FishCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{fish.name}</CardTitle>
          {getStatusBadge(fish.healthStatus)}
        </div>
        <p className="text-sm text-muted-foreground">{fish.species}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Age:</span>
            <p className="font-medium">{fish.age} years</p>
          </div>
          <div>
            <span className="text-muted-foreground">Weight:</span>
            <p className="font-medium">{fish.weight} kg</p>
          </div>
          <div>
            <span className="text-muted-foreground">Length:</span>
            <p className="font-medium">{fish.length} cm</p>
          </div>
          <div>
            <span className="text-muted-foreground">Zone:</span>
            <p className="font-medium flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {fish.location}
            </p>
          </div>
        </div>
        
        <div className="text-sm">
          <span className="text-muted-foreground">Last Checked:</span>
          <p className="font-medium flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(fish.lastChecked)}
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            className="flex-1"
            onClick={() => onEdit(fish.id)}
          >
            <Edit className="w-3 h-3 mr-1" />
            Edit
          </Button>
          {onDelete && (
            <Button 
              variant="outline" 
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => onDelete(fish.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
