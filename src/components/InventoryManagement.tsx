"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { RioFishLogo } from "./RioFishLogo";
import { 
  Search, 
  Eye, 
  RefreshCw, 
  Package, 
  Scale, 
  AlertCircle, 
  TrendingUp, 
  Calendar, 
  Layers, 
  Plus, 
  Target, 
  Activity,
  Home,
  Filter,
  Weight,
  User,
  ArrowRight,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
  XCircle,
  FileText,
  Download,
  CheckCircle,
  BarChart3,
  PieChart,
  TrendingDown,
  Zap,
  Star,
  Award,
  Bell,
  Settings,
  Info,
  Loader2
} from "lucide-react";
import { NavigationSection } from "../types";
import { inventoryService } from "../services/inventoryService";
import { sortingService } from "../services/sortingService";
import TransferDialog from "./TransferDialog";
import { useAuth } from "./AuthContext";

// Types
interface InventoryManagementProps {
  onNavigate: (section: NavigationSection, itemId?: string) => void;
}

interface InventoryItem {
  id: string;
  size: number;
  quantity: number;
  total_weight: number;
  created_at: string;
  updated_at: string;
  batch_count?: number;
  contributing_batches?: Array<{
    batch_id: string;
    batch_number: string;
    quantity: number;
    weight_kg: number;
    storage_location_name: string;
    farmer_name: string;
    processing_date: string;
    added_date: string;
    created_at: string;
  }>;
}

interface SortingBatchForInventory {
  id: string;
  batch_number: string;
  size_distribution: Record<number, number>;
  created_at: string;
  storage_location_id: string;
  processing_record: {
    id: string;
    processing_date: string;
    warehouse_entry: {
      id: string;
      entry_date: string;
      farmer_id: string;
      farmers: {
        name: string;
        phone: string;
        location: string;
      };
    };
  };
}

