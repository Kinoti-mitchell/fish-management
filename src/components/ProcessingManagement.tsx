import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { supabase } from "../lib/supabaseClient";
import { WarehouseEntry, ProcessingRecord, NavigationSection } from "../types";
import { getOrGenerateEntryCode, getOrGenerateProcessingCode } from "../utils/entryCodeGenerator";
import { RioFishLogo } from "./RioFishLogo";
import { 
  Plus, 
  Scissors, 
  Eye, 
  TrendingUp,
  Package,
  MapPin,
  Clock,
  Weight,
  Star,
  BarChart3,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Home,
  Calendar,
  Scale,
  FileText
} from "lucide-react";

// Types
interface ProcessingManagementProps {
  onNavigate: (section: NavigationSection, itemId?: string) => void;
}

interface ProcessingStats {
  totalProcessed: number;
  readyForProcessing: number;
  averageYield: number;
  totalWaste: number;
  gradeDistribution: { A: number; B: number; C: number };
  weeklyProcessing: { date: string; count: number }[];
  yieldTrends: { date: string; yield: number }[];
}

// Utility Functions
const getGradeColor = (grade: string) => {
  const colors = {
    A: "bg-green-500",
    B: "bg-yellow-500", 
    C: "bg-orange-500"
  };
  return colors[grade as keyof typeof colors] || "bg-gray-500";
};

const getYieldColor = (yieldValue: number) => {
  if (yieldValue >= 80) return "text-green-600";
  if (yieldValue >= 70) return "text-yellow-600";
  return "text-red-600";
};

// Chart Components
const SimpleBarChart = ({ data, dataKey }: { data: any[], dataKey: string }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        No data available
      </div>
    );
  }
  
  const maxValue = Math.max(...data.map(d => d[dataKey] || 0));
  return (
    <div className="flex items-end justify-between h-32 gap-1">
      {data.map((item, index) => (
        <div key={index} className="flex flex-col items-center flex-1">
          <div 
            className="bg-blue-500 rounded-t w-full min-h-[4px]"
            style={{ 
              height: `${maxValue > 0 ? ((item[dataKey] || 0) / maxValue) * 100 : 0}%` 
            }}
          />
          <span className="text-xs text-gray-600 mt-1 text-center">
            {item.date ? new Date(item.date).getDate() : index + 1}
          </span>
        </div>
      ))}
    </div>
  );
};

const SimpleLineChart = ({ data, dataKey }: { data: any[], dataKey: string }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        No data available
      </div>
    );
  }
  
  const values = data.map(d => d[dataKey] || 0);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue || 1;
  
  return (
    <div className="relative h-32">
      <svg width="100%" height="100%" className="overflow-visible">
        <polyline
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="2"
          points={data.map((item, index) => {
            const x = data.length > 1 ? (index / (data.length - 1)) * 100 : 50;
            const value = item[dataKey] || 0;
            const y = 100 - (((value - minValue) / range) * 80);
            // Ensure y is a valid number and remove % symbols
            const validY = isNaN(y) ? 50 : Math.max(0, Math.min(100, y));
            return `${x},${validY}`;
          }).join(' ')}
        />
        {data.map((item, index) => {
          const x = data.length > 1 ? (index / (data.length - 1)) * 100 : 50;
          const value = item[dataKey] || 0;
          const y = 100 - (((value - minValue) / range) * 80);
          const validY = isNaN(y) ? 50 : Math.max(0, Math.min(100, y));
          return (
            <circle
              key={index}
              cx={`${x}%`}
              cy={`${validY}%`}
              r="3"
              fill="#8b5cf6"
            />
          );
        })}
      </svg>
    </div>
  );
};

