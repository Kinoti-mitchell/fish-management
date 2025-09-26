import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Alert, AlertDescription } from "./ui/alert";
import { Warehouse, CheckCircle, AlertTriangle, Plus, Fish, Calendar, Weight, DollarSign, MapPin, User, Loader2, X, Search, Filter, Download, Eye, Edit, Trash2, BarChart3, TrendingUp, Package, ChevronDown } from "lucide-react";
import { NavigationSection } from "../types";
import { generateUniqueEntryCode, getOrGenerateEntryCode } from "../utils/entryCodeGenerator";
import { RioFishLogo } from "./RioFishLogo";
import { auditLog } from "../utils/auditLogger";

interface WarehouseEntryProps {
  onNavigate: (section: NavigationSection, itemId?: string) => void;
}

interface Farmer {
  id: number;
  name: string;
  location: string;
  phone?: string;
  rating?: number;
  total_orders?: number;
  reliability?: number;
  last_order_date?: string;
  status?: string;
}

interface WarehouseEntry {
  id: string;
  entry_date: string;
  total_weight: number;
  total_pieces: number;
  condition: string;
  farmer_id: number;
  farmer_name?: string; // Optional since it might not be in the database
  price_per_kg: number;
  total_value: number;
  notes?: string;
  created_at: string;
  entry_code?: string;
}