export default function InventoryManagement({
  onNavigate,
}: InventoryManagementProps) {
  
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [storageInventoryData, setStorageInventoryData] = useState<any[]>([]);
  const [sortingBatches, setSortingBatches] = useState<SortingBatchForInventory[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferSourceStorage, setTransferSourceStorage] = useState<{
    id: string;
    name: string;
    location_type: string;
  } | null>(null);
  const [itemsToTransfer, setItemsToTransfer] = useState<Array<{
    size: number;
    quantity: number;
    total_weight: number;
  }>>([]);
  const [expandedStorages, setExpandedStorages] = useState<Set<string>>(new Set());
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'analytics'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'capacity' | 'utilization' | 'items'>('name');
  const [oldestBatches, setOldestBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [batchDetails, setBatchDetails] = useState<any>(null);
  const [batchDetailsOpen, setBatchDetailsOpen] = useState(false);
  const [sizeDemandStats, setSizeDemandStats] = useState<any[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [openingTransferDialog, setOpeningTransferDialog] = useState(false);

  // API Functions
  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔍 Fetching inventory data...');
      console.log('🔗 Testing database connection...');
      
      // Test database connection first
      try {
        const testData = await inventoryService.getInventorySummary();
        console.log('✅ Database connection successful, test data:', testData);
      } catch (dbError) {
        console.error('❌ Database connection failed:', dbError);
      }
      
      const data = await inventoryService.getInventoryByStorage();
      console.log('📦 Raw inventory data received:', data);
      console.log('📊 Data structure analysis:', {
        totalItems: data?.length || 0,
        hasStorageLocationId: data?.some(item => item.storage_location_id) || false,
        hasSize: data?.some(item => item.size !== null) || false,
        hasQuantity: data?.some(item => item.total_quantity > 0) || false,
        hasContributingBatches: data?.some(item => item.contributing_batches && item.contributing_batches.length > 0) || false,
        itemsWithBatches: data?.filter(item => item.contributing_batches && item.contributing_batches.length > 0).length || 0,
        itemsWithoutBatches: data?.filter(item => item.size !== null && item.total_quantity > 0 && (!item.contributing_batches || item.contributing_batches.length === 0)).length || 0,
        sampleItem: data?.[0] || null,
        sampleItemWithBatches: data?.find(item => item.contributing_batches && item.contributing_batches.length > 0) || null,
        sampleItemWithoutBatches: data?.find(item => item.size !== null && item.total_quantity > 0 && (!item.contributing_batches || item.contributing_batches.length === 0)) || null
      });
      
      // Detailed data analysis
      if (data && data.length > 0) {
        console.log('🔍 Detailed data analysis:');
        console.log('🔍 Raw data structure check:', {
          isArray: Array.isArray(data),
          length: data.length,
          firstItem: data[0],
          firstItemKeys: data[0] ? Object.keys(data[0]) : null
        });
        
        data.forEach((item, index) => {
          if (index < 3) { // Log first 3 items in detail
            console.log(`Item ${index + 1}:`, {
              storage_location_id: item.storage_location_id,
              storage_location_name: item.storage_location_name,
              size: item.size,
              total_quantity: item.total_quantity,
              total_weight_kg: item.total_weight_kg,
              batch_count: item.batch_count,
              contributing_batches_count: item.contributing_batches?.length || 0,
              contributing_batches: item.contributing_batches,
              capacity_kg: item.capacity_kg,
              current_usage_kg: item.current_usage_kg,
              utilization_percent: item.utilization_percent,
              status: item.status,
              allKeys: Object.keys(item)
            });
          }
        });
        
        // Summary by storage location
        const storageSummary = data.filter(item => item && typeof item === 'object').reduce((acc, item) => {
          try {
            const key = item.storage_location_name || item.storage_location_id || 'Unknown';
            
            // Ensure key is a valid string
            if (!key || typeof key !== 'string') {
              console.warn('⚠️ Invalid storage key:', key, 'for item:', item);
              return acc;
            }
            
            if (!acc[key]) {
              acc[key] = {
                totalItems: 0,
                totalWeight: 0,
                totalBatches: 0,
                sizes: new Set(),
                status: item.status || 'unknown',
                capacity: item.capacity_kg || 0,
                utilization: item.utilization_percent || 0
              };
            }
            
            // Ensure acc[key] exists before accessing it
            if (acc[key]) {
              acc[key].totalItems += 1;
              acc[key].totalWeight += item.total_weight_kg || 0;
              acc[key].totalBatches += item.batch_count || 0;
              if (item.size !== null && item.size !== undefined) {
                acc[key].sizes.add(item.size);
              }
            }
          } catch (error) {
            console.error('❌ Error processing storage summary item:', error, 'item:', item);
          }
          
          return acc;
        }, {} as any);
        
        console.log('📊 Storage location summary:', storageSummary);
        
        // Data validation
        console.log('✅ Data validation results:');
        const validationResults = {
          hasValidData: data.length > 0,
          hasStorageLocations: data.some(item => item.storage_location_id),
          hasSizeData: data.some(item => item.size !== null),
          hasWeightData: data.some(item => item.total_weight_kg > 0),
          hasBatchData: data.some(item => item.contributing_batches && item.contributing_batches.length > 0),
          totalWeight: data.reduce((sum, item) => sum + (item.total_weight_kg || 0), 0),
          totalBatches: data.reduce((sum, item) => sum + (item.batch_count || 0), 0),
          uniqueSizes: [...new Set(data.map(item => item.size).filter(size => size !== null))].length,
          uniqueStorageLocations: [...new Set(data.map(item => item.storage_location_name))].length
        };
        console.log('📋 Validation results:', validationResults);
      }
      
      setStorageInventoryData(data || []);
      
      // Also fetch sorting batches for detailed view
      const batches = await sortingService.getSortingBatches();
      console.log('📦 Sorting batches received:', batches);
      setSortingBatches(batches || []);
      
      // Fetch oldest batches for removal (FIFO)
      const oldestBatchesData = await inventoryService.getOldestBatchForRemoval();
      console.log('📦 Oldest batches received:', oldestBatchesData);
      console.log('📦 Oldest batches count:', oldestBatchesData?.length || 0);
      if (oldestBatchesData && oldestBatchesData.length > 0) {
        console.log('📦 First oldest batch:', oldestBatchesData[0]);
      }
      setOldestBatches(oldestBatchesData || []);
      
      // Fetch size demand statistics
      const sizeDemandData = await inventoryService.getSizeDemandStatistics();
      console.log('📊 Size demand statistics received:', sizeDemandData);
      setSizeDemandStats(sizeDemandData || []);
      
      // Fetch pending transfers
      const pendingTransfersData = await inventoryService.getPendingTransfers();
      console.log('📦 Pending transfers received:', pendingTransfersData);
      setPendingTransfers(pendingTransfersData || []);
    } catch (err: any) {
      console.error('❌ Error fetching inventory:', err);
      console.error('❌ Error details:', {
        message: err.message,
        stack: err.stack,
        error: err
      });
      setError(err.message || "Failed to fetch inventory data");
      setStorageInventoryData([]);
      setSortingBatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchInventory();
    setRefreshing(false);
  };

  const handleTransferFromInactiveStorage = (storageUnit: any) => {
    if (storageUnit.status === 'inactive' && storageUnit.items.length > 0) {
      // Check if there are pending transfers for this storage
      if (hasPendingTransfersForStorage(storageUnit.location_id)) {
        const message = getPendingTransferMessage(storageUnit.location_id);
        setError(message);
        return;
      }
      
      const items = storageUnit.items.map((item: InventoryItem) => ({
        size: item.size,
        quantity: item.quantity,
        total_weight: item.total_weight
      }));
      
      setTransferSourceStorage({
        id: storageUnit.location_id,
        name: storageUnit.location,
        location_type: storageUnit.location_type
      });
      setItemsToTransfer(items);
      setTransferDialogOpen(true);
    }
  };

  const handleTransferComplete = async () => {
    // Refresh inventory after successful transfer request
    await fetchInventory();
    setTransferDialogOpen(false);
    setTransferSourceStorage(null);
    setItemsToTransfer([]);
    
    // Show success message
    console.log('Transfer request created successfully!');
  };

  // Helper function to check if there are pending transfers for a storage location
  const hasPendingTransfersForStorage = (storageId: string): boolean => {
    return pendingTransfers.some(transfer => 
      transfer.from_storage_location_id === storageId && transfer.status === 'pending'
    );
  };

  // Helper function to get pending transfer message
  const getPendingTransferMessage = (storageId: string): string => {
    const pendingCount = pendingTransfers.filter(transfer => 
      transfer.from_storage_location_id === storageId && transfer.status === 'pending'
    ).length;
    
    if (pendingCount > 0) {
      return `Contact your admin for approval. ${pendingCount} transfer request${pendingCount > 1 ? 's' : ''} already pending.`;
    }
    return '';
  };

  const handleBatchClick = async (batch: any) => {
    try {
      setSelectedBatch(batch);
      setBatchDetailsOpen(true);
      
      // Fetch detailed batch information
      const details = await inventoryService.getBatchDetails(batch.batch_id);
      setBatchDetails(details);
    } catch (error) {
      console.error('Error fetching batch details:', error);
      setBatchDetails(null);
    }
  };






  const handleAddToInventory = async (batchId: string) => {
    try {
      await inventoryService.addStockFromSorting(batchId);
      await fetchInventory();
      console.log('Successfully added batch to inventory');
    } catch (err: any) {
      console.error('Error adding to inventory:', err);
      setError(err.message || "Failed to add to inventory");
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Analytics and computed values
  const inventoryAnalytics = useMemo(() => {
    // Get unique storage locations from the data
    const uniqueStorages = new Map();
    storageInventoryData.forEach((item: any) => {
      if (item.storage_location_id && !uniqueStorages.has(item.storage_location_id)) {
        uniqueStorages.set(item.storage_location_id, {
          id: item.storage_location_id,
          name: item.storage_location_name,
          type: item.storage_location_type,
          status: item.storage_status || 'active',
          capacity_kg: item.capacity_kg || 0,
          current_usage_kg: item.current_usage_kg || 0,
          utilization_percent: item.utilization_percent || 0
        });
      }
    });

    const storageUnits = Array.from(uniqueStorages.values());
    const totalStorage = storageUnits.length;
    const activeStorage = storageUnits.filter(unit => unit.status === 'active').length;
    const totalCapacity = storageUnits.reduce((sum, unit) => sum + (unit.capacity_kg || 0), 0);
    const totalUsed = storageUnits.reduce((sum, unit) => sum + (unit.current_usage_kg || 0), 0);
    const totalItems = storageInventoryData.filter(item => 
      item.size !== null && 
      item.total_quantity > 0 && 
      item.contributing_batches && 
      item.contributing_batches.length > 0
    ).length;
    const avgUtilization = totalStorage > 0 ? storageUnits.reduce((sum, unit) => sum + (unit.utilization_percent || 0), 0) / totalStorage : 0;
    
    // Size distribution - total weight of each size across ALL storage locations
    const sizeDistribution = storageInventoryData.reduce((acc, item) => {
      if (item.size !== null && item.total_weight_kg > 0) {
        acc[item.size] = (acc[item.size] || 0) + item.total_weight_kg;
      }
      return acc;
    }, {} as Record<number, number>);
    
    console.log('📊 Size distribution (total across all storage):', sizeDistribution);
    console.log('🔍 Size 9 total weight:', sizeDistribution[9] || 'NOT FOUND');
    console.log('🔍 All sizes found:', Object.keys(sizeDistribution).map(Number).sort((a, b) => a - b));
    
    // Debug Size 9 specifically
    const size9Items = storageInventoryData.filter(item => item.size === 9);
    console.log('🔍 Size 9 items by storage:', size9Items.map(item => ({
      storage: item.storage_location_name,
      weight: item.total_weight_kg
    })));

    // Top performing storage units - calculate total weight per storage location
    const storageWeightMap = new Map();
    storageInventoryData.forEach((item: any) => {
      if (item.storage_location_id && item.total_weight_kg > 0) {
        const key = item.storage_location_id;
        if (!storageWeightMap.has(key)) {
          storageWeightMap.set(key, {
            storage_location_id: item.storage_location_id,
            storage_location_name: item.storage_location_name,
            total_weight_kg: 0,
            utilization_percent: item.utilization_percent || 0,
            capacity_kg: item.capacity_kg || 0
          });
        }
        storageWeightMap.get(key).total_weight_kg += item.total_weight_kg;
      }
    });
    
    const topStorage = Array.from(storageWeightMap.values())
      .sort((a, b) => b.total_weight_kg - a.total_weight_kg)
      .slice(0, 3);
    
    console.log('🏆 Top storage units by total weight:', topStorage);

    // Alerts
    const alerts: Array<{ type: 'warning' | 'info' | 'error'; message: string }> = [];
    if (avgUtilization > 85) alerts.push({ type: 'warning', message: 'High overall utilization' });
    if (activeStorage < totalStorage * 0.8) alerts.push({ type: 'info', message: 'Some storage units inactive' });
    if (totalUsed > totalCapacity * 0.9) alerts.push({ type: 'error', message: 'Near capacity limit' });

    return {
      totalStorage,
      activeStorage,
      totalCapacity,
      totalUsed,
      totalItems,
      avgUtilization,
      sizeDistribution,
      topStorage,
      alerts
    };
  }, [storageInventoryData]);

  // Group inventory by storage location with accurate capacity data
  const storageUnits = useMemo(() => {
    const units: Record<string, {
      location: string;
      location_id: string;
      location_type: string;
      status: string;
      capacity_kg: number;
      current_usage_kg: number;
      available_capacity_kg: number;
      utilization_percent: number;
      items: InventoryItem[];
    }> = {};
    
    // Process each item in the inventory data
    storageInventoryData.forEach((item: any) => {
      const key = item.storage_location_id || 'unknown';
      
      // Initialize storage unit if it doesn't exist
      if (!units[key]) {
        units[key] = {
          location: item.storage_location_name || 'Unknown Storage',
          location_id: item.storage_location_id || 'unknown',
          location_type: item.storage_location_type || 'unknown',
          status: item.storage_status || 'active', // Preserve the actual status from database
          capacity_kg: item.capacity_kg || 0,
          current_usage_kg: item.current_usage_kg || 0,
          available_capacity_kg: item.available_capacity_kg || 0,
          utilization_percent: item.utilization_percent || 0,
          items: []
        };
      }

      // Add inventory item if it has valid data AND proper sorting batch data
      // Include empty storage locations (size === null) and items with valid sizes
      if (item.size === null || (item.size !== null && item.size !== undefined && item.total_quantity > 0)) {
        // For empty storage locations (size === null), just initialize the storage unit
        if (item.size === null) {
          // Empty storage location - already initialized above, no items to add
          return;
        }
        
        // Only show sizes that have been properly sorted from batches
        const hasValidBatchData = item.contributing_batches && item.contributing_batches.length > 0;
        
        if (hasValidBatchData) {
          // Check if this size already exists in the storage unit
          const existingItemIndex = units[key].items.findIndex(existingItem => existingItem.size === item.size);
          
          if (existingItemIndex >= 0) {
            // Update existing item
            units[key].items[existingItemIndex].quantity += item.total_quantity;
            units[key].items[existingItemIndex].total_weight += item.total_weight_kg || 0;
            // Merge contributing batches
            units[key].items[existingItemIndex].contributing_batches = [
              ...(units[key].items[existingItemIndex].contributing_batches || []),
              ...item.contributing_batches
            ];
            units[key].items[existingItemIndex].batch_count = (units[key].items[existingItemIndex].batch_count || 0) + (item.batch_count || 0);
          } else {
            // Add new item with contributing batches
        units[key].items.push({
          id: `${key}-${item.size}`,
          size: item.size,
          quantity: item.total_quantity,
              total_weight: item.total_weight_kg || 0,
          created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              batch_count: item.batch_count || 0,
              contributing_batches: item.contributing_batches || []
            });
          }
        } else {
          // Log items that don't have proper batch data for debugging
          console.warn('⚠️ Skipping inventory item without proper batch data:', {
            storage_location_id: item.storage_location_id,
            size: item.size,
            quantity: item.total_quantity,
            hasContributingBatches: item.contributing_batches && item.contributing_batches.length > 0,
            contributingBatchesCount: item.contributing_batches?.length || 0
          });
        }
      }
    });

    // Sort items by size within each storage unit
    Object.values(units).forEach(unit => {
      unit.items.sort((a, b) => a.size - b.size);
    });

    const result = Object.values(units);
    
    // Check for duplicate location IDs
    const locationIds = result.map(unit => unit.location_id);
    const duplicateIds = locationIds.filter((id, index) => locationIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      console.warn('⚠️ Duplicate location IDs found:', duplicateIds);
    }
    
    console.log('🏭 Processed storage units:', {
      totalUnits: result.length,
      unitsWithItems: result.filter(unit => unit.items.length > 0).length,
      totalItems: result.reduce((sum, unit) => sum + unit.items.length, 0),
      itemsWithBatches: result.reduce((sum, unit) => 
        sum + unit.items.filter(item => item.contributing_batches && item.contributing_batches.length > 0).length, 0),
      sampleUnit: result[0] || null,
      sampleItemWithBatches: result.find(unit => 
        unit.items.some(item => item.contributing_batches && item.contributing_batches.length > 0)
      )?.items.find(item => item.contributing_batches && item.contributing_batches.length > 0) || null,
      locationIds: locationIds,
      duplicateIds: duplicateIds
    });
    
    // Detailed processing analysis
    console.log('🔍 Detailed processing analysis:');
    result.forEach((unit, index) => {
      if (index < 2) { // Log first 2 units in detail
        console.log(`Storage Unit ${index + 1} (${unit.location}):`, {
          location_id: unit.location_id,
          status: unit.status,
          capacity_kg: unit.capacity_kg,
          current_usage_kg: unit.current_usage_kg,
          utilization_percent: unit.utilization_percent,
          totalItems: unit.items.length,
          items: unit.items.map(item => ({
            size: item.size,
            quantity: item.quantity,
            total_weight: item.total_weight,
            batch_count: item.batch_count,
            contributing_batches_count: item.contributing_batches?.length || 0
          }))
        });
      }
    });

    return result;
  }, [storageInventoryData]);

  const { user } = useAuth();

  if (loading && storageInventoryData.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-600 font-medium">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 content-container responsive-padding">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Package className="h-6 w-6 md:h-8 md:w-8 text-blue-600" /> 
              Inventory Management
            </h1>
            <p className="text-gray-600 mt-1">Manage fish inventory across storage locations</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={() => onNavigate('transfers')}
              variant="outline" 
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <FileText className="w-4 h-4" />
              Transfer Approvals
            </Button>
            <Button 
              onClick={() => onNavigate('dashboard')}
              variant="outline" 
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <Home className="w-4 h-4" />
              Dashboard
            </Button>
          </div>
        </div>

      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Storage</p>
              <p className="text-2xl font-bold text-blue-600">{inventoryAnalytics.totalStorage}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-2 flex items-center text-sm">
            <span className="text-green-600 font-medium">{inventoryAnalytics.activeStorage} active</span>
            <span className="text-gray-400 mx-2">•</span>
            <span className="text-gray-500">{inventoryAnalytics.totalStorage - inventoryAnalytics.activeStorage} inactive</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Capacity</p>
              <p className="text-2xl font-bold text-green-600">{inventoryAnalytics.totalCapacity.toFixed(1)}kg</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Scale className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-2 flex items-center text-sm">
            <span className="text-gray-600">{inventoryAnalytics.totalUsed.toFixed(1)}kg used</span>
            <span className="text-gray-400 mx-2">•</span>
            <span className="text-gray-500">{(inventoryAnalytics.totalCapacity - inventoryAnalytics.totalUsed).toFixed(1)}kg available</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Utilization</p>
              <p className="text-2xl font-bold text-orange-600">{inventoryAnalytics.avgUtilization.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-2 flex items-center text-sm">
            {inventoryAnalytics.avgUtilization > 85 ? (
              <span className="text-red-600 font-medium flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                High usage
              </span>
            ) : inventoryAnalytics.avgUtilization > 70 ? (
              <span className="text-yellow-600 font-medium flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                Moderate usage
              </span>
            ) : (
              <span className="text-green-600 font-medium flex items-center">
                <CheckCircle className="w-4 h-4 mr-1" />
                Optimal usage
              </span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Items</p>
              <p className="text-2xl font-bold text-purple-600">{inventoryAnalytics.totalItems}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Layers className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-2 flex items-center text-sm">
            <span className="text-gray-600">Size classes</span>
            <span className="text-gray-400 mx-2">•</span>
            <span className="text-gray-500">Across {inventoryAnalytics.totalStorage} locations</span>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {inventoryAnalytics.alerts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-gray-900">System Alerts</h3>
          </div>
          <div className="space-y-2">
            {inventoryAnalytics.alerts.map((alert, index) => (
              <div key={index} className={`flex items-center gap-2 p-3 rounded-lg ${
                alert.type === 'error' ? 'bg-red-50 border border-red-200' :
                alert.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                'bg-blue-50 border border-blue-200'
              }`}>
                <AlertCircle className={`w-4 h-4 ${
                  alert.type === 'error' ? 'text-red-600' :
                  alert.type === 'warning' ? 'text-yellow-600' :
                  'text-blue-600'
                }`} />
                <span className={`text-sm font-medium ${
                  alert.type === 'error' ? 'text-red-800' :
                  alert.type === 'warning' ? 'text-yellow-800' :
                  'text-blue-800'
                }`}>
                  {alert.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

          {/* Error Message */}
          {error && (
            <div className={`border rounded-lg p-4 ${
              error.includes('Contact your admin') 
                ? 'bg-yellow-50 border-yellow-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                <AlertCircle className={`w-5 h-5 ${
                  error.includes('Contact your admin') ? 'text-yellow-600' : 'text-red-600'
                }`} />
                  <div>
                  <h3 className={`font-medium ${
                    error.includes('Contact your admin') ? 'text-yellow-800' : 'text-red-800'
                  }`}>
                    {error.includes('Contact your admin') ? 'Transfer Request Pending' : 'Error Loading Data'}
                  </h3>
                  <p className={`text-sm mt-1 ${
                    error.includes('Contact your admin') ? 'text-yellow-700' : 'text-red-700'
                  }`}>
                    {error}
                  </p>
                  {!error.includes('Contact your admin') && (
                    <Button 
                    onClick={fetchInventory} 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                    >
                      Try Again
                    </Button>
                  )}
                  {error.includes('Contact your admin') && (
                    <Button 
                    onClick={() => onNavigate('transfers')} 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                    >
                      View Transfer Approvals
                    </Button>
                  )}
                  </div>
                  </div>
                </div>
          )}

        {/* Enhanced Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="flex-1 w-full sm:max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                  placeholder="Search storage locations..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                    />
                  </div>
                </div>
              
              {/* Sort Dropdown */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="name">Sort by Name</option>
                  <option value="capacity">Sort by Capacity</option>
                  <option value="utilization">Sort by Utilization</option>
                  <option value="items">Sort by Items</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              {/* View Mode Toggle */}
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <Button
                  onClick={() => setViewMode('grid')}
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-none border-0 hover:bg-blue-50"
                  title="Grid View"
                >
                  <Layers className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => setViewMode('list')}
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-none border-0 hover:bg-green-50"
                  title="List View"
                >
                  <FileText className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => setViewMode('analytics')}
                  variant={viewMode === 'analytics' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-none border-0 hover:bg-purple-50"
                  title="Analytics View"
                >
                  <BarChart3 className="w-4 h-4" />
                </Button>
              </div>
              
              <Button 
                onClick={handleRefresh}
                variant="outline"
                size="sm" 
                disabled={refreshing}
                className="flex-1 sm:flex-none"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
              </div>
      </div>

        {/* Enhanced Storage Display */}
        {viewMode === 'analytics' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Size Distribution Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Size Distribution</h3>
                  <p className="text-xs text-gray-500">Total across all storage locations</p>
                </div>
              </div>
              <div className="space-y-3">
                {Object.entries(inventoryAnalytics.sizeDistribution)
                  .sort(([,a], [,b]) => (b as number) - (a as number))
                  .slice(0, 12)
                  .map(([size, quantity]) => (
                    <div key={size} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-semibold text-blue-600">{size}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-700">Size {size}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${((quantity as number) / Math.max(...Object.values(inventoryAnalytics.sizeDistribution).map(v => v as number))) * 100}%` 
                            }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-600 w-16 text-right">{(quantity as number).toFixed(1)}kg</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Oldest Batches for Removal */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-orange-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Oldest Batches (FIFO)</h3>
                  <p className="text-xs text-gray-500">Next batches to be removed</p>
                </div>
              </div>
              <div className="space-y-3">
                {oldestBatches.slice(0, 5).map((batch, index) => (
                  <div 
                    key={batch.batch_id} 
                    className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors"
                    onClick={() => handleBatchClick(batch)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-orange-600">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Batch {batch.batch_number}</p>
                        <p className="text-sm text-gray-500">Size {batch.size_class} • {batch.days_in_storage} days old</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-orange-600">{batch.total_weight_kg?.toFixed(1)}kg</p>
                      <p className="text-xs text-orange-500 mt-1">Click to view details</p>
                    </div>
                  </div>
                ))}
                {oldestBatches.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No batches available for removal</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Check console for debugging info
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Size Demand Statistics */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Size Demand Statistics</h3>
                  <p className="text-xs text-gray-500">Based on outlet orders (most requested first)</p>
                </div>
              </div>
              <div className="space-y-3">
                {sizeDemandStats.slice(0, 8).map((size, index) => (
                  <div key={size.size_class} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-purple-600">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Size {size.size_class}</p>
                        <p className="text-sm text-gray-500">
                          {size.total_orders} orders • {size.unique_outlets} outlets • 
                          {size.days_span > 0 ? `${size.days_span} days span` : 'Recent'}
                        </p>
                        <p className="text-xs text-purple-600">
                          Grade {size.most_requested_grade} preferred
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-purple-600">{size.total_weight_kg_requested.toFixed(1)}kg</p>
                      <p className="text-xs text-gray-400">total requested</p>
                    </div>
                  </div>
                ))}
                {sizeDemandStats.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No size demand data available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Top Storage Units */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-green-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Top Storage Units</h3>
                  <p className="text-xs text-gray-500">By total weight across all sizes</p>
                </div>
              </div>
              <div className="space-y-3">
                {inventoryAnalytics.topStorage.map((unit, index) => (
                  <div key={`top-storage-${unit.storage_location_id}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        index === 0 ? 'bg-yellow-100 text-yellow-600' :
                        index === 1 ? 'bg-gray-100 text-gray-600' :
                        'bg-orange-100 text-orange-600'
                      }`}>
                        <span className="text-sm font-bold">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{unit.storage_location_name || `Storage Unit ${index + 1}`}</p>
                        <p className="text-sm text-gray-500">{unit.utilization_percent?.toFixed(1)}% utilized</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">{unit.total_weight_kg?.toFixed(1)}kg</p>
                      <p className="text-xs text-gray-400">total weight</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {storageUnits
            .filter(unit => 
              !searchTerm || 
              unit.location.toLowerCase().includes(searchTerm.toLowerCase())
            )
              .sort((a, b) => {
                switch (sortBy) {
                  case 'capacity':
                    return b.capacity_kg - a.capacity_kg;
                  case 'utilization':
                    return b.utilization_percent - a.utilization_percent;
                  case 'items':
                    return b.items.length - a.items.length;
                  default:
                    return a.location.localeCompare(b.location);
                }
              })
            .map((unit, index) => {
              const isExpanded = expandedStorages.has(unit.location_id);
              
              return (
                <Card key={`${unit.location_id}-${index}`} className="card-shadow">
                  {/* Storage Header - Clickable to expand/collapse */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => {
                      const newExpanded = new Set(expandedStorages);
                      if (isExpanded) {
                        newExpanded.delete(unit.location_id);
                    } else {
                        newExpanded.add(unit.location_id);
                    }
                      setExpandedStorages(newExpanded);
                  }}
                >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Package className="w-5 h-5 text-blue-600" />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-gray-900">{unit.location}</h3>
                            {hasPendingTransfersForStorage(unit.location_id) && (
                              <Badge variant="destructive" className="text-xs">
                                {pendingTransfers.filter(transfer => 
                                  transfer.from_storage_location_id === unit.location_id && transfer.status === 'pending'
                                ).length} Pending
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{unit.location_type} • {unit.items.length} size classes</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm text-gray-600">
                            {unit.current_usage_kg.toFixed(1)}kg / {unit.capacity_kg}kg
                          </div>
                          <div className="text-xs text-gray-500">
                            {unit.utilization_percent.toFixed(1)}% utilized
                          </div>
                    </div>
                        
                        {/* Quick Actions */}
                    <div className="flex items-center gap-2">
                          {unit.utilization_percent >= 95 && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                              <AlertCircle className="w-3 h-3" />
                              <span>Full</span>
                            </div>
                          )}
                          
                      <Badge 
                            variant={unit.status === 'active' ? 'default' : 'secondary'}
                            className={unit.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                          >
                            {unit.status}
                      </Badge>
                          
                          {unit.status === 'inactive' && unit.items.length > 0 && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTransferFromInactiveStorage(unit);
                          }}
                              variant="outline"
                              size="sm"
                              className={`${
                                hasPendingTransfersForStorage(unit.location_id) 
                                  ? "text-red-600 border-red-200 hover:bg-red-50" 
                                  : "text-orange-600 border-orange-200 hover:bg-orange-50"
                              }`}
                        >
                              <ArrowRight className="w-4 h-4 mr-1" />
                              {hasPendingTransfersForStorage(unit.location_id) ? "Pending Transfer" : "Transfer"}
                        </Button>
                      )}
                          
                          {unit.status === 'active' && unit.items.length > 0 && (
                            <Button
                              onClick={async (e) => {
                                e.stopPropagation();
                                
                                if (openingTransferDialog) return; // Prevent double clicks
                                
                                // Check if there are pending transfers for this storage
                                if (hasPendingTransfersForStorage(unit.location_id)) {
                                  const message = getPendingTransferMessage(unit.location_id);
                                  setError(message);
                                  return;
                                }
                                
                                setOpeningTransferDialog(true);
                                
                                try {
                                  // Quick transfer action for active storage
                                  const items = unit.items.map((item: InventoryItem) => ({
                                    size: item.size,
                                    quantity: item.quantity,
                                    total_weight: item.total_weight
                                  }));
                                  setTransferSourceStorage({
                                    id: unit.location_id,
                                    name: unit.location,
                                    location_type: unit.location_type
                                  });
                                  setItemsToTransfer(items);
                                  setTransferDialogOpen(true);
                                } finally {
                                  setOpeningTransferDialog(false);
                                }
                              }}
                              disabled={openingTransferDialog}
                              variant="outline"
                              size="sm"
                              className={`${
                                hasPendingTransfersForStorage(unit.location_id) 
                                  ? "text-red-600 border-red-200 hover:bg-red-50" 
                                  : "text-blue-600 border-blue-200 hover:bg-blue-50"
                              } ${openingTransferDialog ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              {openingTransferDialog ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                  Opening...
                                </>
                              ) : (
                                <>
                                  <Zap className="w-4 h-4 mr-1" />
                                  {hasPendingTransfersForStorage(unit.location_id) ? "Pending Transfer" : "Quick Transfer"}
                                </>
                              )}
                        </Button>
                      )}
                    </div>
                  </div>
                    </div>
                    
                    {/* Enhanced Capacity Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">Capacity</span>
                        <span className={`text-xs font-medium ${
                          unit.utilization_percent >= 95 ? 'text-red-600' :
                          unit.utilization_percent > 80 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {unit.utilization_percent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-3 rounded-full transition-all duration-500 ease-out ${
                            unit.utilization_percent >= 95 ? 'bg-gradient-to-r from-red-400 to-red-600' :
                            unit.utilization_percent > 80 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 
                            'bg-gradient-to-r from-green-400 to-green-600'
                          }`}
                          style={{ width: `${unit.utilization_percent >= 95 ? 100 : Math.min(unit.utilization_percent, 100)}%` }}
                        ></div>
                    </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0kg</span>
                        <span>{unit.capacity_kg}kg</span>
                    </div>
                    </div>
                    </div>

                  {/* Collapsible Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4">
                      {unit.items.length === 0 ? (
                        <div className="text-center py-8">
                          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500 text-sm">No inventory items</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-700 mb-3">Inventory Items</h4>
                          {unit.items.map((item) => (
                            <div 
                              key={item.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => setSelectedItem(item)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                  <span className="text-sm font-semibold text-blue-600">{item.size}</span>
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">Size {item.size}</p>
                                  <p className="text-sm text-gray-500">{item.batch_count} batch{item.batch_count !== 1 ? 'es' : ''}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-green-600">{item.total_weight.toFixed(1)}kg</p>
                                <Eye className="w-4 h-4 text-gray-400" />
                  </div>
              </div>
                  ))}
                </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
        </div>
        )}


        {/* Item Details Modal */}
      {selectedItem && (
        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                  Size {selectedItem.size} - Inventory Details
              </DialogTitle>
            </DialogHeader>
              
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-600" />
                <div>
                          <p className="text-sm text-gray-600">Total Quantity</p>
                          <p className="text-2xl font-bold text-gray-900">{selectedItem.quantity}</p>
                          </div>
                            </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-green-600" />
                            <div>
                          <p className="text-sm text-gray-600">Total Weight</p>
                          <p className="text-2xl font-bold text-gray-900">{selectedItem.total_weight.toFixed(1)}kg</p>
                            </div>
                            </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-orange-600" />
                            <div>
                          <p className="text-sm text-gray-600">Avg Weight/Fish</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {selectedItem.quantity > 0 ? (selectedItem.total_weight / selectedItem.quantity).toFixed(2) : '0.00'}kg
                          </p>
                            </div>
                          </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-600" />
                            <div>
                          <p className="text-sm text-gray-600">Contributing Batches</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {selectedItem.batch_count || selectedItem.contributing_batches?.length || 0}
                          </p>
                            </div>
                          </div>
                    </CardContent>
                  </Card>
                        </div>

              {/* Contributing Batches */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                    <Layers className="w-5 h-5" />
                      Contributing Batches
                      {selectedItem.contributing_batches && selectedItem.contributing_batches.length > 6 && (
                      <span className="text-sm text-gray-500 font-normal ml-2">
                        (scroll to see all)
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                  <CardContent>
                  <div className="border border-gray-200 rounded-lg bg-gray-50 max-h-[500px] overflow-y-auto">
                    <div className="p-4 space-y-4">
                      {selectedItem.contributing_batches && selectedItem.contributing_batches.length > 0 ? (
                        selectedItem.contributing_batches.map((batch: any, index: number) => (
                        <div key={batch.batch_id || index} className="p-4 border border-gray-300 rounded-lg bg-white shadow-sm">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-600">Batch Number</label>
                              <p className="font-semibold text-gray-900">{batch.batch_number}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-600">Weight Added</label>
                              <p className="font-semibold text-green-600 text-lg">{batch.weight_kg?.toFixed(1)}kg</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-600">Quantity Added</label>
                              <p className="font-semibold text-gray-500">Batch #{batch.batch_number}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-600">Storage Location</label>
                              <p className="font-semibold text-gray-900">{batch.storage_location_name || 'Unknown'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-600">Farmer</label>
                              <p className="font-semibold text-gray-900">{batch.farmer_name || 'Unknown'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-600">Processing Date</label>
                                <p className="font-semibold text-gray-900">{batch.processing_date || 'Unknown'}</p>
                            </div>
                              <div>
                                <label className="text-sm font-medium text-gray-600">Added Date</label>
                                <p className="font-semibold text-gray-900">
                                  {new Date(batch.added_date).toLocaleDateString()}
                                </p>
                            </div>
                          </div>
                        </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500 text-sm">No contributing batches found</p>
                          <p className="text-gray-400 text-xs mt-1">
                            This may indicate that the data is still being processed or there's an issue with the batch tracking.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  </CardContent>
                </Card>
            </div>
        </DialogContent>
      </Dialog>
      )}

          {/* Transfer Dialog */}
        {transferDialogOpen && transferSourceStorage && (
            <TransferDialog
              isOpen={transferDialogOpen}
              onClose={() => {
                setTransferDialogOpen(false);
                setTransferSourceStorage(null);
                setItemsToTransfer([]);
              }}
              sourceStorage={transferSourceStorage}
              itemsToTransfer={itemsToTransfer}
              onTransferComplete={handleTransferComplete}
            />
      )}
      
      {/* Batch Details Dialog */}
      {batchDetailsOpen && (
        <Dialog open={batchDetailsOpen} onOpenChange={setBatchDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-600" />
                Batch Details - {selectedBatch?.batch_number}
              </DialogTitle>
            </DialogHeader>
            
            {batchDetails ? (
              <div className="space-y-6">
                {/* Batch Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-3">Batch Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Batch Number</label>
                      <p className="font-semibold text-gray-900">{batchDetails.batch?.batch_number}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Created Date</label>
                      <p className="font-semibold text-gray-900">
                        {batchDetails.batch?.created_at ? new Date(batchDetails.batch.created_at).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Processing Date</label>
                      <p className="font-semibold text-gray-900">
                        {batchDetails.batch?.processing_record?.processing_date || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Farmer</label>
                      <p className="font-semibold text-gray-900">
                        {batchDetails.batch?.processing_record?.warehouse_entry?.farmers?.name || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sizes Information */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Remaining Sizes</h3>
                  <div className="space-y-3">
                    {batchDetails.sizes?.map((size: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-blue-600">{size.size_class}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Size {size.size_class}</p>
                            <p className="text-sm text-gray-500">{size.storage_location_name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-blue-600">{size.total_weight_kg?.toFixed(1)}kg</p>
                          <p className="text-xs text-gray-400">{size.total_pieces} pieces</p>
                        </div>
                      </div>
                    ))}
                    {(!batchDetails.sizes || batchDetails.sizes.length === 0) && (
                      <div className="text-center py-4 text-gray-500">
                        <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No sizes remaining in this batch</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 mx-auto mb-2 text-gray-400 animate-spin" />
                <p className="text-sm text-gray-500">Loading batch details...</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
      
      </div>
    </div>
  );
}