// Statistics Cards Component
const StatsCards = ({ stats, processingRecords }: { stats: ProcessingStats, processingRecords: ProcessingRecord[] }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
    <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm">Ready for Processing</p>
            <p className="text-3xl font-bold">{stats.readyForProcessing}</p>
          </div>
          <AlertCircle className="h-8 w-8 text-blue-200" />
        </div>
      </CardContent>
    </Card>

    <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100 text-sm">Total Processed</p>
            <p className="text-3xl font-bold">{stats.totalProcessed}</p>
          </div>
          <CheckCircle className="h-8 w-8 text-green-200" />
        </div>
      </CardContent>
    </Card>

    <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-100 text-sm">Average Yield</p>
            <p className="text-3xl font-bold">{stats.averageYield}%</p>
          </div>
          <TrendingUp className="h-8 w-8 text-purple-200" />
        </div>
      </CardContent>
    </Card>

    <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-100 text-sm">Total Waste</p>
            <p className="text-3xl font-bold">{stats.totalWaste}kg</p>
          </div>
          <BarChart3 className="h-8 w-8 text-orange-200" />
        </div>
      </CardContent>
    </Card>

  </div>
);

// Processing Form Component
const ProcessingForm = ({
  selectedEntryId,
  setSelectedEntryId,
  warehouseEntries,
  processingRecords,
  formData,
  setFormData,
  selectedStorage,
  setSelectedStorage,
  storageLocations,
  isProcessing,
  onSubmit,
  onClose
}: {
  selectedEntryId: string;
  setSelectedEntryId: (id: string) => void;
  warehouseEntries: WarehouseEntry[];
  processingRecords: ProcessingRecord[];
  formData: Partial<ProcessingRecord>;
  setFormData: (data: Partial<ProcessingRecord>) => void;
  selectedStorage: string;
  setSelectedStorage: (storage: string) => void;
  storageLocations: { id: string; name: string; capacity: number }[];
  isProcessing: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) => {
  const unprocessedEntries = warehouseEntries.filter(entry => 
    !selectedEntryId || entry.id === selectedEntryId
  ).filter(entry => 
    // Only show entries that haven't been processed yet
    !processingRecords.some(record => record.warehouse_entry_id === entry.id)
  );

  const handleInputChange = (field: keyof ProcessingRecord, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  if (!selectedEntryId) {
    return (
      <div className="py-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Select Warehouse Entry</h3>
          <p className="text-sm text-gray-600">Choose a warehouse entry to begin processing</p>
        </div>

        {unprocessedEntries.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No Entries Available</p>
            <p className="text-sm text-gray-400">
              {warehouseEntries.length === 0 
                ? "No warehouse entries found" 
                : "All warehouse entries have been processed"}
            </p>
            {warehouseEntries.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>{warehouseEntries.length}</strong> total warehouse entries exist, 
                  <strong> {processingRecords.length}</strong> have been processed
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {unprocessedEntries.map((entry) => (
              <Card 
                key={entry.id} 
                className="p-4 hover:shadow-md transition-all duration-200 cursor-pointer border hover:border-blue-300"
                onClick={() => setSelectedEntryId(entry.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Scale className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="outline" className="font-medium">
                          {entry.entry_code}
                        </Badge>
                        <Badge className="bg-green-500 text-white font-medium">
                          {entry.total_pieces} pieces
                        </Badge>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Weight className="h-4 w-4" />
                          {entry.total_weight}kg
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(entry.entry_date).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1 font-medium text-gray-900">
                          <MapPin className="h-4 w-4" />
                          {entry.farmer_name}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEntryId(entry.id);
                    }}
                  >
                    Select
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="flex justify-between pt-6 border-t mt-6">
          <Button 
            variant="outline" 
            onClick={() => {
              // Refresh the data when user wants to see updated entries
              window.location.reload();
            }}
            className="text-blue-600 border-blue-300 hover:bg-blue-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Entries
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4">
      {/* Selected Entry Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Selected Entry</h3>
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="outline" className="bg-white">
                {warehouseEntries.find(e => e.id === selectedEntryId)?.entry_code}
              </Badge>
              <span className="text-blue-700">
                {warehouseEntries.find(e => e.id === selectedEntryId)?.total_weight}kg - {warehouseEntries.find(e => e.id === selectedEntryId)?.total_pieces} pieces
              </span>
              <span className="text-blue-600">
                • {warehouseEntries.find(e => e.id === selectedEntryId)?.farmer_name}
              </span>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setSelectedEntryId("");
              setFormData({});
            }}
          >
            Change Entry
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Processing Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Pre-Processing Weight (kg)</Label>
            <Input
              type="number"
              value={warehouseEntries.find(e => e.id === selectedEntryId)?.total_weight || ""}
              readOnly
              className="bg-gray-50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Post-Processing Weight (kg) *</Label>
            <Input
              type="number"
              step="0.1"
              value={formData.post_processing_weight || ""}
              onChange={(e) => handleInputChange("post_processing_weight", Number(e.target.value))}
              placeholder="Enter weight after processing"
            />
          </div>
        </div>

        {/* Live Calculations */}
        {formData.post_processing_weight && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Processing Calculations</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="bg-white p-3 rounded-lg border">
                <p className="text-sm text-gray-600">Processing Waste</p>
                <p className="text-xl font-bold text-red-600">
                  {formData.processing_waste || 0}kg
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <p className="text-sm text-gray-600">Processing Yield</p>
                <p className={`text-xl font-bold ${getYieldColor(formData.processing_yield || 0)}`}>
                  {formData.processing_yield || 0}%
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <p className="text-sm text-gray-600">Weight Loss</p>
                <p className="text-xl font-bold text-orange-600">
                  {((formData.processing_waste || 0) / (warehouseEntries.find(e => e.id === selectedEntryId)?.total_weight || 1) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Number of Fish</Label>
            <Input
              type="number"
              value={warehouseEntries.find(e => e.id === selectedEntryId)?.total_pieces || ""}
              readOnly
              className="bg-gray-50"
            />
            <p className="text-xs text-gray-500">
              Inherited from warehouse entry
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Final Grade *</Label>
            <Select 
              value={formData.final_grade || ""} 
              onValueChange={(value) => handleInputChange("final_grade", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">Grade A</SelectItem>
                <SelectItem value="B">Grade B</SelectItem>
                <SelectItem value="C">Grade C</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Size classification will be determined during sorting process
            </p>
          </div>
        </div>

        {/* Fish Type Display */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Fish Type</Label>
          <Input
            value={warehouseEntries.find(e => e.id === selectedEntryId)?.fish_type || "Not specified"}
            readOnly
            className="bg-gray-50"
          />
          <p className="text-xs text-gray-500">
            Inherited from warehouse entry
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h4 className="font-medium text-blue-900">Next Step: Sorting</h4>
              <p className="text-sm text-blue-700">
                After processing, fish will be sorted into size classes and assigned to storage locations.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!formData.post_processing_weight || !formData.final_grade || isProcessing}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "Complete Processing"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Main Component
export default function ProcessingManagement({ onNavigate }: ProcessingManagementProps) {
  // State
  const [warehouseEntries, setWarehouseEntries] = useState<WarehouseEntry[]>([]);
  const [processingRecords, setProcessingRecords] = useState<ProcessingRecord[]>([]);
  const [recentRecords, setRecentRecords] = useState<ProcessingRecord[]>([]);
  const [storageLocations, setStorageLocations] = useState<{ 
    id: string; 
    name: string; 
    capacity: number; 
    currentUsage?: number; 
    availableCapacity?: number; 
  }[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string>("");
  const [selectedStorage, setSelectedStorage] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewDetailsRecord, setViewDetailsRecord] = useState<ProcessingRecord | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [formData, setFormData] = useState<Partial<ProcessingRecord>>({});
  const [stats, setStats] = useState<ProcessingStats>({
    totalProcessed: 0,
    readyForProcessing: 0,
    averageYield: 0,
    totalWaste: 0,
    gradeDistribution: { A: 0, B: 0, C: 0 },
    weeklyProcessing: [],
    yieldTrends: []
  });

  // Data fetching functions
  const fetchWarehouseEntries = async () => {
    const { data, error } = await supabase
      .from("warehouse_entries")
      .select(`
        *,
        farmers!inner(name)
      `)
      .order("entry_date", { ascending: false });
    if (error) console.error("Error fetching warehouse entries:", error.message);
    else {
      // Transform the data to include farmer_name and ensure entry_code exists
      const transformedData = await Promise.all(
        (data || []).map(async (entry) => {
          const entryCode = entry.entry_code || await getOrGenerateEntryCode(entry.id);
          return {
            ...entry,
            farmer_name: entry.farmers?.name || `Farmer ID: ${entry.farmer_id}`,
            entry_code: entryCode
          };
        })
      );
      setWarehouseEntries(transformedData);
    }
  };

  const fetchProcessingRecords = async () => {
    const { data, error } = await supabase
      .from("processing_records")
      .select(`
        *,
        warehouse_entries!inner(
          id,
          farmer_id,
          farmers!inner(name)
        )
      `)
      .order("processing_date", { ascending: false });
    if (error) console.error("Error fetching processing records:", error.message);
    else {
      // Transform the data to include farmer_name, processing_code, and extract grade/size from JSONB
      const transformedData = await Promise.all(
        (data || []).map(async (record) => {
          const gradingResults = record.grading_results || {};
          const sizeDistribution = record.size_distribution || {};
          
          // Extract the first grade and size from the JSONB data
          const finalGrade = Object.keys(gradingResults)[0] || 'A';
          const finalSize = Object.keys(sizeDistribution)[0] || '0';
          
          // Get or generate processing code
          const processingCode = record.processing_code || await getOrGenerateProcessingCode(record.id);
          
          return {
            ...record,
            farmer_name: record.warehouse_entries?.farmers?.name || 'Unknown Farmer',
            final_grade: finalGrade,
            final_size: null, // Size will be determined during sorting
            storage_location: 'Not specified', // This field doesn't exist in the schema
            ready_for_dispatch: false,
            processing_code: processingCode
          };
        })
      );
      setProcessingRecords(transformedData);
      setRecentRecords(transformedData.slice(0, 5));
    }
  };

  const fetchStorageLocations = async () => {
    try {
      const { data, error } = await supabase
        .from("storage_locations")
        .select("*")
        .eq("status", "active")
        .order("name");
      
      if (error) {
        console.warn("Storage locations table not found, using default locations:", error.message);
        // Fallback to default storage locations if table doesn't exist
        setStorageLocations([
          { id: "1", name: "Cold Storage A", capacity: 2000 },
          { id: "2", name: "Cold Storage B", capacity: 1500 },
          { id: "3", name: "Freezer Unit 1", capacity: 1000 },
          { id: "4", name: "Processing Area 1", capacity: 500 },
          { id: "5", name: "Processing Area 2", capacity: 500 }
        ]);
      } else {
        // Get current usage from processing records
        const { data: processingData, error: processingError } = await supabase
          .from("processing_records")
          .select("post_processing_weight");

        // Calculate current usage per storage location
        const usageMap = new Map<string, number>();
        if (processingData && !processingError) {
          // Since storage_location doesn't exist, we'll distribute weight across all locations
          const totalWeight = processingData.reduce((sum, record) => sum + (record.post_processing_weight || 0), 0);
          const weightPerLocation = totalWeight / (data?.length || 1);
          
          data?.forEach(location => {
            usageMap.set(location.name, weightPerLocation);
          });
        }

        const locations = data?.map(loc => ({
          id: loc.id,
          name: loc.name,
          capacity: loc.capacity_kg,
          currentUsage: usageMap.get(loc.name) || 0,
          availableCapacity: loc.capacity_kg - (usageMap.get(loc.name) || 0)
        })) || [];
        
        // Filter out locations that are at or over capacity
        const availableLocations = locations.filter(loc => loc.availableCapacity > 0);
        
        // If no locations found, use defaults
        if (availableLocations.length === 0) {
          console.warn("No available storage locations found, using defaults");
          setStorageLocations([
            { id: "1", name: "Cold Storage A", capacity: 2000 },
            { id: "2", name: "Cold Storage B", capacity: 1500 },
            { id: "3", name: "Freezer Unit 1", capacity: 1000 },
            { id: "4", name: "Processing Area 1", capacity: 500 },
            { id: "5", name: "Processing Area 2", capacity: 500 }
          ]);
        } else {
          setStorageLocations(availableLocations);
        }
      }
    } catch (error) {
      console.warn("Error fetching storage locations, using defaults:", error);
      // Fallback to default storage locations
      setStorageLocations([
        { id: "1", name: "Cold Storage A", capacity: 2000 },
        { id: "2", name: "Cold Storage B", capacity: 1500 },
        { id: "3", name: "Freezer Unit 1", capacity: 1000 },
        { id: "4", name: "Processing Area 1", capacity: 500 },
        { id: "5", name: "Processing Area 2", capacity: 500 }
      ]);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchWarehouseEntries(),
        fetchProcessingRecords(),
        fetchStorageLocations()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Statistics calculation
  const calculateStats = () => {
    const unprocessedCount = warehouseEntries.filter(
      entry => !processingRecords.some(record => record.warehouse_entry_id === entry.id)
    ).length;

    const totalYield = processingRecords.reduce((sum, record) => sum + (record.processing_yield || 0), 0);
    const averageYield = processingRecords.length > 0 ? totalYield / processingRecords.length : 0;
    const totalWaste = processingRecords.reduce((sum, record) => sum + (record.processing_waste || 0), 0);

    const gradeDistribution = processingRecords.reduce(
      (acc, record) => {
        if (record.final_grade && ['A', 'B', 'C'].includes(record.final_grade)) {
          acc[record.final_grade as 'A' | 'B' | 'C']++;
        }
        return acc;
      },
      { A: 0, B: 0, C: 0 }
    );

    const weeklyProcessing = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const count = processingRecords.filter(record => 
        record.processing_date?.startsWith(dateStr)
      ).length;
      return { date: dateStr, count };
    }).reverse();

    const yieldTrends = processingRecords
      .slice(0, 10)
      .map((record) => ({
        date: new Date(record.processing_date).toLocaleDateString(),
        yield: record.processing_yield || 0
      }))
      .reverse();

    setStats({
      totalProcessed: processingRecords.length,
      readyForProcessing: unprocessedCount,
      averageYield: Number(averageYield.toFixed(1)),
      totalWaste: Number(totalWaste.toFixed(1)),
      gradeDistribution,
      weeklyProcessing,
      yieldTrends
    });
  };

  // Auto-fill form data when warehouse entry selected
  useEffect(() => {
    if (selectedEntryId && warehouseEntries.length > 0) {
      const entry = warehouseEntries.find((e) => e.id === selectedEntryId);
      if (entry) {
        setFormData((prev) => ({
          ...prev,
          warehouse_entry_id: entry.id,
          pre_processing_weight: entry.total_weight ? Number(entry.total_weight) : 0,
          post_processing_weight: 0, // Reset to 0 for processing team to enter
          final_grade: prev.final_grade || "",
          // final_size removed - will be determined during sorting
          // fish_type and total_pieces are now inherited from warehouse entry, not stored in form data
          processing_date: new Date().toISOString(),
        }));
      }
    }
  }, [selectedEntryId, warehouseEntries]);

  // Update processing waste & yield whenever weights change
  useEffect(() => {
    if (formData.pre_processing_weight && formData.post_processing_weight !== undefined) {
      const waste = formData.pre_processing_weight - formData.post_processing_weight;
      const yieldPercent = formData.pre_processing_weight > 0
        ? (formData.post_processing_weight / formData.pre_processing_weight) * 100
        : 0;
      setFormData((prev) => ({
        ...prev,
        processing_waste: waste,
        processing_yield: Number(yieldPercent.toFixed(2)),
      }));
    }
  }, [formData.pre_processing_weight, formData.post_processing_weight]);

  // Effects
  useEffect(() => {
    fetchWarehouseEntries();
    fetchProcessingRecords();
    fetchStorageLocations();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [warehouseEntries, processingRecords]);

  // Event handlers
  const handleCreateProcessing = async () => {
    if (isProcessing) return; // Prevent double submission
    
    setIsProcessing(true);
    try {
      const selectedStorageLocation = storageLocations.find(s => s.name === selectedStorage);
      const selectedWarehouseEntry = warehouseEntries.find(e => e.id === selectedEntryId);
      
      // Additional validation: Check if this warehouse entry is already processed
      const { data: existingProcessing, error: checkError } = await supabase
        .from("processing_records")
        .select("id, processing_code")
        .eq("warehouse_entry_id", selectedEntryId)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      if (existingProcessing) {
        alert(`This warehouse entry has already been processed! Processing Code: ${existingProcessing.processing_code}`);
        return;
      }
      
      // Generate unique processing code
      const { generateUniqueProcessingCode } = await import("../utils/entryCodeGenerator");
      const processingCode = await generateUniqueProcessingCode();
      
      // Calculate ready_for_dispatch_count based on post-processing weight
      // Assuming average fish weight of 200g (0.2kg), so 5 pieces per kg
      const estimatedPieces = Math.round((formData.post_processing_weight || 0) * 5);
      
      const processingData = {
        warehouse_entry_id: formData.warehouse_entry_id,
        processing_date: new Date().toISOString().split('T')[0], // DATE format
        processed_by: null, // This should be a UUID, but we'll set to null for now
        pre_processing_weight: formData.pre_processing_weight,
        post_processing_weight: formData.post_processing_weight,
        processing_waste: formData.processing_waste,
        processing_yield: formData.processing_yield,
        size_distribution: {}, // Will be populated during sorting
        grading_results: {
          [formData.final_grade || 'A']: formData.post_processing_weight || 0
        },
        final_value: (formData.post_processing_weight || 0) * 450, // Assuming 450 KES per kg
        total_pieces: selectedWarehouseEntry?.total_pieces || 0, // Inherited from warehouse entry
        ready_for_dispatch_count: estimatedPieces, // Calculate based on post-processing weight
        processing_code: processingCode
      };

      const { error } = await supabase
        .from("processing_records")
        .insert([processingData]);
      
      if (error) {
        // Handle unique constraint violation specifically
        if (error.code === '23505' && error.message.includes('warehouse_entry_id')) {
          alert('This warehouse entry has already been processed! Please refresh the page to see the updated list.');
          await fetchProcessingRecords(); // Refresh the data
          return;
        }
        throw error;
      }
      
      await fetchProcessingRecords();
      handleCloseDialog();
      onNavigate("sorting");
    } catch (err: any) {
      console.error("Error creating processing record:", err.message);
      alert(`Error creating processing record: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedEntryId("");
    setFormData({});
    setSelectedStorage("");
    setIsProcessing(false);
  };


  const handleViewDetails = (record: ProcessingRecord) => {
    setViewDetailsRecord(record);
    setIsDetailsDialogOpen(true);
  };

  const unprocessedWarehouseEntries = warehouseEntries.filter(
    (entry) => !processingRecords.some((record) => record.warehouse_entry_id === entry.id)
  );

  return (
    <div className="min-h-screen bg-gray-50 content-container responsive-padding">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Scissors className="h-6 w-6 md:h-8 md:w-8 text-blue-600" /> 
              Processing Management
            </h1>
            <p className="text-gray-600 mt-1">Monitor and manage fish processing operations</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              variant="outline"
              onClick={() => onNavigate("dashboard")}
            >
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => open ? setIsDialogOpen(true) : handleCloseDialog()}>
              <DialogTrigger asChild>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  disabled={unprocessedWarehouseEntries.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" /> 
                  {unprocessedWarehouseEntries.length === 0 ? 'No Entries to Process' : 'Start Processing'}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Scissors className="h-5 w-5 text-blue-600" />
                    Start Fish Processing
                  </DialogTitle>
                </DialogHeader>

                <ProcessingForm
                  selectedEntryId={selectedEntryId}
                  setSelectedEntryId={setSelectedEntryId}
                  warehouseEntries={unprocessedWarehouseEntries}
                  processingRecords={processingRecords}
                  formData={formData}
                  setFormData={setFormData}
                  selectedStorage={selectedStorage}
                  setSelectedStorage={setSelectedStorage}
                  storageLocations={storageLocations}
                  isProcessing={isProcessing}
                  onSubmit={handleCreateProcessing}
                  onClose={handleCloseDialog}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Statistics Dashboard */}
        <StatsCards stats={stats} processingRecords={processingRecords} />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Weekly Processing Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleBarChart data={stats.weeklyProcessing} dataKey="count" />
              <div className="mt-2 text-center">
                <p className="text-sm text-gray-600">Last 7 days</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                Yield Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.yieldTrends.length > 0 ? (
                <SimpleLineChart data={stats.yieldTrends} dataKey="yield" />
              ) : (
                <div className="h-32 flex items-center justify-center text-gray-500">
                  No yield data available
                </div>
              )}
              <div className="mt-2 text-center">
                <p className="text-sm text-gray-600">Recent processing yield %</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grade Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Quality Grade Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(stats.gradeDistribution).map(([grade, count]) => (
                <div key={grade} className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <Badge className={`${getGradeColor(grade)} text-white mb-2`}>
                    Grade {grade}
                  </Badge>
                  <p className="text-2xl font-bold mt-2">{count}</p>
                  <p className="text-sm text-gray-600">
                    {stats.totalProcessed > 0 ? ((count / stats.totalProcessed) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Processing Records */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Processing Activity
              <Badge variant="secondary" className="ml-auto">
                {recentRecords.length} recent
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentRecords.length === 0 ? (
              <div className="text-center py-8">
                <Scissors className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No recent processing activity</p>
                <p className="text-sm text-gray-400">Start by processing some warehouse entries</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {recentRecords.map((record) => {
                    const warehouseEntry = warehouseEntries.find(e => e.id === record.warehouse_entry_id);
                    return (
                      <Card key={record.id} className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">
                                {warehouseEntries.find(e => e.id === record.warehouse_entry_id)?.entry_code}
                              </Badge>
                              <Badge className="bg-purple-500 text-white">
                                {record.processing_code}
                              </Badge>
                              <Badge className={`${getGradeColor(record.final_grade)} text-white`}>
                                Grade {record.final_grade}
                              </Badge>
                              <span className="text-sm text-gray-600">Size: To be sorted</span>
                              <Badge variant="outline" className="text-blue-600 border-blue-300">
                                Processing Complete
                              </Badge>
                              <span className="text-xs text-gray-400">
                                {new Date(record.processing_date).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm">
                              <span>Pre: {record.pre_processing_weight}kg</span>
                              <span>Post: {record.post_processing_weight}kg</span>
                              <span>Waste: {record.processing_waste}kg</span>
                              <span className={getYieldColor(record.processing_yield)}>
                                Yield: {record.processing_yield}%
                              </span>
                            </div>
                            <p className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3" />
                              <strong>{record.storage_location || 'Not assigned'}</strong>
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewDetails(record)}>
                              <Eye className="h-3 w-3 mr-1" />
                              Details
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
                <div className="mt-4 text-center">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAllRecords(!showAllRecords)}
                    className="w-full"
                  >
                    View All {processingRecords.length} Records
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* All Records Inline Expansion */}
        {showAllRecords && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                All Processing Records ({processingRecords.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {processingRecords.length === 0 ? (
                  <div className="text-center py-8">
                    <Scissors className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No processing records found</p>
                  </div>
                ) : (
                  processingRecords.map((record) => {
                    const warehouseEntry = warehouseEntries.find(e => e.id === record.warehouse_entry_id);
                    return (
                      <Card key={record.id} className="p-4 border border-gray-200 hover:shadow-md transition-all duration-200">
                        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="font-medium">
                                {warehouseEntries.find(e => e.id === record.warehouse_entry_id)?.entry_code}
                              </Badge>
                              <Badge className="bg-purple-500 text-white font-medium">
                                {record.processing_code}
                              </Badge>
                              <Badge className={`${getGradeColor(record.final_grade)} text-white font-medium`}>
                                Grade {record.final_grade}
                              </Badge>
                              <Badge className="bg-purple-500 text-white font-medium">
                                Size: To be sorted
                              </Badge>
                              <Badge variant="outline" className="text-blue-600 border-blue-300 font-medium">
                                Processing Complete
                              </Badge>
                              <span className="text-sm text-gray-500 flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {new Date(record.processing_date).toLocaleDateString()}
                              </span>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2 md:gap-6 text-sm">
                              <span>Pre: {record.pre_processing_weight}kg</span>
                              <span>Post: {record.post_processing_weight}kg</span>
                              <span>Waste: {record.processing_waste}kg</span>
                              <span className={getYieldColor(record.processing_yield)}>
                                Yield: {record.processing_yield}%
                              </span>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm">
                              <span className="flex items-center gap-1 font-medium text-gray-900">
                                <MapPin className="h-4 w-4" />
                                {record.farmer_name}
                              </span>
                              <span className="flex items-center gap-1 text-gray-600">
                                <Package className="h-4 w-4" />
                                Storage: {record.storage_location || 'Not assigned'}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button size="sm" variant="outline" onClick={() => handleViewDetails(record)}>
                              <Eye className="h-4 w-4 mr-1" />
                              View Details
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
              <div className="mt-6 text-center">
                <Button 
                  variant="outline" 
                  onClick={() => setShowAllRecords(false)}
                  className="w-full"
                >
                  Show Less
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* View Details Dialog */}
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Processing Details</DialogTitle>
            </DialogHeader>
            {viewDetailsRecord && (
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-4">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Entry Code</span>
                      <span className="font-medium">{warehouseEntries.find(e => e.id === viewDetailsRecord.warehouse_entry_id)?.entry_code}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Processing Code</span>
                      <span className="font-medium">{viewDetailsRecord.processing_code}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Processing Date</span>
                      <span className="font-medium">{new Date(viewDetailsRecord.processing_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Farmer</span>
                      <span className="font-medium">{viewDetailsRecord.farmer_name || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Processed By</span>
                      <span className="font-medium">{viewDetailsRecord.processed_by || 'Not specified'}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Final Grade</span>
                      <Badge className={`${getGradeColor(viewDetailsRecord.final_grade)} text-white`}>
                        Grade {viewDetailsRecord.final_grade}
                      </Badge>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Size</span>
                      <span className="font-medium">To be sorted</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Storage Location</span>
                      <span className="font-medium">{viewDetailsRecord.storage_location || 'Not assigned'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Status</span>
                      <Badge className="bg-green-600 text-white">Complete</Badge>
                    </div>
                  </div>
                </div>

                {/* Weight Information */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">Weight Analysis</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{viewDetailsRecord.pre_processing_weight}kg</div>
                      <div className="text-sm text-gray-600">Pre-Processing</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{viewDetailsRecord.post_processing_weight}kg</div>
                      <div className="text-sm text-gray-600">Post-Processing</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{viewDetailsRecord.processing_waste}kg</div>
                      <div className="text-sm text-gray-600">Waste</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${getYieldColor(viewDetailsRecord.processing_yield)}`}>
                        {viewDetailsRecord.processing_yield}%
                      </div>
                      <div className="text-sm text-gray-600">Yield</div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {viewDetailsRecord.notes && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Notes</h3>
                    <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{viewDetailsRecord.notes}</p>
                  </div>
                )}

                {/* Close Button */}
                <div className="flex justify-end pt-4">
                  <Button onClick={() => setIsDetailsDialogOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}