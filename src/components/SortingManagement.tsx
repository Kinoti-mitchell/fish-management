import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  DialogFooter,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Textarea } from "./ui/textarea";
import { NavigationSection, SortingBatch, SizeClassThreshold, SortingResult } from "../types";
import { sortingService } from "../services/sortingService";
import { inventoryService } from "../services/inventoryService";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";
import { generateUniqueBatchNumber } from "../utils/entryCodeGenerator";
import { safeQuerySortingBatches, handleSupabaseError } from "../utils/supabaseHelpers";
import { useAuth } from "./AuthContext";
import { 
  Filter, 
  Plus, 
  Eye, 
  CheckCircle,
  Clock,
  Package,
  Scale,
  BarChart3,
  RefreshCw,
  Home,
  Calendar,
  Weight,
  FileText,
  AlertCircle,
  Settings,
  TrendingUp,
  Fish,
  Layers,
  Activity,
  Zap,
  Target,
  ArrowRight,
  Edit,
  Trash2,
  Save,
  X,
  ChevronUp,
  ChevronDown
} from "lucide-react";

interface SortingManagementProps {
  onNavigate: (section: NavigationSection) => void;
}

const SortingManagement: React.FC<SortingManagementProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [processingRecords, setProcessingRecords] = useState<any[]>([]);
  const [sortingBatches, setSortingBatches] = useState<SortingBatch[]>([]);
  const [sizeClassThresholds, setSizeClassThresholds] = useState<SizeClassThreshold[]>([]);
  const [storageLocations, setStorageLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllBatches, setShowAllBatches] = useState(false);
  const [showAllProcessingRecords, setShowAllProcessingRecords] = useState(false);
  const [isSubmittingSorting, setIsSubmittingSorting] = useState(false);

  // Dialog states
  const [sortingDialogOpen, setSortingDialogOpen] = useState(false);
  const [thresholdsDialogOpen, setThresholdsDialogOpen] = useState(false);
  const [viewDetailsDialogOpen, setViewDetailsDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [selectedBatch, setSelectedBatch] = useState<SortingBatch | null>(null);

  // Form states
  const [sortingForm, setSortingForm] = useState({
    batch_number: '',
    size_distribution: {} as Record<string, number>,
    total_weight_kg: 0,
    remaining_weight_kg: 0,
    notes: '',
    storage_location_id: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load data from database with optimized queries
      const [thresholds, batches, records] = await Promise.all([
        sortingService.getSizeClassThresholds(),
        sortingService.getSortingBatches({ status: 'completed', limit: 20 }), // Only get recent completed batches
        sortingService.getProcessingRecordsReadyForSorting()
      ]);

      // The service now handles filtering, so we can use the data directly
      setSizeClassThresholds(thresholds);
      setSortingBatches(batches);
      setProcessingRecords(records);
      
      // Get storage locations directly from the database
      try {
        const { data: storageLocationsData, error: storageError } = await supabase
          .from('storage_locations')
          .select('*')
          .eq('status', 'active')
          .order('name');
        
        if (storageError) {
          console.warn('Could not fetch storage locations:', storageError.message);
          // Use default storage locations
          setStorageLocations([
            { 
              id: 'default-1', 
              name: 'Cold Storage A', 
              capacity_kg: 1000,
              current_usage_kg: 0,
              location_type: 'cold_storage'
            },
            { 
              id: 'default-2', 
              name: 'Cold Storage B', 
              capacity_kg: 1000,
              current_usage_kg: 0,
              location_type: 'cold_storage'
            }
          ]);
        } else {
          setStorageLocations(storageLocationsData || []);
        }
      } catch (error) {
        console.warn('Error fetching storage locations:', error);
        // Use default storage locations
        setStorageLocations([
          { 
            id: 'default-1', 
            name: 'Cold Storage A', 
            capacity_kg: 1000,
            current_usage_kg: 0,
            location_type: 'cold_storage'
          },
          { 
            id: 'default-2', 
            name: 'Cold Storage B', 
            capacity_kg: 1000,
            current_usage_kg: 0,
            location_type: 'cold_storage'
          }
        ]);
      }
    } catch (err) {
      console.error('Error loading sorting data:', err);
      setError('Failed to load sorting data. Please try again.');
      
      // Set empty arrays on error
      setSizeClassThresholds([]);
      setSortingBatches([]);
      setProcessingRecords([]);
      setStorageLocations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load real data from database
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  // Memoized computed values for better performance
  const totalSortedWeight = useMemo(() => {
    return sortingBatches.reduce((total, batch) => total + (batch.total_weight_grams ? batch.total_weight_grams / 1000 : 0), 0);
  }, [sortingBatches]);

  const totalPendingWeight = useMemo(() => {
    return processingRecords.reduce((total, record) => total + (record.post_processing_weight || 0), 0);
  }, [processingRecords]);

  const handleStartSorting = async (record: any) => {
    try {
      console.log('Starting sorting for record:', record.id);
      
      // Check authentication using the AuthContext (updated to avoid Supabase auth calls)
      if (!user) {
        console.error('No user found in AuthContext');
        toast.error('Please log in to continue.');
        return;
      }
      
      console.log('User authenticated via AuthContext:', user.email);
      
      // First check if this record is already sorted
      // Use the safe query helper to handle 406 errors
      const query = supabase
        .from('sorting_batches')
        .select('id, batch_number, status')
        .eq('processing_record_id', record.id)
        .eq('status', 'completed')
        .maybeSingle();
      
      const { data: existingSorting, error: checkError } = await safeQuerySortingBatches(query);
      
      if (checkError) {
        console.warn('Could not check for existing sorting batches:', checkError);
        
        // Handle specific error types
        if (checkError.message && checkError.message.includes('406')) {
          toast.error('Access denied. Please check your permissions or contact your administrator.');
          return;
        }
        
        if (checkError.message && checkError.message.includes('relation') && checkError.message.includes('does not exist')) {
          toast.error('Sorting functionality is not properly set up. Please contact your administrator.');
          return;
        }
        
        // For other errors, continue anyway - the database constraint will catch duplicates
        console.warn('Continuing despite check error:', checkError.message);
      }
      
      if (existingSorting && existingSorting.length > 0) {
        toast.error(`This processing record has already been sorted! Batch: ${existingSorting[0].batch_number}`);
        return;
      }
      
      setSelectedRecord(record);
      
      // Generate unique batch number with error handling
      let batchNumber;
      try {
        batchNumber = await generateUniqueBatchNumber();
      } catch (batchError) {
        console.warn('Error generating batch number, using fallback:', batchError);
        batchNumber = `Batch${Date.now().toString().slice(-6)}`;
      }
      
       // Initialize sorting form with total weight from the record
       const totalWeight = record.post_processing_weight || 0;
       setSortingForm({
         batch_number: batchNumber,
         size_distribution: {},
         total_weight_kg: totalWeight,
         remaining_weight_kg: totalWeight,
         notes: '',
         storage_location_id: ''
       });
      
      setSortingDialogOpen(true);
    } catch (error) {
      console.error('Error starting sorting:', error);
      
      // Use the helper function for consistent error handling
      const errorMessage = handleSupabaseError(error, 'starting sorting');
      toast.error(errorMessage);
    }
  };



  const handleSizeDistributionChange = (size: string, weight: number) => {
    const newDistribution = { ...sortingForm.size_distribution };
    
    if (weight === 0) {
      delete newDistribution[size];
    } else {
      newDistribution[size] = weight;
    }
    
    // Calculate remaining weight
    const totalDistributed = Object.values(newDistribution).reduce((sum, wgt) => sum + wgt, 0);
    const remaining = sortingForm.total_weight_kg - totalDistributed;
    
    setSortingForm({
      ...sortingForm,
      size_distribution: newDistribution,
      remaining_weight_kg: remaining
    });
  };

  const handleSubmitSorting = async () => {
    try {
      if (!selectedRecord || isSubmittingSorting) return;
      
      setIsSubmittingSorting(true);
      
      // Validate that all weight is distributed
      if (sortingForm.remaining_weight_kg !== 0) {
        toast.error(`Please distribute all ${sortingForm.total_weight_kg}kg. ${sortingForm.remaining_weight_kg}kg remaining.`);
        setIsSubmittingSorting(false);
        return;
      }
      
      // Validate storage location is selected
      if (!sortingForm.storage_location_id) {
        toast.error('Please select a storage location');
        setIsSubmittingSorting(false);
        return;
      }
      
      // Additional validation: Check if this processing record is already sorted
      const query = supabase
        .from('sorting_batches')
        .select('id, batch_number, status')
        .eq('processing_record_id', selectedRecord.id)
        .eq('status', 'completed')
        .maybeSingle();
      
      const { data: existingSorting, error: checkError } = await safeQuerySortingBatches(query);
      
      if (checkError) {
        console.warn('Could not check for existing sorting batches:', checkError);
        
        // Handle 406 errors specifically
        if (checkError.message && checkError.message.includes('406')) {
          toast.error('Access denied. Please check your permissions or contact your administrator.');
          setIsSubmittingSorting(false);
          return;
        }
        
        // Continue anyway - the database constraint will catch duplicates
      }
      
      if (existingSorting && existingSorting.length > 0) {
        toast.error(`This processing record has already been sorted! Batch: ${existingSorting[0].batch_number}`);
        setIsSubmittingSorting(false);
        return;
      }
      
      // Update the processing record directly with size distribution
      const { error: updateError } = await supabase
        .from('processing_records')
        .update({
          size_distribution: sortingForm.size_distribution,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedRecord.id);
      
      if (updateError) {
        console.error('Error updating processing record:', updateError);
        throw updateError;
      }
      
      // Create a sorting batch record directly
      const batchData = {
        processing_record_id: selectedRecord.id,
        batch_number: sortingForm.batch_number,
        notes: sortingForm.notes,
        status: 'completed',
        total_pieces: selectedRecord.ready_for_dispatch_count || 0,
        total_weight_grams: sortingForm.total_weight_kg * 1000, // Convert kg to grams
        sorting_date: new Date().toISOString().split('T')[0],
        storage_location_id: sortingForm.storage_location_id,
        size_distribution: sortingForm.size_distribution // Include the size distribution in the batch
      };
      
      console.log('Creating batch with size distribution:', batchData.size_distribution);
      
      const { data: batchResult, error: batchError } = await supabase
        .from('sorting_batches')
        .insert([batchData])
        .select('id')
        .single();
      
      if (batchError) {
        // Handle specific duplicate sorting error
        if (batchError.code === '23505' && batchError.message.includes('sorting_batches_one_completed_per_processing_record')) {
          toast.error('This processing record has already been sorted! Please refresh the page to see the updated list.');
          await loadData(); // Refresh the data
          setIsSubmittingSorting(false);
          return;
        }
        console.error('Error creating sorting batch:', batchError);
        throw batchError;
      }
      
      if (batchResult) {
        // Update storage location capacity
        try {
          // First get current usage
          const { data: currentStorage, error: fetchError } = await supabase
            .from('storage_locations')
            .select('current_usage_kg')
            .eq('id', sortingForm.storage_location_id)
            .single();
          
          if (fetchError) {
            console.warn('Could not fetch current storage usage:', fetchError);
          } else {
            const newUsage = (currentStorage.current_usage_kg || 0) + sortingForm.total_weight_kg;
            
            const { error: storageUpdateError } = await supabase
              .from('storage_locations')
              .update({
                current_usage_kg: newUsage,
                updated_at: new Date().toISOString()
              })
              .eq('id', sortingForm.storage_location_id);
          
            if (storageUpdateError) {
              console.warn('Could not update storage location capacity:', storageUpdateError);
            } else {
              console.log('Updated storage location capacity:', sortingForm.storage_location_id);
            }
          }
        } catch (storageError) {
          console.warn('Error updating storage capacity:', storageError);
        }
        
        // Automatically add to inventory after sorting batch is created
        try {
          await inventoryService.addStockFromSorting(batchResult.id);
          console.log('Automatically added to inventory:', batchResult.id);
        } catch (inventoryError) {
          console.warn('Could not automatically add to inventory:', inventoryError);
          // Show a warning but don't fail the whole operation
          toast.error('Sorting completed but failed to add to inventory. Please add manually from inventory management.');
          // Don't fail the whole operation if inventory addition fails
        }
      }
      
      toast.success('Fish sorted and batch created successfully!');
      setSortingDialogOpen(false);
      setSelectedRecord(null);
      setSortingForm({
        batch_number: '',
        size_distribution: {},
        total_weight_kg: 0,
        remaining_weight_kg: 0,
        notes: '',
        storage_location_id: ''
      });
      await loadData(); // Refresh data including storage locations
    } catch (error) {
      toast.error('Failed to complete sorting');
      console.error('Sorting error:', error);
    } finally {
      setIsSubmittingSorting(false);
    }
  };

  const handleUpdateThresholds = () => {
    setThresholdsDialogOpen(true);
  };

  const handleViewDetails = async (batch: SortingBatch) => {
    try {
      console.log('Viewing batch details:', batch);
      console.log('Batch size distribution:', batch.size_distribution);
      
      // Fetch fresh data from database to ensure accuracy
      const freshBatch = await sortingService.getSortingBatch(batch.id);
      console.log('Fresh batch data:', freshBatch);
      
      setSelectedBatch(freshBatch);
      setViewDetailsDialogOpen(true);
    } catch (error) {
      console.error('Error fetching fresh batch data:', error);
      // Fallback to existing data if fetch fails
      setSelectedBatch(batch);
      setViewDetailsDialogOpen(true);
    }
  };

  const handleViewSortingDetails = (record: any) => {
    console.log('Viewing sorting details for record:', record);
    console.log('Size distribution:', record.size_distribution);
    setSelectedRecord(record);
    setViewDetailsDialogOpen(true);
  };


  return (
    <div className="min-h-screen bg-gray-50 content-container">
      <div className="max-w-7xl mx-auto space-y-6 responsive-padding">
        {/* Clean Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sorting Management</h1>
              <p className="text-gray-600 mt-1">
                Sort fish into size classes and manage sorting operations
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={() => onNavigate('inventory')}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Go to Inventory
              </Button>
            </div>
          </div>
        </div>


      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <h3 className="font-medium text-red-800">Error Loading Data</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <Button 
                onClick={handleRefresh} 
                variant="outline" 
                size="sm" 
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Processing Records</p>
                  <p className="text-3xl font-bold">{processingRecords.length}</p>
                </div>
                <Package className="w-8 h-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Total Sorted</p>
                  <p className="text-3xl font-bold">
                    {totalSortedWeight.toFixed(1)}kg
                  </p>
                  <p className="text-green-200 text-xs mt-1">{sortingBatches.length} batches</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Size Classes</p>
                  <p className="text-3xl font-bold">{sizeClassThresholds.length}</p>
                </div>
                <Scale className="w-8 h-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>


      {/* Enhanced Processing Records Ready for Sorting */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <span className="text-xl font-semibold">Processing Records Ready for Sorting</span>
              <p className="text-sm text-gray-600 font-normal mt-1">
                Fish that have been processed and are ready to be sorted into size classes
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                <p className="text-gray-600">Loading processing records...</p>
              </div>
            </div>
          ) : processingRecords.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-blue-50 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <Package className="w-10 h-10 text-blue-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Processing Records</h3>
              <p className="text-gray-600 mb-4">No fish have been processed yet</p>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <ArrowRight className="w-4 h-4" />
                <span>Process fish first, then they'll appear here for sorting</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {(showAllProcessingRecords ? processingRecords : processingRecords.slice(0, 3)).map((record) => (
                <div key={record.id} className="group p-6 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all duration-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                        <Fish className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                         <div className="flex items-center gap-2 mb-1">
                           <h4 className="font-semibold text-gray-900">
                             Processing Record {record.processing_code || record.id}
                           </h4>
                         </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Weight className="w-4 h-4" />
                            <span>{record.post_processing_weight || record.total_weight || 0}kg</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Fish className="w-4 h-4" />
                            <span>{record.ready_for_dispatch_count || record.fish_count || 0} fish</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(record.processing_date || record.processed_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                          <Button 
                            onClick={() => handleStartSorting(record)} 
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Filter className="w-4 h-4 mr-2" />
                            Sort Fish
                          </Button>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* View All Button */}
              {processingRecords.length > 3 && (
                <div className="flex justify-center pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAllProcessingRecords(!showAllProcessingRecords)}
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    {showAllProcessingRecords ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-2" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-2" />
                        View All ({processingRecords.length} records)
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>


      {/* Enhanced Sorted Batches */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
              <span className="text-xl font-semibold">Sorted Batches</span>
                <p className="text-sm text-gray-600 font-normal mt-1">
                Completed sorting operations with size distribution
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {sortingBatches.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-green-50 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Sorted Batches</h3>
              <p className="text-gray-600 mb-4">No fish have been sorted yet</p>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <ArrowRight className="w-4 h-4" />
                <span>Sort fish from processing records above to create batches</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {(showAllBatches ? sortingBatches : sortingBatches.slice(0, 3)).map((batch) => (
                <div key={batch.id} className="group p-6 border border-gray-200 rounded-xl hover:border-green-300 hover:shadow-md transition-all duration-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                         <div className="flex items-center gap-2 mb-1">
                           <h4 className="font-semibold text-gray-900">
                             Sorted Batch #{batch.batch_number || batch.id.slice(-8).toUpperCase()}
                           </h4>
                         </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Created: {new Date(batch.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Weight className="w-4 h-4" />
                            <span>{batch.total_weight_grams ? (batch.total_weight_grams / 1000).toFixed(1) : 0}kg</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Fish className="w-4 h-4" />
                            <span>{batch.total_pieces || 0} pieces</span>
                          </div>
                          {batch.processing_record?.fish_type && (
                            <div className="flex items-center gap-1">
                              <Package className="w-4 h-4" />
                              <span>{batch.processing_record.fish_type}</span>
                            </div>
                          )}
                        </div>
                        {batch.processing_record?.warehouse_entry?.farmer && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                            <span>Farmer: {batch.processing_record.warehouse_entry.farmer.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button 
                        size="sm"
                        onClick={() => handleViewDetails(batch)}
                        className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg font-medium"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* View All Button */}
              {sortingBatches.length > 3 && (
                <div className="flex justify-center pt-4">
                      <Button 
                        variant="outline" 
                    onClick={() => setShowAllBatches(!showAllBatches)}
                    className="text-green-600 border-green-300 hover:bg-green-50"
                  >
                    {showAllBatches ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-2" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-2" />
                        View All ({sortingBatches.length} batches)
                      </>
                    )}
                    </Button>
              </div>
                    )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Size Class Thresholds */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Scale className="w-5 h-5 text-green-600" />
            </div>
            <div>
                <span className="text-xl font-semibold">Size Class Thresholds</span>
                <p className="text-sm text-gray-600 font-normal mt-1">
                  Configure weight ranges for each size class (0-10)
                </p>
              </div>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleUpdateThresholds}>
              <Settings className="w-4 h-4 mr-2" />
              Manage
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sizeClassThresholds.map((threshold) => (
              <div key={threshold.class_number} className="group p-4 border border-gray-200 rounded-xl hover:border-green-300 hover:shadow-md transition-all duration-200 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <Badge 
                    variant="outline" 
                    className={`w-16 justify-center font-semibold ${
                      threshold.class_number <= 2 ? 'border-blue-200 text-blue-700 bg-blue-50' :
                      threshold.class_number <= 5 ? 'border-green-200 text-green-700 bg-green-50' :
                      threshold.class_number <= 8 ? 'border-orange-200 text-orange-700 bg-orange-50' :
                      'border-red-200 text-red-700 bg-red-50'
                    }`}
                  >
                    Class {threshold.class_number}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={handleUpdateThresholds}>
                    <Edit className="w-4 h-4" />
            </Button>
            </div>
            <div>
                  <h4 className="font-medium text-gray-900 mb-1">{threshold.description}</h4>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Weight className="w-4 h-4" />
                    <span>
                      {threshold.min_weight_grams}g - {threshold.max_weight_grams === 999999.99 ? '∞' : `${threshold.max_weight_grams}g`}
                    </span>
            </div>
            </div>
            </div>
            ))}
              </div>
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={viewDetailsDialogOpen} onOpenChange={setViewDetailsDialogOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedBatch ? 'Sorted Batch Details' : 'Sorting Details'}
            </DialogTitle>
          </DialogHeader>
          {selectedBatch ? (
            <div className="space-y-6">
              {/* Data Validation Info */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-600">
                  <span>Data refreshed: {new Date().toLocaleTimeString()}</span>
                  <span>Batch ID: {selectedBatch.id.slice(-8).toUpperCase()}</span>
                </div>
              </div>

              {/* Batch Information */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-3">Batch Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-blue-700">
                  <div>
                    <span className="font-medium">Batch Number:</span> 
                    <span className="ml-2 font-mono text-xs">{selectedBatch.batch_number || selectedBatch.id.slice(-8).toUpperCase()}</span>
                  </div>
                   <div>
                     <span className="font-medium">Processing Code:</span> 
                     <span className="ml-2 font-mono text-xs">{selectedBatch.processing_record?.processing_code || 'N/A'}</span>
                   </div>
                  <div>
                    <span className="font-medium">Status:</span> 
                    <Badge variant="outline" className="ml-2">
                      {selectedBatch.status}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">Total Weight:</span> 
                    <span className="ml-2 text-green-600 font-semibold">{selectedBatch.total_weight_grams ? (selectedBatch.total_weight_grams / 1000).toFixed(1) : 0}kg</span>
                  </div>
                  <div>
                    <span className="font-medium">Total Pieces:</span> 
                    <span className="ml-2 text-green-600 font-semibold">{selectedBatch.total_pieces || 0}</span>
                  </div>
                  <div>
                    <span className="font-medium">Created Date:</span> 
                    <span className="ml-2">{new Date(selectedBatch.created_at).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="font-medium">Sorting Date:</span> 
                    <span className="ml-2">{new Date(selectedBatch.sorting_date).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Processing Record Details */}
              {selectedBatch.processing_record && (
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-medium text-purple-900 mb-3">Processing Record Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-purple-700">
                    <div>
                      <span className="font-medium">Record ID:</span> 
                      <span className="ml-2 font-mono text-xs">{selectedBatch.processing_record.id?.slice(-8).toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="font-medium">Processing Date:</span> 
                      <span className="ml-2">{new Date(selectedBatch.processing_record.processing_date).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="font-medium">Post-Processing Weight:</span> 
                      <span className="ml-2 text-green-600 font-semibold">{selectedBatch.processing_record.post_processing_weight || 0}kg</span>
                    </div>
                    <div>
                      <span className="font-medium">Ready for Dispatch:</span> 
                      <span className="ml-2 text-green-600 font-semibold">{selectedBatch.processing_record.ready_for_dispatch_count || 0} pieces</span>
                    </div>
                    <div>
                      <span className="font-medium">Fish Type:</span> 
                      <span className="ml-2">{selectedBatch.processing_record.fish_type || 'Not specified'}</span>
                    </div>
                     <div>
                       <span className="font-medium">Final Value:</span> 
                       <span className="ml-2">{selectedBatch.processing_record.final_value || 'Not specified'}</span>
                     </div>
                    <div>
                      <span className="font-medium">Processing Yield:</span> 
                      <span className="ml-2">{selectedBatch.processing_record.processing_yield || 0}%</span>
                    </div>
                    <div>
                      <span className="font-medium">Processing Waste:</span> 
                      <span className="ml-2">{selectedBatch.processing_record.processing_waste || 0}kg</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Farmer Information */}
              {selectedBatch.processing_record?.warehouse_entry?.farmer && (
                <div className="p-4 bg-orange-50 rounded-lg">
                  <h4 className="font-medium text-orange-900 mb-3">Farmer Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-orange-700">
                    <div>
                      <span className="font-medium">Farmer Name:</span> 
                      <span className="ml-2">{selectedBatch.processing_record.warehouse_entry.farmer.name}</span>
                    </div>
                    {selectedBatch.processing_record.warehouse_entry.farmer.phone && (
                      <div>
                        <span className="font-medium">Phone:</span> 
                        <span className="ml-2">{selectedBatch.processing_record.warehouse_entry.farmer.phone}</span>
                      </div>
                    )}
                    {selectedBatch.processing_record.warehouse_entry.farmer.location && (
                      <div>
                        <span className="font-medium">Location:</span> 
                        <span className="ml-2">{selectedBatch.processing_record.warehouse_entry.farmer.location}</span>
                      </div>
                    )}
                    {selectedBatch.processing_record.warehouse_entry.farmer.rating && (
                      <div>
                        <span className="font-medium">Rating:</span> 
                        <span className="ml-2">{selectedBatch.processing_record.warehouse_entry.farmer.rating}/5</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Storage Location Information */}
              {selectedBatch.storage_location_id && (() => {
                const storageLocation = storageLocations.find(loc => loc.id === selectedBatch.storage_location_id);
                return (
                  <div className="p-4 bg-indigo-50 rounded-lg">
                    <h4 className="font-medium text-indigo-900 mb-3">Storage Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-indigo-700">
                      <div>
                        <span className="font-medium">Storage Location:</span> 
                        <span className="ml-2">{storageLocation?.name || 'Unknown Storage'}</span>
                      </div>
                      <div>
                        <span className="font-medium">Stored Date:</span> 
                        <span className="ml-2">{new Date(selectedBatch.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Size Distribution */}
              {((selectedBatch.size_distribution && Object.keys(selectedBatch.size_distribution).length > 0) || 
                (selectedBatch.processing_record && selectedBatch.processing_record.size_distribution && Object.keys(selectedBatch.processing_record.size_distribution).length > 0)) ? (
                <div>
                  <Label className="text-lg font-semibold">Size Distribution</Label>
                  
                  {/* Visual Chart - Mobile Optimized */}
                  <div className="mt-4 bg-gray-50 rounded-lg p-4">
                    <h5 className="font-medium text-gray-700 mb-4">Distribution Chart</h5>
                    <div className="space-y-3">
                      {Object.entries(selectedBatch.size_distribution || selectedBatch.processing_record?.size_distribution || {})
                        .filter(([_, weight]) => weight > 0)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([size, weight]) => {
                          const totalWeightKg = selectedBatch.total_weight_grams ? selectedBatch.total_weight_grams / 1000 : 0;
                          const percentage = totalWeightKg > 0 ? (weight / totalWeightKg) * 100 : 0;
                          return (
                            <div key={size} className="flex items-center gap-2 sm:gap-4">
                              <div className="w-12 sm:w-16 text-sm font-medium text-gray-700">Size {size}</div>
                              <div className="flex-1 bg-gray-200 rounded-full h-6 sm:h-8 relative overflow-hidden">
                                <div 
                                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                                  style={{ width: `${Math.min(percentage, 100)}%` }}
                                >
                                  {percentage > 15 && (
                                    <span className="text-xs font-medium text-white">
                                      {weight}kg
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs text-gray-600 w-12 text-right">
                                {percentage.toFixed(1)}%
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Detailed Breakdown */}
                  <div className="mt-4">
                    <h5 className="font-medium text-gray-700 mb-3">Detailed Breakdown</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(selectedBatch.size_distribution || selectedBatch.processing_record?.size_distribution || {})
                        .filter(([_, weight]) => weight > 0)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([size, weight]) => {
                          const totalWeightKg = selectedBatch.total_weight_grams ? selectedBatch.total_weight_grams / 1000 : 0;
                          const percentage = totalWeightKg > 0 ? (weight / totalWeightKg) * 100 : 0;
                          return (
                            <div key={size} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center">
                                  <span className="font-bold text-blue-700 text-sm">{size}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-900">Size {size}</span>
                                  <p className="text-xs text-gray-600">{percentage.toFixed(1)}% of total</p>
                          </div>
                        </div>
                        <div className="text-right">
                                <span className="text-lg font-bold text-blue-600">{weight}kg</span>
                        </div>
                      </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="text-yellow-800">No size distribution data available for this batch</span>
                  </div>
                </div>
              )}

              {/* Sorting Summary */}
              {((selectedBatch.size_distribution && Object.keys(selectedBatch.size_distribution).length > 0) || 
                (selectedBatch.processing_record && selectedBatch.processing_record.size_distribution && Object.keys(selectedBatch.processing_record.size_distribution).length > 0)) && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-3">Sorting Summary</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-green-700">
                    <div>
                      <span className="font-medium">Total Sizes:</span> 
                      <span className="ml-2">{Object.keys(selectedBatch.size_distribution || selectedBatch.processing_record?.size_distribution || {}).length}</span>
                    </div>
                    <div>
                      <span className="font-medium">Total Distributed:</span> 
                      <span className="ml-2 font-semibold">
                        {Object.values(selectedBatch.size_distribution || selectedBatch.processing_record?.size_distribution || {}).reduce((sum, weight) => sum + weight, 0).toFixed(2)}kg
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Largest Size:</span> 
                      <span className="ml-2">
                        Size {Object.entries(selectedBatch.size_distribution || selectedBatch.processing_record?.size_distribution || {}).reduce((max, [size, weight]) => 
                          weight > max.weight ? {size, weight} : max, {size: '0', weight: 0}).size}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Smallest Size:</span> 
                      <span className="ml-2">
                        Size {Object.entries(selectedBatch.size_distribution || selectedBatch.processing_record?.size_distribution || {}).reduce((min, [size, weight]) => 
                          weight < min.weight ? {size, weight} : min, {size: '0', weight: Infinity}).size}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedBatch.notes && (
                <div>
                  <Label className="text-lg font-semibold">Batch Notes</Label>
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">{selectedBatch.notes}</p>
                  </div>
                </div>
              )}

              {/* Sorted By Information */}
              {selectedBatch.sorted_by_user && (
                <div className="p-4 bg-orange-50 rounded-lg">
                  <h4 className="font-medium text-orange-900 mb-3">Sorted By</h4>
                  <div className="text-sm text-orange-700">
                    <span className="font-medium">User:</span> 
                    <span className="ml-2">{selectedBatch.sorted_by_user.email}</span>
                  </div>
                </div>
              )}
            </div>
          ) : selectedRecord ? (
            <div className="space-y-6">
              {/* Processing Record Details */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-3">Processing Record Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
                  <div>
                    <span className="font-medium">Record ID:</span> 
                    <span className="ml-2 font-mono text-xs">{selectedRecord.id?.slice(-8).toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="font-medium">Processing Date:</span> 
                    <span className="ml-2">{new Date(selectedRecord.processing_date).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="font-medium">Total Weight:</span> 
                    <span className="ml-2 text-green-600 font-semibold">{selectedRecord.post_processing_weight || 0}kg</span>
                  </div>
                  <div>
                    <span className="font-medium">Total Pieces:</span> 
                    <span className="ml-2 text-green-600 font-semibold">{selectedRecord.ready_for_dispatch_count || 0}</span>
                  </div>
                  <div>
                    <span className="font-medium">Fish Type:</span> 
                    <span className="ml-2">{selectedRecord.fish_type || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="font-medium">Final Grade:</span> 
                    <span className="ml-2">{selectedRecord.final_grade || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="font-medium">Processing Yield:</span> 
                    <span className="ml-2">{selectedRecord.processing_yield || 0}%</span>
                  </div>
                  <div>
                    <span className="font-medium">Processing Waste:</span> 
                    <span className="ml-2">{selectedRecord.processing_waste || 0}kg</span>
                  </div>
                </div>
              </div>

              {/* Debug Information */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Debug Information</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>Size Distribution Type:</strong> {typeof selectedRecord.size_distribution}</p>
                  <p><strong>Size Distribution Value:</strong> {JSON.stringify(selectedRecord.size_distribution)}</p>
                  <p><strong>Has Size Distribution:</strong> {selectedRecord.size_distribution ? 'Yes' : 'No'}</p>
                  <p><strong>Size Distribution Keys:</strong> {selectedRecord.size_distribution ? Object.keys(selectedRecord.size_distribution).join(', ') : 'None'}</p>
                </div>
              </div>

              {/* Size Distribution */}
              {selectedRecord.size_distribution && Object.keys(selectedRecord.size_distribution).length > 0 ? (
                <div>
                  <Label className="text-lg font-semibold">Size Distribution</Label>
                  
                  {/* Visual Chart */}
                  <div className="mt-4 bg-gray-50 rounded-lg p-4">
                    <h5 className="font-medium text-gray-700 mb-4">Distribution Chart</h5>
                    <div className="space-y-3">
                      {Object.entries(selectedRecord.size_distribution)
                        .filter(([_, weight]) => weight > 0)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([size, weight]) => {
                          const percentage = selectedRecord.post_processing_weight > 0 ? (weight / selectedRecord.post_processing_weight) * 100 : 0;
                          return (
                            <div key={size} className="flex items-center gap-4">
                              <div className="w-16 text-sm font-medium text-gray-700">Size {size}</div>
                              <div className="flex-1 bg-gray-200 rounded-full h-8 relative overflow-hidden">
                                <div 
                                  className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-300 flex items-center justify-between px-3"
                                  style={{ width: `${Math.min(percentage, 100)}%` }}
                                >
                                  <span className="text-sm font-medium text-white">
                                    {weight}kg
                                  </span>
                                  <span className="text-xs text-green-100">
                                    {percentage.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Detailed Breakdown */}
                  <div className="mt-4">
                    <h5 className="font-medium text-gray-700 mb-3">Detailed Breakdown</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(selectedRecord.size_distribution)
                        .filter(([_, weight]) => weight > 0)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([size, weight]) => {
                          const percentage = selectedRecord.post_processing_weight > 0 ? (weight / selectedRecord.post_processing_weight) * 100 : 0;
                          return (
                            <div key={size} className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200">
                        <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center">
                                  <span className="font-bold text-green-700 text-sm">{size}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-900">Size {size}</span>
                                  <p className="text-xs text-gray-600">{percentage.toFixed(1)}% of total</p>
                          </div>
                        </div>
                        <div className="text-right">
                                <span className="text-lg font-bold text-green-600">{weight}kg</span>
                        </div>
                      </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="text-yellow-800">No size distribution data available for this record</span>
                  </div>
                  <p className="text-sm text-yellow-700 mt-2">
                    This record may not have been sorted yet, or the size distribution data is missing.
                  </p>
                </div>
              )}

              {/* Sorting Summary */}
              {selectedRecord.size_distribution && Object.keys(selectedRecord.size_distribution).length > 0 ? (
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-3">Sorting Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm text-green-700">
                    <div>
                      <span className="font-medium">Total Sizes:</span> 
                      <span className="ml-2">{Object.keys(selectedRecord.size_distribution).length}</span>
                    </div>
                    <div>
                      <span className="font-medium">Total Distributed:</span> 
                      <span className="ml-2 font-semibold">
                        {Object.values(selectedRecord.size_distribution).reduce((sum, weight) => sum + weight, 0).toFixed(2)}kg
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Largest Size:</span> 
                      <span className="ml-2">
                        Size {Object.entries(selectedRecord.size_distribution).reduce((max, [size, weight]) => 
                          weight > max.weight ? {size, weight} : max, {size: '0', weight: 0}).size}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Smallest Size:</span> 
                      <span className="ml-2">
                        Size {Object.entries(selectedRecord.size_distribution).reduce((min, [size, weight]) => 
                          weight < min.weight ? {size, weight} : min, {size: '0', weight: Infinity}).size}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Sorting Status</h4>
                  <div className="text-sm text-gray-600">
                    <p>This processing record has not been sorted yet.</p>
                    <p className="mt-2">Use the "Sort Fish" button to distribute the fish into size classes.</p>
                  </div>
                </div>
              )}

              {/* Notes and Comments */}
              {(selectedRecord.notes || selectedRecord.processing_notes) && (
                <div>
                  <Label className="text-lg font-semibold">Notes & Comments</Label>
                  <div className="mt-3 space-y-3">
                    {selectedRecord.notes && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h5 className="font-medium text-yellow-900 mb-1">Processing Notes</h5>
                        <p className="text-sm text-yellow-800">{selectedRecord.notes}</p>
                      </div>
                    )}
                    {selectedRecord.processing_notes && (
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <h5 className="font-medium text-purple-900 mb-1">Additional Notes</h5>
                        <p className="text-sm text-purple-800">{selectedRecord.processing_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Farmer Information */}
              {selectedRecord.farmer_name && (
                <div className="p-4 bg-orange-50 rounded-lg">
                  <h4 className="font-medium text-orange-900 mb-3">Farmer Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm text-orange-700">
                    <div>
                      <span className="font-medium">Farmer Name:</span> 
                      <span className="ml-2">{selectedRecord.farmer_name}</span>
                    </div>
                    {selectedRecord.farmer_phone && (
                      <div>
                        <span className="font-medium">Phone:</span> 
                        <span className="ml-2">{selectedRecord.farmer_phone}</span>
                      </div>
                    )}
                    {selectedRecord.farmer_location && (
                      <div>
                        <span className="font-medium">Location:</span> 
                        <span className="ml-2">{selectedRecord.farmer_location}</span>
                      </div>
                    )}
                    {selectedRecord.farmer_rating && (
                      <div>
                        <span className="font-medium">Rating:</span> 
                        <span className="ml-2">{selectedRecord.farmer_rating}/5</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Thresholds Dialog */}
      <Dialog open={thresholdsDialogOpen} onOpenChange={setThresholdsDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Manage Size Class Thresholds</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Configure the weight ranges for each size class. Fish will be automatically sorted into these classes based on their weight.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {sizeClassThresholds.map((threshold) => (
                <div key={threshold.class_number} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Class {threshold.class_number}</h4>
                    <Badge variant="outline">
                      {threshold.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{threshold.description}</p>
                  <div className="text-sm">
                    <span className="font-medium">Range:</span> {threshold.min_weight_grams}g - {threshold.max_weight_grams === 999999.99 ? '∞' : `${threshold.max_weight_grams}g`}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setThresholdsDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => setThresholdsDialogOpen(false)}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fish Sorting Dialog */}
      <Dialog open={sortingDialogOpen} onOpenChange={setSortingDialogOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Sort Fish into Size Classes</DialogTitle>
            <p className="text-sm text-gray-600">Distribute the processed fish across different size classes</p>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Processing Record Summary */}
            {selectedRecord && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Fish className="w-5 h-5 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-blue-900">Processing Record Summary</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700 font-medium">Total Weight:</span>
                    <p className="text-blue-900 font-semibold">{selectedRecord.post_processing_weight || 0}kg</p>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Total Pieces:</span>
                    <p className="text-blue-900 font-semibold">{selectedRecord.ready_for_dispatch_count || 0}</p>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Fish Type:</span>
                    <p className="text-blue-900 font-semibold">{selectedRecord.fish_type || 'Not specified'}</p>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Processing Date:</span>
                    <p className="text-blue-900 font-semibold">{new Date(selectedRecord.processing_date).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Main Form Layout */}
            <div className="space-y-6">
              {/* Size Distribution Section */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="font-semibold text-gray-900">Size Distribution</h4>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Remaining:</span>
                    <span className={`font-medium px-2 py-1 rounded ${sortingForm.remaining_weight_kg === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {sortingForm.remaining_weight_kg.toFixed(1)}kg
                    </span>
                  </div>
                </div>

                {/* Size Input Grid - Mobile Optimized */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Array.from({ length: 11 }, (_, i) => i).map((size) => {
                    const currentWeight = sortingForm.size_distribution[size.toString()] || 0;
                    const hasValue = currentWeight > 0;
                    const percentage = sortingForm.total_weight_kg > 0 ? (currentWeight / sortingForm.total_weight_kg) * 100 : 0;
                    
                    return (
                      <div key={size} className={`p-3 rounded-lg border transition-all hover:shadow-sm ${hasValue ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <Label htmlFor={`size-${size}`} className={`text-sm font-medium ${hasValue ? 'text-blue-700' : 'text-gray-600'}`}>
                            Size {size}
                          </Label>
                          {hasValue && (
                            <span className="text-xs text-blue-600 font-medium">
                              {percentage.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            id={`size-${size}`}
                            type="number"
                            min="0"
                            max={sortingForm.total_weight_kg}
                            step="0.1"
                            value={currentWeight || ''}
                            onChange={(e) => handleSizeDistributionChange(size.toString(), parseFloat(e.target.value) || 0)}
                            placeholder="0.0"
                            className={`flex-1 text-sm ${hasValue ? 'border-blue-300 focus:border-blue-500 bg-white' : 'border-gray-200'}`}
                          />
                          <span className="text-xs text-gray-500 whitespace-nowrap">kg</span>
                        </div>
                        {hasValue && (
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                            <div 
                              className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Validation Messages - Simplified */}
                {sortingForm.remaining_weight_kg !== 0 && (
                  <div className={`p-3 rounded-lg border ${sortingForm.remaining_weight_kg > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2">
                      <AlertCircle className={`w-4 h-4 ${sortingForm.remaining_weight_kg > 0 ? 'text-yellow-600' : 'text-red-600'}`} />
                      <span className={`text-sm ${sortingForm.remaining_weight_kg > 0 ? 'text-yellow-800' : 'text-red-800'}`}>
                        {sortingForm.remaining_weight_kg > 0 
                          ? `${sortingForm.remaining_weight_kg.toFixed(1)}kg remaining to distribute`
                          : `Over-distributed by ${Math.abs(sortingForm.remaining_weight_kg).toFixed(1)}kg`
                        }
                      </span>
                    </div>
                  </div>
                )}

                {sortingForm.remaining_weight_kg === 0 && Object.keys(sortingForm.size_distribution).filter(size => sortingForm.size_distribution[size] > 0).length > 0 && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-800">
                        ✓ All {sortingForm.total_weight_kg}kg distributed across {Object.keys(sortingForm.size_distribution).filter(size => sortingForm.size_distribution[size] > 0).length} size classes
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Distribution Preview - Compact */}
              {Object.keys(sortingForm.size_distribution).filter(size => sortingForm.size_distribution[size] > 0).length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">Distribution Preview</h4>
                    <div className="text-sm text-gray-600">
                      {Object.keys(sortingForm.size_distribution).filter(size => sortingForm.size_distribution[size] > 0).length} sizes
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                    <div className="space-y-2">
                      {Object.entries(sortingForm.size_distribution)
                        .filter(([_, weight]) => weight > 0)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([size, weight]) => {
                          const percentage = sortingForm.total_weight_kg > 0 ? (weight / sortingForm.total_weight_kg) * 100 : 0;
                          return (
                            <div key={size} className="flex items-center gap-3">
                              <div className="w-10 text-sm font-medium text-gray-700">Size {size}</div>
                              <div className="flex-1 bg-white rounded-full h-4 relative overflow-hidden border border-gray-200">
                                <div 
                                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                                  style={{ width: `${Math.min(percentage, 100)}%` }}
                                >
                                  {percentage > 20 && (
                                    <span className="text-xs font-medium text-white">
                                      {weight}kg
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs text-gray-600 w-12 text-right font-medium">
                                {percentage.toFixed(1)}%
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}

              {/* Storage and Notes Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Storage Location */}
                <div>
                  <Label htmlFor="storage-location" className="text-sm font-medium">Storage Location *</Label>
                  <Select 
                    value={sortingForm.storage_location_id} 
                    onValueChange={(value) => setSortingForm({ ...sortingForm, storage_location_id: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select storage location" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        // Only show storages with adequate space for the total weight being sorted
                        const adequateLocations = storageLocations.filter((location) => {
                          const availableCapacity = location.capacity_kg - (location.current_usage_kg || 0);
                          return availableCapacity >= sortingForm.total_weight_kg;
                        });
                        
                        if (adequateLocations.length === 0) {
                          return (
                            <div className="p-3 text-center text-gray-500 text-sm">
                              No storage locations with adequate space ({sortingForm.total_weight_kg}kg needed)
                            </div>
                          );
                        }
                        
                        return adequateLocations.map((location) => {
                          const availableCapacity = location.capacity_kg - (location.current_usage_kg || 0);
                          const remainingAfterStorage = availableCapacity - sortingForm.total_weight_kg;
                          return (
                            <SelectItem key={location.id} value={location.id}>
                              <div className="flex justify-between items-center w-full">
                                <span className="text-gray-900">{location.name}</span>
                                <span className="text-xs ml-2 text-gray-500">
                                  {availableCapacity}kg available ({remainingAfterStorage}kg remaining)
                                </span>
                              </div>
                            </SelectItem>
                          );
                        });
                      })()}
                    </SelectContent>
                  </Select>
                  
                  {/* Storage Confirmation - Only adequate storages are shown */}
                  {sortingForm.storage_location_id && (() => {
                    const selectedLocation = storageLocations.find(loc => loc.id === sortingForm.storage_location_id);
                    if (!selectedLocation) return null;
                    
                    const availableCapacity = selectedLocation.capacity_kg - (selectedLocation.current_usage_kg || 0);
                    const remainingAfterStorage = availableCapacity - sortingForm.total_weight_kg;
                    
                    return (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                        ✓ Adequate space confirmed - {remainingAfterStorage}kg remaining after storage
                      </div>
                    );
                  })()}
                </div>

                {/* Notes */}
                <div>
                  <Label htmlFor="sorting-notes" className="text-sm font-medium">Notes (Optional)</Label>
                  <Textarea
                    id="sorting-notes"
                    value={sortingForm.notes}
                    onChange={(e) => setSortingForm({ ...sortingForm, notes: e.target.value })}
                    placeholder="Add any notes about this sorting operation..."
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setSortingDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitSorting} 
              disabled={(() => {
                if (isSubmittingSorting) return true;
                if (sortingForm.remaining_weight_kg !== 0) return true;
                if (!sortingForm.storage_location_id) return true;
                // Storage capacity validation removed since we only show adequate storages
                return false;
              })()}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingSorting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete Sorting
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default SortingManagement;