export default function WarehouseEntry({ onNavigate }: WarehouseEntryProps) {
  const [entries, setEntries] = useState<WarehouseEntry[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    farmerId: "",
    totalWeight: "",
    totalPieces: "",
    pricePerKg: "",
    condition: "",
    fishType: "",
    notes: ""
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCondition, setFilterCondition] = useState("all");
  const [showStats, setShowStats] = useState(true);
  const [editingEntry, setEditingEntry] = useState<WarehouseEntry | null>(null);
  const [expandedFarmers, setExpandedFarmers] = useState<Set<number>>(new Set());
  const [groupByFarmer, setGroupByFarmer] = useState(true);

  // Map user-friendly grade names to database values
  const mapGradeToDatabase = (condition: string): string => {
    switch (condition) {
      case "excellent": return "excellent";
      case "good": return "good"; 
      case "fair": return "fair";
      default: return "good";
    }
  };

  // Map database grade values back to user-friendly names for display
  const mapGradeFromDatabase = (grade: string): string => {
    switch (grade) {
      case "excellent": return "excellent";
      case "good": return "good";
      case "fair": return "fair";
      case "poor": return "poor";
      default: return "good";
    }
  };

  // Helper function to get farmer name by ID
  const getFarmerName = (farmerId: number): string => {
    const farmer = farmers.find(f => f.id === farmerId);
    return farmer ? farmer.name : `Farmer ID: ${farmerId}`;
  };

  // Group entries by farmer
  const groupEntriesByFarmer = (entries: WarehouseEntry[]) => {
    const grouped = entries.reduce((acc, entry) => {
      const farmerId = entry.farmer_id;
      if (!acc[farmerId]) {
        acc[farmerId] = {
          farmer: farmers.find(f => f.id === farmerId) || { id: farmerId, name: `Farmer ID: ${farmerId}`, location: 'Unknown' },
          entries: [],
          totalWeight: 0,
          totalValue: 0,
          totalPieces: 0,
          entryCount: 0
        };
      }
      acc[farmerId].entries.push(entry);
      acc[farmerId].totalWeight += entry.total_weight;
      acc[farmerId].totalValue += entry.total_value;
      acc[farmerId].totalPieces += entry.total_pieces;
      acc[farmerId].entryCount += 1;
      return acc;
    }, {} as Record<number, { farmer: Farmer; entries: WarehouseEntry[]; totalWeight: number; totalValue: number; totalPieces: number; entryCount: number }>);

    return Object.values(grouped).sort((a, b) => b.totalValue - a.totalValue);
  };

  // Toggle farmer expansion
  const toggleFarmerExpansion = (farmerId: number) => {
    const newExpanded = new Set(expandedFarmers);
    if (newExpanded.has(farmerId)) {
      newExpanded.delete(farmerId);
    } else {
      newExpanded.add(farmerId);
    }
    setExpandedFarmers(newExpanded);
  };


  // Fetch farmers from database
  const fetchFarmers = async () => {
    try {
      const { data, error } = await supabase
        .from("farmers")
        .select("*")
        .eq("status", "active")
        .order("name");
      
      if (error) throw error;
      setFarmers(data || []);
    } catch (error: any) {
      // Set empty array as fallback - user can create sample farmer if needed
      setFarmers([]);
    }
  };

  // Fetch warehouse entries from database
  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from("warehouse_entries")
        .select(`
          *,
          farmers!inner(name)
        `)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
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
      setEntries(transformedData);
    } catch (error: any) {
      // Silently handle error - entries will be empty array
      setEntries([]);
    }
  };

  useEffect(() => {
    fetchFarmers();
    fetchEntries();
  }, []);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.farmerId) {
      errors.farmerId = "Please select a farmer";
    }
    if (!formData.totalWeight || parseFloat(formData.totalWeight) <= 0) {
      errors.totalWeight = "Please enter a valid weight";
    }
    if (!formData.totalPieces || parseInt(formData.totalPieces) <= 0) {
      errors.totalPieces = "Please enter valid number of pieces";
    }
    if (!formData.pricePerKg || parseFloat(formData.pricePerKg) <= 0) {
      errors.pricePerKg = "Please enter a valid price per kg";
    }
    if (!formData.condition) {
      errors.condition = "Please select a grade/condition";
    }
    if (!formData.fishType) {
      errors.fishType = "Please select a fish type";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Audit logging function - using centralized audit logger
  const logAuditEvent = async (action: string, tableName: string, recordId?: string, oldValues?: any, newValues?: any) => {
    try {
      await auditLog.custom(action, tableName, recordId, {
        old_values: oldValues,
        new_values: newValues
      });
    } catch (error) {
      console.warn('Failed to log audit event:', error);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Find farmer by ID - handle both string and number IDs
      const selectedFarmer = farmers.find(f => {
        return f.id.toString() === formData.farmerId || f.id === parseInt(formData.farmerId);
      });
      
      if (!selectedFarmer) {
        throw new Error("Selected farmer not found");
      }

      const weight = parseFloat(formData.totalWeight);
      const pricePerKg = parseFloat(formData.pricePerKg);

      // Generate unique entry code for new entry
      const nextEntryCode = await generateUniqueEntryCode();

      const newEntry = {
        entry_date: new Date().toISOString().split("T")[0],
        total_weight: weight,
        total_pieces: parseInt(formData.totalPieces),
        condition: mapGradeToDatabase(formData.condition),
        fish_type: formData.fishType,
        farmer_id: selectedFarmer.id,
        price_per_kg: pricePerKg,
        total_value: weight * pricePerKg,
        notes: formData.notes.trim() || "",
        entry_code: nextEntryCode,
      };

      const { data, error } = await supabase
        .from("warehouse_entries")
        .insert([newEntry])
        .select();
      
      if (error) throw error;

      // Add new entry to the list immediately (optimistic update)
      if (data && data.length > 0) {
        setEntries(prevEntries => [data[0], ...prevEntries]);
        
        // Log audit event
        await logAuditEvent('INSERT', 'warehouse_entries', data[0].id, null, newEntry);
      }

      // Reset form
      setFormData({
        farmerId: "",
        totalWeight: "",
        totalPieces: "",
        pricePerKg: "",
        condition: "",
        fishType: "",
        notes: ""
      });
      setFormErrors({});
      setIsNewEntryOpen(false);
      setSuccess("Entry recorded successfully!");
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError("Failed to save entry: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getConditionColor = (grade: string) => {
    const condition = mapGradeFromDatabase(grade);
    switch (condition) {
      case "excellent": return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "good": return "bg-blue-100 text-blue-800 border-blue-300";
      case "fair": return "bg-amber-100 text-amber-800 border-amber-300";
      default: return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getConditionIcon = (grade: string) => {
    const condition = mapGradeFromDatabase(grade);
    switch (condition) {
      case "excellent":
      case "good": 
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "fair": 
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      default: 
        return <CheckCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatCurrency = (amount: number) => `KES ${amount.toLocaleString()}`;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Filter and search functions
  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.farmer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.entry_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterCondition === "all" || entry.condition === filterCondition;
    return matchesSearch && matchesFilter;
  });

  // Calculate statistics
  const calculateStats = () => {
    const totalWeight = entries.reduce((sum, entry) => sum + entry.total_weight, 0);
    const totalValue = entries.reduce((sum, entry) => sum + entry.total_value, 0);
    const totalPieces = entries.reduce((sum, entry) => sum + entry.total_pieces, 0);
    const avgPricePerKg = entries.length > 0 ? totalValue / totalWeight : 0;
    
    const conditionCounts = entries.reduce((acc, entry) => {
      acc[entry.condition] = (acc[entry.condition] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalWeight,
      totalValue,
      totalPieces,
      avgPricePerKg,
      conditionCounts,
      totalEntries: entries.length
    };
  };

  const stats = calculateStats();

  // Export functionality
  const exportEntries = () => {
    const csvContent = [
      ['Entry Code', 'Date', 'Farmer', 'Weight (kg)', 'Pieces', 'Price/kg', 'Total Value', 'Condition', 'Notes'],
      ...filteredEntries.map(entry => [
        entry.entry_code || '',
        entry.entry_date,
        entry.farmer_name || '',
        entry.total_weight,
        entry.total_pieces,
        entry.price_per_kg,
        entry.total_value,
        entry.condition,
        entry.notes || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warehouse-entries-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };


  return (
    <div className="min-h-screen bg-gray-50 content-container responsive-padding">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Logo */}
        {/* Success/Error Messages */}
        {success && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSuccess(null)}
              className="ml-auto h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </Alert>
        )}
        
        {error && (
          <Alert className="border-red-200 bg-red-50 text-red-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="ml-auto h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </Alert>
        )}

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Warehouse className="h-8 w-8 text-blue-600" />
              Warehouse Entry
            </h1>
            <p className="text-gray-600 mt-1">Track fish deliveries and manage inventory</p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline"
              onClick={() => setShowStats(!showStats)}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              {showStats ? 'Hide Stats' : 'Show Stats'}
            </Button>
            <Button 
              variant="outline"
              onClick={() => onNavigate("dashboard")}
            >
              Dashboard
            </Button>
            <Dialog open={isNewEntryOpen} onOpenChange={setIsNewEntryOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  size="lg"
                >
                  <Plus className="h-5 w-5 mr-2" /> 
                  New Entry
                </Button>
              </DialogTrigger>

            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl flex items-center gap-3">
                  <Fish className="h-6 w-6 text-blue-600" />
                  Record New Warehouse Entry
                </DialogTitle>
                <p className="text-sm text-gray-600 mt-2">
                  Enter details for a new fish delivery from a farmer to the warehouse.
                </p>
              </DialogHeader>
              
              <div className="space-y-6 py-6">
                {/* Farmer Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Select Farmer *
                  </Label>
                  <Select 
                    value={formData.farmerId} 
                    onValueChange={v => {
                      setFormData({ ...formData, farmerId: v });
                      if (formErrors.farmerId) {
                        setFormErrors({ ...formErrors, farmerId: "" });
                      }
                    }}
                  >
                    <SelectTrigger className={`h-12 ${formErrors.farmerId ? 'border-red-300 focus:border-red-500' : ''}`}>
                      <SelectValue placeholder="Choose a farmer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {farmers.length > 0 ? (
                        farmers.map(f => (
                          <SelectItem key={f.id} value={f.id.toString()}>
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="font-medium">{f.name}</div>
                                <div className="text-sm text-gray-500 flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {f.location}
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-farmers" disabled>
                          No active farmers found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {formErrors.farmerId && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {formErrors.farmerId}
                    </p>
                  )}
                </div>

                {/* Delivery Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <Label className="text-base font-medium flex items-center gap-2">
                      <Weight className="h-4 w-4" />
                      Total Weight (kg) *
                    </Label>
                    <Input 
                      type="number" 
                      step="0.1" 
                      placeholder="e.g. 150.5" 
                      value={formData.totalWeight} 
                      onChange={e => {
                        setFormData({ ...formData, totalWeight: e.target.value });
                        if (formErrors.totalWeight) {
                          setFormErrors({ ...formErrors, totalWeight: "" });
                        }
                      }}
                      className={`h-12 ${formErrors.totalWeight ? 'border-red-300 focus:border-red-500' : ''}`}
                    />
                    {formErrors.totalWeight && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {formErrors.totalWeight}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="text-base font-medium flex items-center gap-2">
                      <Fish className="h-4 w-4" />
                      Number of Pieces *
                    </Label>
                    <Input 
                      type="number" 
                      placeholder="e.g. 75" 
                      value={formData.totalPieces} 
                      onChange={e => {
                        setFormData({ ...formData, totalPieces: e.target.value });
                        if (formErrors.totalPieces) {
                          setFormErrors({ ...formErrors, totalPieces: "" });
                        }
                      }}
                      className={`h-12 ${formErrors.totalPieces ? 'border-red-300 focus:border-red-500' : ''}`}
                    />
                    {formErrors.totalPieces && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {formErrors.totalPieces}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="text-base font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Price per kg (KES) *
                    </Label>
                    <Input 
                      type="number" 
                      placeholder="e.g. 450" 
                      value={formData.pricePerKg} 
                      onChange={e => {
                        setFormData({ ...formData, pricePerKg: e.target.value });
                        if (formErrors.pricePerKg) {
                          setFormErrors({ ...formErrors, pricePerKg: "" });
                        }
                      }}
                      className={`h-12 ${formErrors.pricePerKg ? 'border-red-300 focus:border-red-500' : ''}`}
                    />
                    {formErrors.pricePerKg && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {formErrors.pricePerKg}
                      </p>
                    )}
                  </div>
                </div>

                {/* Fish Type Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <Fish className="h-4 w-4" />
                    Fish Type *
                  </Label>
                  <Select 
                    value={formData.fishType} 
                    onValueChange={v => {
                      setFormData({ ...formData, fishType: v });
                      if (formErrors.fishType) {
                        setFormErrors({ ...formErrors, fishType: "" });
                      }
                    }}
                  >
                    <SelectTrigger className={`h-12 ${formErrors.fishType ? 'border-red-300 focus:border-red-500' : ''}`}>
                      <SelectValue placeholder="Select fish type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Nile Tilapia">
                        <div className="flex items-center gap-2">
                          <Fish className="h-4 w-4 text-blue-600" />
                          Nile Tilapia (0.35kg avg)
                        </div>
                      </SelectItem>
                      <SelectItem value="Nile Perch">
                        <div className="flex items-center gap-2">
                          <Fish className="h-4 w-4 text-green-600" />
                          Nile Perch (1.20kg avg)
                        </div>
                      </SelectItem>
                      <SelectItem value="African Catfish">
                        <div className="flex items-center gap-2">
                          <Fish className="h-4 w-4 text-purple-600" />
                          African Catfish (0.65kg avg)
                        </div>
                      </SelectItem>
                      <SelectItem value="Silver Cyprinid">
                        <div className="flex items-center gap-2">
                          <Fish className="h-4 w-4 text-gray-600" />
                          Silver Cyprinid (0.15kg avg)
                        </div>
                      </SelectItem>
                      <SelectItem value="African Lungfish">
                        <div className="flex items-center gap-2">
                          <Fish className="h-4 w-4 text-orange-600" />
                          African Lungfish (0.80kg avg)
                        </div>
                      </SelectItem>
                      <SelectItem value="Blue-spotted Tilapia">
                        <div className="flex items-center gap-2">
                          <Fish className="h-4 w-4 text-cyan-600" />
                          Blue-spotted Tilapia (0.30kg avg)
                        </div>
                      </SelectItem>
                      <SelectItem value="Marbled Lungfish">
                        <div className="flex items-center gap-2">
                          <Fish className="h-4 w-4 text-red-600" />
                          Marbled Lungfish (0.75kg avg)
                        </div>
                      </SelectItem>
                      <SelectItem value="Electric Catfish">
                        <div className="flex items-center gap-2">
                          <Fish className="h-4 w-4 text-yellow-600" />
                          Electric Catfish (0.55kg avg)
                        </div>
                      </SelectItem>
                      <SelectItem value="Mixed Batch">
                        <div className="flex items-center gap-2">
                          <Fish className="h-4 w-4 text-indigo-600" />
                          Mixed Batch (0.50kg avg)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Select the primary fish type. This helps with accurate processing and sorting.
                  </p>
                  {formErrors.fishType && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {formErrors.fishType}
                    </p>
                  )}
                </div>

                {/* Grade and Notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Grade/Quality *</Label>
                    <Select 
                      value={formData.condition} 
                      onValueChange={v => {
                        setFormData({ ...formData, condition: v });
                        if (formErrors.condition) {
                          setFormErrors({ ...formErrors, condition: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={`h-12 ${formErrors.condition ? 'border-red-300 focus:border-red-500' : ''}`}>
                        <SelectValue placeholder="Select quality grade..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="excellent">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            Excellent (Grade A)
                          </div>
                        </SelectItem>
                        <SelectItem value="good">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-blue-600" />
                            Good (Grade B)
                          </div>
                        </SelectItem>
                        <SelectItem value="fair">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            Fair (Grade C)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {formErrors.condition && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {formErrors.condition}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Additional Notes</Label>
                    <Textarea 
                      placeholder="Any special notes about this delivery..."
                      value={formData.notes} 
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      className="h-12 min-h-[48px]"
                    />
                  </div>
                </div>

                {/* Total Value Preview */}
                {formData.totalWeight && formData.pricePerKg && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="text-sm text-blue-700 mb-1">Total Value</div>
                    <div className="text-2xl font-bold text-blue-800">
                      {formatCurrency(parseFloat(formData.totalWeight) * parseFloat(formData.pricePerKg))}
                    </div>
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex justify-end gap-4 pt-6 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsNewEntryOpen(false);
                      setFormErrors({});
                      setError(null);
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Recording...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Record Entry
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

        {/* Statistics Dashboard */}
        {showStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Weight</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalWeight.toFixed(1)} kg</p>
                  </div>
                  <Weight className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Value</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalValue)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Pieces</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalPieces.toLocaleString()}</p>
                  </div>
                  <Package className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg Price/kg</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.avgPricePerKg)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filter Controls */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search entries by farmer, code, or notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <Select value={filterCondition} onValueChange={setFilterCondition}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Conditions</SelectItem>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant={groupByFarmer ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGroupByFarmer(!groupByFarmer)}
                  className="flex items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  {groupByFarmer ? "Group by Farmer" : "List View"}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={exportEntries}
                  disabled={filteredEntries.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
            
          </CardContent>
        </Card>

        {/* Entries List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Fish className="h-5 w-5 text-blue-600" /> 
                Warehouse Entries
                <Badge variant="secondary">
                  {filteredEntries.length} of {entries.length} entries
                </Badge>
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportEntries}
                  disabled={filteredEntries.length === 0}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading entries...</span>
            </div>
          ) : filteredEntries.length > 0 ? (
            groupByFarmer ? (
              <div className="space-y-4">
                {groupEntriesByFarmer(filteredEntries).map(farmerGroup => (
                  <div key={farmerGroup.farmer.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Farmer Header */}
                    <div 
                      className="bg-gray-50 p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => toggleFarmerExpansion(farmerGroup.farmer.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <User className="h-5 w-5 text-gray-600" />
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">
                                {farmerGroup.farmer.name}
                              </h3>
                              <p className="text-sm text-gray-500">{farmerGroup.farmer.location}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Package className="h-4 w-4" />
                              {farmerGroup.entryCount} entries
                            </span>
                            <span className="flex items-center gap-1">
                              <Weight className="h-4 w-4" />
                              {farmerGroup.totalWeight.toFixed(1)}kg
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              {formatCurrency(farmerGroup.totalValue)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {expandedFarmers.has(farmerGroup.farmer.id) ? 'Collapse' : 'Expand'}
                          </Badge>
                          <ChevronDown 
                            className={`h-4 w-4 text-gray-400 transition-transform ${
                              expandedFarmers.has(farmerGroup.farmer.id) ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Farmer Entries */}
                    {expandedFarmers.has(farmerGroup.farmer.id) && (
                      <div className="divide-y divide-gray-100">
                        {farmerGroup.entries.map(entry => (
                          <div 
                            key={entry.id} 
                            className="p-4 hover:bg-gray-50 transition-colors bg-white"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-4 mb-3">
                                  {getConditionIcon(entry.condition)}
                                  <div>
                                    <div className="flex items-center gap-4 text-sm text-gray-500">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {formatDate(entry.entry_date)}
                                      </span>
                                      <Badge variant="outline" className="font-medium">
                                        {entry.entry_code}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-6 text-sm">
                                  <Badge className={`${getConditionColor(entry.condition)} border`}>
                                    {entry.condition}
                                  </Badge>
                                  <span className="text-gray-600">
                                    {entry.total_weight}kg • {entry.total_pieces} pieces
                                  </span>
                                  <span className="text-gray-600">
                                    {formatCurrency(entry.price_per_kg)}/kg
                                  </span>
                                </div>
                              </div>
                              
                              <div className="text-right">
                                <div className="text-xl font-bold text-gray-900 mb-2">
                                  {formatCurrency(entry.total_value)}
                                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => setEditingEntry(entry)}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    View
                                  </Button>
                                </div>
                              </div>
                            </div>
                            
                            {entry.notes && (
                              <div className="mt-3 p-3 bg-gray-50 rounded text-sm text-gray-600">
                                <strong>Notes:</strong> {entry.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredEntries.map(entry => (
                  <div 
                    key={entry.id} 
                    className="p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                          {getConditionIcon(entry.condition)}
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {getFarmerName(entry.farmer_id)}
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(entry.entry_date)}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6 text-sm">
                          <Badge variant="outline" className="font-medium">
                            {entry.entry_code}
                          </Badge>
                          <Badge className={`${getConditionColor(entry.condition)} border`}>
                            {entry.condition}
                          </Badge>
                          <span className="text-gray-600">
                            {entry.total_weight}kg • {entry.total_pieces} pieces
                          </span>
                          <span className="text-gray-600">
                            {formatCurrency(entry.price_per_kg)}/kg
                          </span>
                          <span className="text-gray-600 font-medium">
                            • {entry.farmer_name}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900 mb-3">
                          {formatCurrency(entry.total_value)}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setEditingEntry(entry)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {entry.notes && (
                      <div className="mt-3 p-3 bg-gray-50 rounded text-sm text-gray-600">
                        <strong>Notes:</strong> {entry.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : searchTerm || filterCondition !== "all" ? (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No entries match your search</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filter criteria</p>
              <div className="mt-4 flex gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterCondition("all");
                  }}
                >
                  Clear Filters
                </Button>
                <Button 
                  onClick={() => setIsNewEntryOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Entry
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Fish className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No warehouse entries yet</p>
              <p className="text-sm text-gray-400 mt-1">Start by recording your first fish delivery</p>
              <Button 
                onClick={() => setIsNewEntryOpen(true)}
                className="mt-4 bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Record First Entry
              </Button>
            </div>
          )}
          </CardContent>
        </Card>

        {/* Entry Details Dialog */}
        <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                Entry Details
              </DialogTitle>
            </DialogHeader>
            {editingEntry && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Entry Code</Label>
                    <p className="text-lg font-semibold">{editingEntry.entry_code}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Date</Label>
                    <p className="text-lg font-semibold">{formatDate(editingEntry.entry_date)}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Farmer</Label>
                    <p className="text-lg font-semibold">{editingEntry.farmer_name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Condition</Label>
                    <Badge className={`${getConditionColor(editingEntry.condition)} border`}>
                      {editingEntry.condition}
                    </Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Weight</Label>
                    <p className="text-lg font-semibold">{editingEntry.total_weight} kg</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Pieces</Label>
                    <p className="text-lg font-semibold">{editingEntry.total_pieces}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Price/kg</Label>
                    <p className="text-lg font-semibold">{formatCurrency(editingEntry.price_per_kg)}</p>
                  </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg">
                  <Label className="text-sm font-medium text-gray-500">Total Value</Label>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(editingEntry.total_value)}</p>
                </div>
                
                {editingEntry.notes && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Notes</Label>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{editingEntry.notes}</p>
                  </div>
                )}
                
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setEditingEntry(null)}
                  >
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