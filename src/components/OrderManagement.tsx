import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "./ui/dialog";
import { Checkbox } from "./ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Alert, AlertDescription } from "./ui/alert";
import { 
  ShoppingCart, Plus, Phone, MapPin, CheckCircle, 
  Clock, Calendar, Star, Fish, Ruler, Building2, 
  Package, AlertTriangle, Search, Filter, 
  Eye, Send, Truck, Warehouse, X, Check, 
  Ban, UserCheck, ThumbsUp, FileText, PlusCircle,
  TrendingUp, DollarSign, Users, Bike, Weight
} from "lucide-react";
import { NavigationSection, OutletOrder } from "../types";
import { orderService, outletService } from "../services/database";
import { supabase } from "../lib/supabaseClient";
import { inventoryService } from "../services/inventoryService";
import { toast } from "sonner";
import { FishFarmMarquee } from './FishFarmMarquee';
import { useAuth } from "./AuthContext";
import { RioFishLogo } from "./RioFishLogo";
import { auditLog } from "../utils/auditLogger";

// Interface for outlet data
interface Outlet {
  id: string;
  name: string;
  location: string;
  phone: string;
  manager_name?: string;
  status: string;
}

// Fish sizes and their descriptions
const fishSizes = [
  { size: 0, label: 'Size 0 - Premium Large', description: '2.5+ kg each' },
  { size: 1, label: 'Size 1 - Extra Large', description: '2.0-2.5 kg each' },
  { size: 2, label: 'Size 2 - Large', description: '1.5-2.0 kg each' },
  { size: 3, label: 'Size 3 - Medium-Large', description: '1.2-1.5 kg each' },
  { size: 4, label: 'Size 4 - Medium', description: '1.0-1.2 kg each' },
  { size: 5, label: 'Size 5 - Medium-Small', description: '0.8-1.0 kg each' },
  { size: 6, label: 'Size 6 - Small-Medium', description: '0.6-0.8 kg each' },
  { size: 7, label: 'Size 7 - Small', description: '0.4-0.6 kg each' },
  { size: 8, label: 'Size 8 - Extra Small', description: '0.3-0.4 kg each' },
  { size: 9, label: 'Size 9 - Mini', description: '0.2-0.3 kg each' },
  { size: 10, label: 'Size 10 - Tiny', description: '0.1-0.2 kg each' }
];

// Interface for manager data
interface Manager {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
}

interface OrderManagementProps {
  onNavigate: (section: NavigationSection, itemId?: string) => void;
}

interface InventoryItem {
  id: string;
  warehouse_entry_id: string;
  processing_date: string;
  processed_by: string | null;
  pre_processing_weight: number;
  post_processing_weight: number;
  processing_waste: number;
  processing_yield: number;
  size_distribution: any;
  grading_results: any;
  final_value: number;
  ready_for_dispatch_count: number;
  created_at: string;
  updated_at: string;
  // Derived fields for display
  final_grade?: string;
  final_size?: number;
  storage_location?: string;
  farmer_name?: string;
  entry_date?: string;
  total_pieces?: number;
  total_value?: number;
}

interface PickedItem {
  inventoryItem: InventoryItem;
  quantity: number;
  weight: number;
}

export default function OrderManagement({ onNavigate }: OrderManagementProps) {
  const { user } = useAuth();
  
  // Data state
  const [outletOrders, setOutletOrders] = useState<OutletOrder[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [showInventoryPicker, setShowInventoryPicker] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OutletOrder | null>(null);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<OutletOrder | null>(null);

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
  
  // Filter state
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');

  // Form state
  const [formData, setFormData] = useState({
    outlet_id: '',
    requested_quantity: '',
    requested_grade: '',
    price_per_kg: '',
    requested_sizes: [] as number[],
    size_quantities: {} as Record<number, number>, // kg per size
    use_any_size: false, // option to pick any available size
    delivery_date: '',
    notes: ''
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmation form state
  const [confirmationData, setConfirmationData] = useState({
    confirmedBy: '',
    notes: '',
    action: 'approve' as 'approve' | 'discard'
  });
  const [isConfirming, setIsConfirming] = useState(false);


  // Inventory picker state
  const [pickedItems, setPickedItems] = useState<PickedItem[]>([]);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);

  // Size selection state
  const [availableSizes, setAvailableSizes] = useState<number[]>([]);
  const [loadingSizes, setLoadingSizes] = useState(false);
  const [sizeDetails, setSizeDetails] = useState<{[key: number]: {
    quantity: number;
    storageLocation: string;
    grade: string;
    totalWeight: number;
  }}>({});

  // ==================== UTILITY FUNCTIONS ====================
  
  // Get available grades for selected sizes
  const getAvailableGrades = () => {
    if (formData.requested_sizes.length === 0) return [];
    
    const availableGrades = new Set<string>();
    formData.requested_sizes.forEach(size => {
      const details = sizeDetails[size];
      if (details && details.grade) {
        availableGrades.add(details.grade);
      }
    });
    
    return Array.from(availableGrades).sort();
  };

  // Handle size quantity change
  const handleSizeQuantityChange = (size: number, quantity: number) => {
    setFormData(prev => ({
      ...prev,
      size_quantities: {
        ...prev.size_quantities,
        [size]: quantity
      }
    }));
  };

  // Handle "any size" toggle
  const handleAnySizeToggle = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      use_any_size: checked,
      requested_sizes: checked ? [] : prev.requested_sizes,
      size_quantities: checked ? {} : prev.size_quantities
    }));
  };

  // ==================== DATA FETCHING FUNCTIONS ====================
  
  // Fetch available sizes using inventory system
  const fetchAvailableSizes = async (outletId: string) => {
    setLoadingSizes(true);
    try {
      // Use the inventory service to get real-time stock by storage location
      const inventoryData = await inventoryService.getInventoryByStorage();
      
      if (!inventoryData || inventoryData.length === 0) {
        console.log('No inventory data available');
        setAvailableSizes([]);
        setSizeDetails({});
        return;
      }

      // Debug logging to see what data we received
      if (process.env.NODE_ENV === 'development') {
        console.log('OrderManagement fetchAvailableSizes - Inventory data:', inventoryData);
        console.log('OrderManagement fetchAvailableSizes - Data length:', inventoryData?.length);
      }

      // Extract sizes from inventory data and aggregate details
      const sizes = new Set<number>();
      const sizeDetailsMap: {[key: number]: {
        quantity: number;
        storageLocation: string;
        grade: string;
        totalWeight: number;
      }} = {};

      inventoryData.forEach(item => {
        const size = item.size;
        if (!isNaN(size) && item.total_quantity > 0) {
              sizes.add(size);
              
              if (!sizeDetailsMap[size]) {
                sizeDetailsMap[size] = {
                  quantity: 0,
              storageLocation: item.storage_location_name || 'Unknown Storage',
              grade: 'A', // Default grade - could be enhanced later
                  totalWeight: 0
                };
              }
              
          // Add to existing totals
          sizeDetailsMap[size].quantity += item.total_quantity;
          sizeDetailsMap[size].totalWeight += item.total_weight_kg;
          
          // Use the first storage location name (could be enhanced to show multiple)
          if (sizeDetailsMap[size].storageLocation === 'Unknown Storage') {
            sizeDetailsMap[size].storageLocation = item.storage_location_name || 'Unknown Storage';
          }
          
          // Debug logging for inventory data
              if (process.env.NODE_ENV === 'development') {
            console.log(`Size ${size}: quantity=${item.total_quantity}, weight=${item.total_weight_kg.toFixed(2)}kg, storage=${item.storage_location_name}`);
              }
        }
      });

      // Debug logging to help troubleshoot weight calculation
      if (process.env.NODE_ENV === 'development') {
        console.log('OrderManagement fetchAvailableSizes - Size Details:', sizeDetailsMap);
        console.log('OrderManagement fetchAvailableSizes - Available Sizes:', Array.from(sizes).sort((a, b) => a - b));
      }

      setAvailableSizes(Array.from(sizes).sort((a, b) => a - b));
      setSizeDetails(sizeDetailsMap);
    } catch (error) {
      console.error("Error fetching available sizes:", error);
      toast.error('Failed to fetch available sizes', {
        description: 'Please try again or check your connection',
        duration: 5000,
      });
      setAvailableSizes([]);
      setSizeDetails({});
    } finally {
      setLoadingSizes(false);
    }
  };

  // Fetch inventory data
  const fetchInventory = async () => {
    try {
      // Use processing_records (same as InventoryManagement) instead of fish_inventory
      const { data, error } = await supabase
        .from("processing_records")
        .select(`
          *,
          warehouse_entries!inner(
            entry_date,
            total_weight,
            total_pieces,
            condition,
            temperature,
            price_per_kg,
            total_value,
            notes,
            farmers!inner(
              name,
              phone,
              location,
              rating,
              reliability
            )
          )
        `)
        .gt("ready_for_dispatch_count", 0)
        .order("processing_date", { ascending: false });

      if (error) throw error;
      
      // Transform the data to include derived fields (same logic as InventoryManagement)
      const transformedData = data?.map(record => {
        // Extract size from size_distribution JSONB (first key)
        let finalSize = 0;
        if (record.size_distribution && typeof record.size_distribution === 'object') {
          const sizeKeys = Object.keys(record.size_distribution);
          if (sizeKeys.length > 0) {
            finalSize = parseInt(sizeKeys[0]) || 0;
          }
        }
        
        // Extract grade from grading_results JSONB
        let finalGrade = 'Unknown';
        if (record.grading_results && typeof record.grading_results === 'object') {
          const gradeKeys = Object.keys(record.grading_results);
          if (gradeKeys.length > 0) {
            finalGrade = gradeKeys[0];
          }
        }
        
        const warehouseEntry = record.warehouse_entries;
        const farmer = warehouseEntry?.farmers;
        
        return {
          ...record,
          final_grade: finalGrade,
          final_size: finalSize,
          storage_location: 'Processing Area', // Default location
          farmer_name: farmer?.name || 'Unknown Farmer',
          entry_date: warehouseEntry?.entry_date,
          total_pieces: warehouseEntry?.total_pieces,
          condition: warehouseEntry?.condition,
          temperature: warehouseEntry?.temperature,
          price_per_kg: warehouseEntry?.price_per_kg,
          total_value: warehouseEntry?.total_value,
          notes: warehouseEntry?.notes,
          farmer_phone: farmer?.phone,
          farmer_location: farmer?.location,
          farmer_rating: farmer?.rating,
          farmer_reliability: farmer?.reliability,
        };
      }) || [];
      
      // Group by size and storage location, then sum quantities
      const groupedBySizeAndStorage = transformedData.reduce((acc, record) => {
        const size = record.final_size;
        const storage = record.storage_location;
        const groupKey = `${size}_${storage}`;
        
        if (!acc[groupKey]) {
          acc[groupKey] = {
            id: `grouped_${groupKey}`,
            final_size: size,
            final_grade: record.final_grade,
            storage_location: storage,
            total_quantity: 0,
            total_weight: 0, // Add total weight field
            total_value: 0,
            processing_records: [],
            farmers: new Set(),
            entry_dates: new Set(),
            conditions: new Set(),
            temperatures: [],
            processed_by_names: new Set(),
            ready_for_dispatch_count: 0,
            // Keep original fields for compatibility
            warehouse_entry_id: record.warehouse_entry_id,
            processing_date: record.processing_date,
            processed_by: record.processed_by,
            pre_processing_weight: record.pre_processing_weight,
            post_processing_weight: record.post_processing_weight,
            processing_waste: record.processing_waste,
            processing_yield: record.processing_yield,
            size_distribution: record.size_distribution,
            grading_results: record.grading_results,
            final_value: record.final_value,
            created_at: record.created_at,
            updated_at: record.updated_at,
            farmer_name: record.farmer_name,
            entry_date: record.entry_date,
            total_pieces: record.total_pieces,
            condition: record.condition,
            temperature: record.temperature,
            price_per_kg: record.price_per_kg,
            notes: record.notes,
            farmer_phone: record.farmer_phone,
            farmer_location: record.farmer_location,
            farmer_rating: record.farmer_rating,
            farmer_reliability: record.farmer_reliability
          };
        }
        
        // Sum quantities from size_distribution for this specific size
        const sizeDistribution = record.size_distribution || {};
        const quantityForThisSize = sizeDistribution[size] || 0;
        
        acc[groupKey].total_quantity += quantityForThisSize;
        
        // Calculate weight for this specific size
        // Estimate weight per piece for this size from the total post-processing weight
        const totalFishInRecord = Object.values(sizeDistribution).reduce((sum: number, qty: any) => sum + (Number(qty) || 0), 0);
        const avgWeightPerPiece = totalFishInRecord > 0 ? record.post_processing_weight / totalFishInRecord : 0;
        const weightForThisSize = quantityForThisSize * avgWeightPerPiece;
        acc[groupKey].total_weight += weightForThisSize;
        
        acc[groupKey].total_value += record.final_value || 0;
        acc[groupKey].processing_records.push(record.id);
        acc[groupKey].farmers.add(record.farmer_name);
        acc[groupKey].entry_dates.add(record.entry_date);
        acc[groupKey].conditions.add(record.condition);
        if (record.temperature) acc[groupKey].temperatures.push(record.temperature);
        acc[groupKey].ready_for_dispatch_count += record.ready_for_dispatch_count || 0;
        
        return acc;
      }, {} as Record<string, any>);

      // Convert grouped data back to array and add summary fields
      const groupedData = Object.values(groupedBySizeAndStorage).map((group: any) => ({
        ...group,
        farmers: Array.from(group.farmers).join(', '),
        entry_dates: Array.from(group.entry_dates).join(', '),
        conditions: Array.from(group.conditions).join(', '),
        average_temperature: group.temperatures.length > 0 
          ? (group.temperatures.reduce((sum: number, temp: number) => sum + temp, 0) / group.temperatures.length).toFixed(1)
          : null,
        processing_count: group.processing_records.length
      }));

      // Sort by size, then by storage location
      groupedData.sort((a, b) => {
        if (a.final_size !== b.final_size) {
          return a.final_size - b.final_size;
        }
        return a.storage_location.localeCompare(b.storage_location);
      });
      
      setInventory(groupedData);
    } catch (err) {
      console.error("Error fetching inventory:", err);
      toast.error('Failed to fetch inventory data', {
        description: 'Please refresh the page or try again later',
        duration: 5000,
      });
      setInventory([]);
    }
  };

  // Fetch data from database
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Try to fetch data, but handle missing tables gracefully
      const [ordersData, outletsData] = await Promise.allSettled([
        orderService.getOutletOrders(),
        outletService.getOutlets()
      ]);
      
      // Set data if successful, otherwise use empty arrays
      setOutletOrders(ordersData.status === 'fulfilled' ? ordersData.value : []);
      setOutlets(outletsData.status === 'fulfilled' ? outletsData.value : []);
      
      // Fetch inventory data
      await fetchInventory();
      
      // Log warnings for failed requests
      if (ordersData.status === 'rejected') {
        console.warn('Outlet orders table not available yet:', ordersData.reason);
      }
      if (outletsData.status === 'rejected') {
        console.warn('Outlets table not available yet:', outletsData.reason);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load order data', {
        description: 'Please refresh the page or check your connection',
        duration: 5000,
      });
      setOutletOrders([]);
      setOutlets([]);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  
  // ==================== UI HELPER FUNCTIONS ====================
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-500 text-white';
      case 'confirmed': return 'bg-blue-500 text-white';
      case 'dispatched': return 'bg-emerald-500 text-white';
      case 'completed': return 'bg-green-600 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'confirmed': return <CheckCircle className="h-4 w-4" />;
      case 'dispatched': return <CheckCircle className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const formatKES = (amount: number) => {
    return `KES ${amount.toLocaleString()}`;
  };

  const formatSizeRange = (sizes: number[]) => {
    if (sizes.length === 0) return 'No sizes selected';
    const sortedSizes = sizes.sort((a, b) => a - b);
    if (sortedSizes.length === 1) return `Size ${sortedSizes[0]}`;
    return `Sizes ${sortedSizes[0]}-${sortedSizes[sortedSizes.length - 1]}`;
  };

  // ==================== FORM HANDLING FUNCTIONS ====================

  const handleSizeToggle = (size: number) => {
    setFormData(prev => ({
      ...prev,
      requested_sizes: prev.requested_sizes.includes(size) 
        ? prev.requested_sizes.filter(s => s !== size)
        : [...prev.requested_sizes, size].sort((a, b) => a - b),
      // Clear selected grade when sizes change to ensure it's still valid
      requested_grade: ''
    }));
  };

  const checkInventoryAvailability = () => {
    if (formData.requested_sizes.length === 0 || !formData.requested_quantity) {
      return { available: true, message: '' };
    }

    const requestedQuantity = parseFloat(formData.requested_quantity);
    const availableInventory = inventory.filter(item => 
      formData.requested_sizes.includes(item.final_size || 0) && 
      item.ready_for_dispatch_count > 0
    );

    const totalAvailable = availableInventory.reduce((sum, item) => sum + (item.total_weight || 0), 0);

    // Debug logging to help understand the calculation
    if (process.env.NODE_ENV === 'development') {
      console.log('checkInventoryAvailability - Debug Info:');
      console.log('- Requested quantity:', requestedQuantity);
      console.log('- Available inventory items:', availableInventory);
      console.log('- Total available weight:', totalAvailable);
      console.log('- Size details:', sizeDetails);
    }

    if (totalAvailable < requestedQuantity) {
      return {
        available: false,
        message: `Only ${totalAvailable}kg available for selected sizes. Requested: ${requestedQuantity}kg`
      };
    }

    return { available: true, message: `${totalAvailable}kg available for selected sizes` };
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};

    if (!formData.outlet_id) {
      errors.outlet_id = 'Please select an outlet';
    }

    if (formData.use_any_size) {
      // For "any size" option, validate total quantity
    if (!formData.requested_quantity || parseFloat(formData.requested_quantity) <= 0) {
        errors.requested_quantity = 'Please enter a valid total quantity (greater than 0)';
      }
    } else {
      // For specific sizes, validate that sizes are selected and quantities are specified
      if (formData.requested_sizes.length === 0) {
        errors.requested_sizes = 'Please select at least one fish size';
      } else {
        // Check if quantities are specified for selected sizes
        const totalQuantity = Object.values(formData.size_quantities).reduce((sum: number, qty: unknown) => sum + (qty as number), 0);
        if (totalQuantity <= 0) {
          errors.requested_sizes = 'Please specify quantities for selected sizes';
        }
        
        // Check if any quantity exceeds available stock
        for (const size of formData.requested_sizes) {
          const requestedKg = formData.size_quantities[size] || 0;
          const details = sizeDetails[size];
          const availableKg = details ? details.totalWeight : 0;
          
          if (requestedKg > availableKg) {
            errors.requested_sizes = `Size ${size}: Requested ${requestedKg}kg exceeds available ${availableKg.toFixed(1)}kg`;
            break;
          }
        }
      }
    }

    if (!formData.price_per_kg || parseFloat(formData.price_per_kg) <= 0) {
      errors.price_per_kg = 'Please enter a valid price per kg (greater than 0)';
    }

    if (!formData.requested_grade) {
      errors.requested_grade = 'Please select a grade preference';
    }

    if (formData.delivery_date && new Date(formData.delivery_date) < new Date()) {
      errors.delivery_date = 'Delivery date cannot be in the past';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const generateOrderNumber = async (): Promise<string> => {
    try {
      // Get the latest order to determine the next ID
      const { data: latestOrder, error } = await supabase
        .from('outlet_orders')
        .select('order_number')
        .not('order_number', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (latestOrder && latestOrder.length > 0) {
        // Extract number from existing order number (e.g., "INV001" -> 1)
        const existingOrderNumber = latestOrder[0].order_number;
        const match = existingOrderNumber?.match(/INV(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      // Format as INV001, INV002, etc.
      return `INV${nextNumber.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating order number:', error);
      // Fallback to timestamp-based ID
      return `INV${Date.now().toString().slice(-6)}`;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate organized order number
      const orderNumber = await generateOrderNumber();

      // Calculate total quantity and value based on order type
      let totalQuantity: number;
      let requestedSizes: number[];
      
      if (formData.use_any_size) {
        // For "any size" orders
        totalQuantity = parseFloat(formData.requested_quantity);
        requestedSizes = []; // Will be determined by system
      } else {
        // For specific size orders
        totalQuantity = Object.values(formData.size_quantities).reduce((sum: number, qty: unknown) => sum + (qty as number), 0);
        requestedSizes = formData.requested_sizes;
      }

      const totalValue = totalQuantity * parseFloat(formData.price_per_kg);

      const orderData = {
        outlet_id: formData.outlet_id,
        order_date: new Date().toISOString().split('T')[0],
        delivery_date: formData.delivery_date || null,
        requested_sizes: requestedSizes,
        requested_quantity: totalQuantity,
        requested_grade: formData.requested_grade === 'any' ? null : formData.requested_grade as 'A' | 'B' | 'C',
        price_per_kg: parseFloat(formData.price_per_kg),
        total_value: totalValue,
        status: 'pending' as const,
        notes: formData.notes,
        order_number: orderNumber,
        // Add size quantities for specific size orders
        size_quantities: formData.use_any_size ? {} : formData.size_quantities,
        use_any_size: formData.use_any_size
      };

      console.log('Creating order with data:', orderData);
      const newOrder = await orderService.createOutletOrder(orderData);
      setOutletOrders([newOrder, ...outletOrders]);
      
      // Reset form
      setFormData({
        outlet_id: '',
        requested_quantity: '',
        requested_grade: '',
        price_per_kg: '',
        requested_sizes: [],
        size_quantities: {},
        use_any_size: false,
        delivery_date: '',
        notes: ''
      });
      setFormErrors({});
      setIsNewOrderOpen(false);
      
      // Show success message with organized ID
      toast.success(`Order ${orderNumber} created successfully!`, {
        description: `Order Number: ${orderNumber}`,
        duration: 5000,
      });
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error(`Failed to create order`, {
        description: error.message || 'Unknown error occurred',
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmOrder = (orderId: string) => {
    const order = outletOrders.find(o => o.id === orderId);
    if (order) {
      setOrderToConfirm(order);
      setShowConfirmationDialog(true);
      // Reset confirmation form with current user
      setConfirmationData({
        confirmedBy: user?.email || 'Current User',
        notes: '',
        action: 'approve'
      });
    }
  };

  const handleConfirmationSubmit = async () => {
    if (!orderToConfirm) {
      toast.error('No order selected for confirmation');
      return;
    }

    setIsConfirming(true);
    try {
      if (confirmationData.action === 'approve') {
        // Approve the order
        const { error } = await supabase
          .from('outlet_orders')
          .update({ 
            status: 'confirmed',
            confirmed_date: new Date().toISOString().split('T')[0],
            notes: confirmationData.notes || orderToConfirm.notes
          })
          .eq('id', orderToConfirm.id);

        if (error) throw error;

        // Log audit event for order confirmation
        await logAuditEvent('UPDATE', 'outlet_orders', orderToConfirm.id, 
          { status: orderToConfirm.status }, 
          { status: 'confirmed', confirmed_date: new Date().toISOString().split('T')[0] }
        );

        // Deduct inventory immediately when order is confirmed
        await deductInventoryOnOrderConfirmation(orderToConfirm);

        // Update storage capacity after inventory deduction
        await updateStorageCapacityAfterOrder();

        // Automatically create dispatch record with correct values
        await createAutomaticDispatchRecord(orderToConfirm);

        // Update local state
        setOutletOrders(prev => prev.map(order => 
          order.id === orderToConfirm.id 
            ? { ...order, status: 'confirmed', confirmedDate: new Date().toISOString().split('T')[0] }
            : order
        ));

        toast.success(`Order ${orderToConfirm.order_number || orderToConfirm.id} approved, confirmed, and moved to dispatch!`);
      } else {
        // Discard the order
        const { error } = await supabase
          .from('outlet_orders')
          .update({ 
            status: 'cancelled',
            notes: `Order discarded by ${user?.email || 'Current User'}. ${confirmationData.notes || ''}`.trim()
          })
          .eq('id', orderToConfirm.id);

        if (error) throw error;

        // Log audit event for order cancellation
        await logAuditEvent('UPDATE', 'outlet_orders', orderToConfirm.id, 
          { status: orderToConfirm.status }, 
          { status: 'cancelled', notes: `Order discarded by ${user?.email || 'Current User'}. ${confirmationData.notes || ''}`.trim() }
        );

        // Update local state
        setOutletOrders(prev => prev.map(order => 
          order.id === orderToConfirm.id 
            ? { ...order, status: 'cancelled' }
            : order
        ));

        toast.success(`Order ${orderToConfirm.order_number || orderToConfirm.id} has been discarded.`);
      }

      setShowConfirmationDialog(false);
      setOrderToConfirm(null);
    } catch (error) {
      console.error('Error processing order confirmation:', error);
      toast.error('Failed to process order confirmation', {
        description: 'Please try again or contact support if the issue persists',
        duration: 5000,
      });
    } finally {
      setIsConfirming(false);
    }
  };

  // Helper function to check if a string is a valid UUID
  const isValidUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Deduct inventory when order is confirmed
  const deductInventoryOnOrderConfirmation = async (order: OutletOrder) => {
    try {
      // Get available inventory for the order - join with sorting_batches to get status
      const { data: availableInventory, error: inventoryError } = await supabase
        .from('sorting_results')
        .select(`
          *,
          sorting_batch:sorting_batches!inner(
            id,
            status
          )
        `)
        .eq('sorting_batch.status', 'completed')
        .gt('total_weight_grams', 0);

      if (inventoryError) throw inventoryError;

      if (!availableInventory || availableInventory.length === 0) {
        throw new Error('No available inventory found for order confirmation');
      }

      // Calculate total weight needed
      const totalWeightNeeded = order.requested_quantity || 0;
      let remainingWeight = totalWeightNeeded;
      const inventoryUpdates: any[] = [];

      // Deduct inventory by size if size_quantities is specified
      if (order.size_quantities && Object.keys(order.size_quantities).length > 0) {
        for (const [size, weightNeeded] of Object.entries(order.size_quantities)) {
          const sizeNum = parseInt(size);
          const weightToDeduct = weightNeeded as number;
          
          // Find available inventory for this size
          const availableForSize = availableInventory.filter(item => 
            item.size_class === sizeNum && item.total_weight_grams > 0
          );

          let remainingForSize = weightToDeduct;
          for (const item of availableForSize) {
            if (remainingForSize <= 0) break;

            const deductAmount = Math.min(remainingForSize, item.total_weight_grams / 1000); // Convert grams to kg
            
            // Update inventory
            const { error: updateError } = await supabase
              .from('sorting_results')
              .update({ 
                total_weight_grams: item.total_weight_grams - (deductAmount * 1000), // Convert kg to grams
                total_pieces: Math.max(0, item.total_pieces - Math.ceil(deductAmount))
              })
              .eq('id', item.id);

            if (updateError) throw updateError;

            // Create inventory entry (if inventory_entries table exists)
            try {
              const { error: entryError } = await supabase
                .from('inventory_entries')
                .insert({
                  size: sizeNum,
                  quantity_change: -Math.ceil(deductAmount), // Negative for outbound
                  entry_type: 'order_dispatch',
                  reference_id: order.id,
                  notes: `Order dispatch - Size ${sizeNum}, Weight: ${deductAmount.toFixed(2)}kg`
                });

              if (entryError) {
                console.warn('Could not create inventory entry:', entryError);
                // Don't throw error, just log it as inventory_entries table might not exist
              }
            } catch (entryError) {
              console.warn('Inventory entries table might not exist:', entryError);
            }

            inventoryUpdates.push({
              size: sizeNum,
              weight_deducted: deductAmount,
              remaining_stock: (item.total_weight_grams - (deductAmount * 1000)) / 1000 // Convert back to kg
            });

            remainingForSize -= deductAmount;
          }
        }
      } else {
        // If no specific sizes, deduct from any available inventory
        for (const item of availableInventory) {
          if (remainingWeight <= 0) break;

          const deductAmount = Math.min(remainingWeight, item.total_weight_grams / 1000); // Convert grams to kg
          
          // Update inventory
          const { error: updateError } = await supabase
            .from('sorting_results')
            .update({ 
              total_weight_grams: item.total_weight_grams - (deductAmount * 1000), // Convert kg to grams
              total_pieces: Math.max(0, item.total_pieces - Math.ceil(deductAmount))
            })
            .eq('id', item.id);

          if (updateError) throw updateError;

          // Create inventory entry (if inventory_entries table exists)
          try {
            const { error: entryError } = await supabase
              .from('inventory_entries')
              .insert({
                size: item.size_class || 0,
                quantity_change: -Math.ceil(deductAmount), // Negative for outbound
                entry_type: 'order_dispatch',
                reference_id: order.id,
                notes: `Order dispatch - Size ${item.size_class || 0}, Weight: ${deductAmount.toFixed(2)}kg`
              });

            if (entryError) {
              console.warn('Could not create inventory entry:', entryError);
              // Don't throw error, just log it as inventory_entries table might not exist
            }
          } catch (entryError) {
            console.warn('Inventory entries table might not exist:', entryError);
          }

          inventoryUpdates.push({
            size: item.size_class || 0,
            weight_deducted: deductAmount,
            remaining_stock: (item.total_weight_grams - (deductAmount * 1000)) / 1000 // Convert back to kg
          });

          remainingWeight -= deductAmount;
        }
      }

      console.log('Inventory deducted for order confirmation:', inventoryUpdates);
      return inventoryUpdates;
    } catch (error) {
      console.error('Error deducting inventory on order confirmation:', error);
      throw error;
    }
  };

  // Update storage capacity after order confirmation
  const updateStorageCapacityAfterOrder = async () => {
    try {
      console.log('🔄 Updating storage capacity after order confirmation...');
      
      // Call the database function to update storage capacity
      const { error } = await supabase.rpc('update_storage_capacity_from_inventory');
      
      if (error) {
        console.warn('⚠️ Could not update storage capacity:', error);
        // Don't throw error, just log it as this is not critical for order processing
      } else {
        console.log('✅ Storage capacity updated successfully');
      }
    } catch (error) {
      console.warn('⚠️ Error updating storage capacity:', error);
      // Don't throw error, just log it as this is not critical for order processing
    }
  };

  // Create automatic dispatch record when order is confirmed
  const createAutomaticDispatchRecord = async (order: OutletOrder) => {
    try {
      const outlet = outlets.find(o => o.id === order.outlet_id);
      const outletName = outlet?.name || 'Unknown Outlet';
      
      // Use the data directly from the outlet order - it's already calculated correctly
      const expectedWeight = order.requested_quantity || 0;
      const expectedPieces = order.requested_quantity || 0; // For now, use same as weight (1 piece per kg)
      const sizeBreakdown = order.size_quantities || {};
      
      // Create dispatch record with actual order values
      const { data: dispatchData, error: dispatchError } = await supabase
        .from("dispatch_records")
        .insert({
          outlet_order_id: order.id,
          fish_ids: [], // Will be populated when inventory is picked
          destination: outletName,
          dispatch_date: new Date().toISOString().split('T')[0],
          total_weight: expectedWeight,
          total_pieces: expectedPieces,
          size_breakdown: sizeBreakdown,
          total_value: order.total_value || 0,
          status: 'scheduled',
          notes: `Auto-created dispatch for confirmed order ${order.order_number || order.id}`,
          dispatched_by: user?.id || null
        })
        .select()
        .single();

      if (dispatchError) {
        console.error('Error creating dispatch record:', dispatchError);
        throw dispatchError;
      }

      console.log('Automatic dispatch record created:', dispatchData);
      return dispatchData;
    } catch (error) {
      console.error('Failed to create automatic dispatch record:', error);
      // Don't throw error - we don't want to fail the order confirmation if dispatch creation fails
      toast.warning('Order confirmed but dispatch record creation failed. Please create dispatch manually.');
    }
  };

  // Removed updateInventoryOnOrderApproval - dispatch should not be done from processing records

  // ==================== DISPATCH FUNCTIONS ====================
  
  // Open inventory picker for dispatch (redefined to avoid conflict)
  const openInventoryPickerForDispatch = (orderId: string) => {
    setCurrentOrderId(orderId);
    setPickedItems([]);
    setShowInventoryPicker(true);
  };

  // Handle inventory picking for dispatch
  const handleInventoryPick = async () => {
    if (!currentOrderId || pickedItems.length === 0) {
      toast.error('Please select items from inventory');
      return;
    }

    try {
      // Update processing records to mark as dispatched
      const inventoryIds = pickedItems.map(item => item.inventoryItem.id);
      const { error: updateError } = await supabase
        .from("processing_records")
        .update({ ready_for_dispatch_count: 0 })
        .in("id", inventoryIds);

      if (updateError) throw updateError;

      // Create dispatch record with actual picked values
      const totalWeight = pickedItems.reduce((sum, item) => sum + item.weight, 0);
      const totalPieces = pickedItems.reduce((sum, item) => sum + item.quantity, 0);
      const sizeBreakdown = pickedItems.reduce((acc, item) => {
        const size = item.inventoryItem.final_size || 0;
        acc[size] = (acc[size] || 0) + item.quantity;
        return acc;
      }, {} as Record<number, number>);

      const order = outletOrders.find(o => o.id === currentOrderId);
      const outlet = outlets.find(o => o.id === order?.outlet_id);

      const { data: dispatchData, error: dispatchError } = await supabase
        .from("dispatch_records")
        .insert({
          outlet_order_id: currentOrderId,
          fish_ids: inventoryIds,
          destination: outlet?.name || 'Unknown',
          dispatch_date: new Date().toISOString().split('T')[0],
          total_weight: totalWeight,
          total_pieces: totalPieces,
          size_breakdown: sizeBreakdown,
          total_value: order?.total_value || 0,
          status: 'dispatched',
          notes: `Inventory picked for order ${order?.order_number || currentOrderId}`,
          dispatched_by: user?.id || null
        })
        .select()
        .single();

      if (dispatchError) throw dispatchError;

      // Update order status to dispatched
      const { error: orderUpdateError } = await supabase
        .from('outlet_orders')
        .update({ 
          status: 'dispatched',
          dispatch_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', currentOrderId);

      if (orderUpdateError) throw orderUpdateError;

      // Refresh data
      await fetchData();
      await fetchInventory();

      setShowInventoryPicker(false);
      setCurrentOrderId(null);
      setPickedItems([]);

      toast.success('Order dispatched successfully!', {
        description: `Order ${order?.order_number || currentOrderId} has been dispatched with ${totalPieces} pieces`,
        duration: 5000,
      });
    } catch (error) {
      console.error('Error dispatching order:', error);
      toast.error('Failed to dispatch order', {
        description: 'Please try again or contact support if the issue persists',
        duration: 5000,
      });
    }
  };

  // ==================== ORDER MANAGEMENT FUNCTIONS ====================
  
  // Filter orders based on selected filter
  const getFilteredOrders = () => {
    switch (orderFilter) {
      case 'pending':
        return outletOrders.filter(order => order.status === 'pending');
      case 'confirmed':
        return outletOrders.filter(order => order.status === 'confirmed');
      case 'cancelled':
        return outletOrders.filter(order => order.status === 'cancelled');
      case 'all':
      default:
        return outletOrders;
    }
  };

  const openOrderDetails = (orderId: string) => {
    const order = outletOrders.find(o => o.id === orderId);
    if (order) {
      setSelectedOrder(order);
      setShowOrderDetails(true);
    }
  };

  // Inventory picking functions
  const openInventoryPicker = (orderId: string) => {
    setCurrentOrderId(orderId);
    setPickedItems([]);
    setShowInventoryPicker(true);
  };

  const addToPickedItems = (inventoryItem: InventoryItem, quantity: number) => {
    const existingIndex = pickedItems.findIndex(
      item => item.inventoryItem.id === inventoryItem.id
    );
    
    if (existingIndex >= 0) {
      // Update existing item
      const updatedItems = [...pickedItems];
      updatedItems[existingIndex].quantity += quantity;
      updatedItems[existingIndex].weight = updatedItems[existingIndex].quantity * (inventoryItem.post_processing_weight / (inventoryItem.total_pieces || 1));
      setPickedItems(updatedItems);
    } else {
      // Add new item
      const weight = quantity * (inventoryItem.post_processing_weight / (inventoryItem.total_pieces || 1));
      setPickedItems(prev => [...prev, {
        inventoryItem,
        quantity,
        weight
      }]);
    }
  };

  const removeFromPickedItems = (inventoryItemId: string) => {
    setPickedItems(prev => prev.filter(item => item.inventoryItem.id !== inventoryItemId));
  };

  const updatePickedItemQuantity = (inventoryItemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromPickedItems(inventoryItemId);
      return;
    }
    
    setPickedItems(prev => prev.map(item => {
      if (item.inventoryItem.id === inventoryItemId) {
        const weight = newQuantity * (item.inventoryItem.post_processing_weight / (item.inventoryItem.total_pieces || 1));
        return { ...item, quantity: newQuantity, weight };
      }
      return item;
    }));
  };

  // Removed confirmInventoryPicking - dispatch should not be done from processing records

  // ==================== INVENTORY PICKER FUNCTIONS ====================
  
  const getFilteredInventory = (order: OutletOrder) => {
    return inventory.filter(item => {
      // Check if item has available quantity
      if (!item.total_quantity || item.total_quantity <= 0) return false;
      
      // Check if item is ready for dispatch
      if (item.ready_for_dispatch_count <= 0) return false;
      
      // Check size requirements
      if (order.requested_sizes && order.requested_sizes.length > 0) {
        if (!order.requested_sizes.includes(item.final_size || 0)) return false;
      }
      
      // Check grade requirements
      if (order.requested_grade && order.requested_grade !== 'any') {
        if (item.final_grade !== order.requested_grade) return false;
      }
      
      return true;
    });
  };

  // ==================== COMPUTED VALUES ====================

  const stats = {
    totalOrders: outletOrders.length,
    pendingOrders: outletOrders.filter(o => o.status === 'pending').length,
    confirmedOrders: outletOrders.filter(o => o.status === 'confirmed').length,
    totalValue: outletOrders.reduce((sum, order) => sum + order.total_value, 0),
    totalQuantity: outletOrders.reduce((sum, order) => sum + (order.requested_quantity || 0), 0)
  };

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 content-container responsive-padding">
      {/* Marquee */}
      <FishFarmMarquee />
      
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header with Marquee */}
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-3">
              <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
                  <ShoppingCart className="h-10 w-10 text-white" />
                </div>
                Order Management
              </h1>
              <p className="text-xl text-gray-600 ml-16">Manage fish orders from outlets across Kenya • Size-based selection</p>
            </div>
            <Dialog open={isNewOrderOpen} onOpenChange={(open) => {
              console.log('Dialog state changing to:', open);
              setIsNewOrderOpen(open);
            }}>
              <DialogTrigger asChild>
                <Button 
                  onClick={() => {
                    console.log('New Order button clicked');
                    setIsNewOrderOpen(true);
                  }}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-2xl font-semibold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
                >
                  <PlusCircle className="h-6 w-6 mr-3" />
                  New Order
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="pb-4">
                  <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                      <PlusCircle className="h-5 w-5 text-white" />
                    </div>
                    Create New Order
                  </DialogTitle>
                  <DialogDescription className="text-gray-600">
                    Create a new order for your outlet with real-time inventory validation
                  </DialogDescription>
                  <div className="flex items-center gap-2 mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <Clock className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-700 font-medium">
                      FIFO System Active: Orders will automatically use oldest batches first
                    </span>
                  </div>
                </DialogHeader>
                <div className="space-y-6">

                  {/* Outlet Selection */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold text-gray-700">Select Outlet *</Label>
                    <Select value={formData.outlet_id} onValueChange={(value) => {
                          setFormData({...formData, outlet_id: value, requested_sizes: []});
                      if (formErrors.outlet_id) {
                        setFormErrors({...formErrors, outlet_id: ''});
                      }
                          fetchAvailableSizes(value);
                    }}>
                      <SelectTrigger className={`h-12 ${formErrors.outlet_id ? 'border-red-500' : 'border-gray-300'}`}>
                        <SelectValue placeholder="Choose an outlet..." />
                      </SelectTrigger>
                      <SelectContent>
                        {outlets.map((outlet) => (
                          <SelectItem key={outlet.id} value={outlet.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{outlet.name}</span>
                              <span className="text-sm text-gray-500">{outlet.location}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.outlet_id && (
                      <div className="flex items-center gap-2 text-red-600 text-sm">
                            <AlertTriangle className="h-4 w-4" />
                        <span>{formErrors.outlet_id}</span>
                          </div>
                    )}
                  </div>
                  
                  {/* Fish Sizes Selection */}
                  {formData.outlet_id && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold text-gray-700">Select Fish Sizes *</Label>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="any-size"
                            checked={formData.use_any_size}
                            onCheckedChange={handleAnySizeToggle}
                            className="h-4 w-4"
                          />
                          <label htmlFor="any-size" className="text-sm text-gray-600 cursor-pointer">
                            Use any available size
                          </label>
                        </div>
                        </div>

                      {!formData.use_any_size ? (
                        <>
                        {loadingSizes ? (
                            <div className="p-6 text-center border border-gray-200 rounded-lg bg-gray-50">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                              <p className="text-gray-600 text-sm">Loading available sizes...</p>
                          </div>
                        ) : (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-60 overflow-y-auto p-3 border border-gray-200 rounded-lg bg-gray-50">
                          {fishSizes
                            .filter(fishSize => availableSizes.includes(fishSize.size))
                            .map((fishSize) => {
                              const details = sizeDetails[fishSize.size];
                              return (
                                      <div key={fishSize.size} className={`p-3 rounded-lg border-2 transition-all ${
                                  formData.requested_sizes.includes(fishSize.size)
                                          ? 'border-blue-500 bg-blue-50'
                                          : 'border-gray-200 bg-white hover:border-blue-300'
                                }`}>
                                        <div className="flex items-center gap-2 mb-2">
                          <Checkbox
                            id={`size-${fishSize.size}`}
                            checked={formData.requested_sizes.includes(fishSize.size)}
                            onCheckedChange={() => handleSizeToggle(fishSize.size)}
                                        className="h-4 w-4"
                          />
                                          <label htmlFor={`size-${fishSize.size}`} className="cursor-pointer text-sm font-medium">
                                            Size {fishSize.size}
                            </label>
                          </div>
                                    {details && (
                                          <div className="text-xs text-gray-600 pl-6 mb-2">
                                            <div>{details.quantity} pcs</div>
                                            <div>{details.totalWeight ? details.totalWeight.toFixed(1) : '0.0'} kg</div>
                                      </div>
                                    )}
                                </div>
                              );
                            })}
                            {availableSizes.length === 0 && (
                                  <div className="col-span-full text-center py-4 text-gray-500">
                                    <Package className="h-6 w-6 mx-auto mb-1 text-gray-300" />
                                <p className="text-sm">No sizes available</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                    {formData.requested_sizes.length > 0 && (
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <p className="text-sm font-medium text-blue-800 mb-3">
                          Selected: {formatSizeRange(formData.requested_sizes)} ({formData.requested_sizes.length} size{formData.requested_sizes.length !== 1 ? 's' : ''})
                        </p>
                              <div className="space-y-3">
                                <p className="text-xs text-blue-700 font-medium">Specify quantity (kg) for each size:</p>
                            {formData.requested_sizes.map(size => {
                              const details = sizeDetails[size];
                                  const availableKg = details ? details.totalWeight : 0;
                                  const requestedKg = formData.size_quantities[size] || 0;
                                  return (
                                    <div key={size} className="bg-white p-3 rounded-lg border border-blue-100">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-blue-700">Size {size}</span>
                                        <span className="text-xs text-gray-500">
                                          Available: {availableKg.toFixed(1)} kg
                                        </span>
                                </div>
                                      <div className="flex items-center gap-2">
                                        <Input
                                          type="number"
                                          placeholder="0.0"
                                          min="0.1"
                                          max={availableKg}
                                          step="0.1"
                                          className="h-8 text-sm flex-1"
                                          value={requestedKg || ''}
                                          onChange={(e) => handleSizeQuantityChange(size, parseFloat(e.target.value) || 0)}
                                        />
                                        <span className="text-xs text-gray-500">kg</span>
                              </div>
                                      {requestedKg > availableKg && (
                                        <div className="flex items-center gap-1 text-red-600 text-xs mt-1">
                                          <AlertTriangle className="h-3 w-3" />
                                          <span>Exceeds available stock</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                <div className="pt-2 border-t border-blue-200">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium text-blue-800">Total Requested:</span>
                                    <span className="font-bold text-blue-600">
                                      {Object.values(formData.size_quantities).reduce((sum: number, qty: unknown) => sum + (qty as number), 0).toFixed(1)} kg
                                    </span>
                          </div>
                      </div>
                              </div>
                        </div>
                    )}
                        </>
                      ) : (
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800">Any Size Selected</span>
                          </div>
                          <p className="text-xs text-green-700">
                            The system will automatically select the best available sizes based on inventory and your total quantity requirement.
                              </p>
                            </div>
                      )}
                      
                      {formErrors.requested_sizes && (
                        <div className="flex items-center gap-2 text-red-600 text-sm">
                          <AlertTriangle className="h-4 w-4" />
                          <span>{formErrors.requested_sizes}</span>
                          </div>
                    )}
                  </div>
                  )}
                  
                  {/* Order Details */}
                  {(formData.requested_sizes.length > 0 || formData.use_any_size) && (
                    <div className="space-y-4">
                      {formData.use_any_size ? (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-gray-700">Total Quantity (kg) *</Label>
                      <Input 
                        type="number" 
                        placeholder="100" 
                        min="1"
                        step="0.1"
                            className={`h-10 ${formErrors.requested_quantity ? 'border-red-500' : 'border-gray-300'}`}
                        value={formData.requested_quantity}
                        onChange={(e) => {
                          setFormData({...formData, requested_quantity: e.target.value});
                          if (formErrors.requested_quantity) {
                            setFormErrors({...formErrors, requested_quantity: ''});
                          }
                        }}
                      />
                      {formErrors.requested_quantity && (
                            <div className="flex items-center gap-2 text-red-600 text-sm">
                              <AlertTriangle className="h-3 w-3" />
                              <span>{formErrors.requested_quantity}</span>
                            </div>
                      )}
                    </div>
                      ) : (
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Total Quantity:</span>
                            <span className="text-lg font-bold text-gray-900">
                              {Object.values(formData.size_quantities).reduce((sum: number, qty: unknown) => sum + (qty as number), 0).toFixed(1)} kg
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Calculated from individual size quantities above
                          </p>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Price per kg (KES) *</Label>
                      <Input 
                        type="number" 
                        placeholder="500" 
                        min="1"
                        step="0.01"
                          className={`h-10 ${formErrors.price_per_kg ? 'border-red-500' : 'border-gray-300'}`}
                        value={formData.price_per_kg}
                        onChange={(e) => {
                          setFormData({...formData, price_per_kg: e.target.value});
                          if (formErrors.price_per_kg) {
                            setFormErrors({...formErrors, price_per_kg: ''});
                          }
                        }}
                      />
                      {formErrors.price_per_kg && (
                          <div className="flex items-center gap-2 text-red-600 text-sm">
                            <AlertTriangle className="h-3 w-3" />
                            <span>{formErrors.price_per_kg}</span>
                            </div>
                      )}
                  </div>
                    </div>
                  )}

                  {/* Grade Selection */}
                  {(formData.requested_sizes.length > 0 || formData.use_any_size) && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Grade Preference</Label>
                      <Select
                        value={formData.requested_grade}
                        onValueChange={(value) => {
                          setFormData({...formData, requested_grade: value});
                          if (formErrors.requested_grade) {
                            setFormErrors({...formErrors, requested_grade: ''});
                          }
                        }}
                      >
                        <SelectTrigger className={`h-10 ${formErrors.requested_grade ? 'border-red-500' : 'border-gray-300'}`}>
                          <SelectValue placeholder="Select grade preference" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any Grade Available</SelectItem>
                          <SelectItem value="A">Grade A (Premium)</SelectItem>
                          <SelectItem value="B">Grade B (Standard)</SelectItem>
                          <SelectItem value="C">Grade C (Economy)</SelectItem>
                        </SelectContent>
                      </Select>
                      {formErrors.requested_grade && (
                        <div className="flex items-center gap-2 text-red-600 text-sm">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{formErrors.requested_grade}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Delivery Date */}
                  {formData.requested_sizes.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Delivery Date</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input 
                        type="date" 
                          className={`h-10 pl-10 ${formErrors.delivery_date ? 'border-red-500' : 'border-gray-300'}`}
                        value={formData.delivery_date}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => {
                          setFormData({...formData, delivery_date: e.target.value});
                          if (formErrors.delivery_date) {
                            setFormErrors({...formErrors, delivery_date: ''});
                          }
                        }}
                      />
                      </div>
                      {formErrors.delivery_date && (
                        <div className="flex items-center gap-2 text-red-600 text-sm">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{formErrors.delivery_date}</span>
                            </div>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {formData.requested_sizes.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Notes (Optional)</Label>
                    <Textarea 
                        placeholder="Special requirements, delivery instructions, etc..." 
                        className="h-20 border-gray-300 resize-none"
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    />
                    </div>
                  )}

                  {/* Inventory Error Display */}
                  {formErrors.inventory && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        <p className="text-red-800 font-medium">Inventory Insufficient</p>
                      </div>
                      <p className="text-red-700 text-sm mt-1">{formErrors.inventory}</p>
                    </div>
                  )}

                  {/* Order Summary */}
                  {((formData.use_any_size && formData.requested_quantity) || (!formData.use_any_size && formData.requested_sizes.length > 0)) && formData.price_per_kg && (
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200 shadow-lg">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-100 rounded-xl">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">Order Summary</h3>
                          <p className="text-sm text-gray-600">Review your order details</p>
                        </div>
                        </div>
                      <div className="grid grid-cols-3 gap-6">
                        <div className="text-center p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                          <p className="text-sm text-gray-600 mb-2">Quantity</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {formData.use_any_size 
                              ? `${formData.requested_quantity} kg`
                              : `${Object.values(formData.size_quantities).reduce((sum: number, qty: unknown) => sum + (qty as number), 0).toFixed(1)} kg`
                            }
                          </p>
                        </div>
                        <div className="text-center p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                          <p className="text-sm text-gray-600 mb-2">Price per kg</p>
                          <p className="text-2xl font-bold text-gray-900">KES {parseFloat(formData.price_per_kg || '0').toLocaleString()}</p>
                        </div>
                        <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200 shadow-sm">
                          <p className="text-sm text-gray-600 mb-2">Total Value</p>
                          <p className="text-3xl font-bold text-blue-600">
                            KES {(
                              (formData.use_any_size 
                                ? parseFloat(formData.requested_quantity || '0')
                                : Object.values(formData.size_quantities).reduce((sum: number, qty: unknown) => sum + (qty as number), 0)
                              ) * parseFloat(formData.price_per_kg || '0')
                            ).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Form Actions */}
                  <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsNewOrderOpen(false);
                        setFormErrors({});
                      }} 
                      className="px-8 py-3 text-base border-gray-300 hover:bg-gray-50"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSubmit} 
                      disabled={isSubmitting || !formData.outlet_id || (!formData.use_any_size && formData.requested_sizes.length === 0) || !formData.price_per_kg || !formData.requested_grade}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Creating Order...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Create Order
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-50 to-blue-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Total Orders</p>
                  <p className="text-4xl font-bold text-blue-900 mt-2">{stats.totalOrders}</p>
                </div>
                <div className="p-4 bg-blue-600 rounded-2xl shadow-lg">
                  <ShoppingCart className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-amber-50 to-amber-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-600 uppercase tracking-wide">Pending</p>
                  <p className="text-4xl font-bold text-amber-900 mt-2">{stats.pendingOrders}</p>
                </div>
                <div className="p-4 bg-amber-600 rounded-2xl shadow-lg">
                  <Clock className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-50 to-emerald-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wide">Confirmed</p>
                  <p className="text-4xl font-bold text-emerald-900 mt-2">{stats.confirmedOrders}</p>
                </div>
                <div className="p-4 bg-emerald-600 rounded-2xl shadow-lg">
                  <CheckCircle className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-purple-50 to-purple-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-purple-600 uppercase tracking-wide">Total Quantity</p>
                  <p className="text-4xl font-bold text-purple-900 mt-2">{stats.totalQuantity}</p>
                  <p className="text-sm text-purple-600">kg</p>
                </div>
                <div className="p-4 bg-purple-600 rounded-2xl shadow-lg">
                  <Fish className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-green-50 to-green-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-green-600 uppercase tracking-wide">Total Value</p>
                  <p className="text-3xl font-bold text-green-900 mt-2">{formatKES(stats.totalValue)}</p>
                </div>
                <div className="p-4 bg-green-600 rounded-2xl shadow-lg">
                  <Star className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Orders List */}
        <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-3xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Ruler className="h-8 w-8 text-purple-600" />
                Orders Management
              </CardTitle>
              
              {/* Filter Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={orderFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOrderFilter('all')}
                  className={`flex items-center gap-2 ${
                    orderFilter === 'all' 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                  }`}
                >
                  <Package className="h-4 w-4" />
                  All Orders ({outletOrders.length})
                </Button>
                <Button
                  variant={orderFilter === 'pending' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOrderFilter('pending')}
                  className={`flex items-center gap-2 ${
                    orderFilter === 'pending' 
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                      : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  Pending ({outletOrders.filter(o => o.status === 'pending').length})
                </Button>
                <Button
                  variant={orderFilter === 'confirmed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOrderFilter('confirmed')}
                  className={`flex items-center gap-2 ${
                    orderFilter === 'confirmed' 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                  }`}
                >
                  <Check className="h-4 w-4" />
                  Approved ({outletOrders.filter(o => o.status === 'confirmed').length})
                </Button>
                <Button
                  variant={orderFilter === 'cancelled' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOrderFilter('cancelled')}
                  className={`flex items-center gap-2 ${
                    orderFilter === 'cancelled' 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                  }`}
                >
                  <Ban className="h-4 w-4" />
                  Discarded ({outletOrders.filter(o => o.status === 'cancelled').length})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            {getFilteredOrders().length === 0 ? (
              <div className="text-center py-12">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-gray-100 rounded-full">
                    <Package className="h-8 w-8 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No {orderFilter === 'all' ? '' : orderFilter} orders found
                    </h3>
                    <p className="text-gray-500">
                      {orderFilter === 'all' 
                        ? 'No orders have been created yet.' 
                        : `No ${orderFilter} orders at the moment.`
                      }
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {getFilteredOrders().map((order) => (
                <div key={order.id} className={`border-2 rounded-3xl p-8 hover:shadow-xl transition-all duration-300 ${
                  order.status === 'dispatched' 
                    ? 'border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100' 
                    : 'border-gray-100 bg-gradient-to-r from-white to-gray-50 hover:from-blue-50 hover:to-purple-50'
                }`}>
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(order.status)}
                          <span className="text-lg font-bold text-gray-900">Order #{order.order_number || order.id}</span>
                          {order.status === 'dispatched' && (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-xs font-medium">Dispatched</span>
                            </div>
                          )}
                        </div>
                        <Badge className={`text-sm font-semibold px-4 py-2 rounded-xl ${getStatusColor(order.status)}`}>
                          {order.status.toUpperCase()}
                        </Badge>
                        {order.requested_grade !== 'any' && (
                          <Badge variant="secondary" className="text-sm px-3 py-1 bg-indigo-100 text-indigo-700 rounded-xl">
                            Grade {order.requested_grade}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-sm px-3 py-1 bg-orange-100 text-orange-700 border-orange-200 rounded-xl">
                          {formatSizeRange(order.requested_sizes || [])}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="flex items-center gap-3 text-gray-700">
                          <MapPin className="h-5 w-5 text-blue-500" />
                          <div>
                            <div className="font-semibold text-gray-900">{order.outlet?.name || 'Unknown Outlet'}</div>
                            <div className="text-sm text-gray-500">{order.outlet?.location || 'Unknown Location'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-gray-700">
                          <Phone className="h-5 w-5 text-green-500" />
                          <span className="text-sm font-medium">{order.outlet?.phone || 'Unknown Phone'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-700">
                          <Calendar className="h-5 w-5 text-purple-500" />
                          <span className="text-sm font-medium">{new Date(order.order_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-700">
                          <Fish className="h-5 w-5 text-cyan-500" />
                          <span className="text-sm font-medium">{order.requested_quantity}kg requested</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-6 text-base text-gray-700">
                        <span className="bg-gray-100 px-4 py-2 rounded-xl">
                          <span className="font-semibold text-gray-900">Sizes:</span> {order.requested_sizes?.join(', ') || 'Any'}
                        </span>
                        <span className="bg-gray-100 px-4 py-2 rounded-xl">
                          <span className="font-semibold text-gray-900">Quantity:</span> {order.requested_quantity}kg
                        </span>
                        <span className="bg-gray-100 px-4 py-2 rounded-xl">
                          <span className="font-semibold text-gray-900">Price:</span> {formatKES(order.price_per_kg || 0)}/kg
                        </span>
                      </div>
                      
                      {order.notes && (
                        <div className="text-base text-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-2xl border-l-4 border-blue-400">
                          <span className="font-semibold text-gray-900">Notes:</span> {order.notes}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end gap-4 min-w-fit">
                      <div className="text-right">
                        <div className="text-3xl font-bold text-gray-900">{formatKES(order.total_value)}</div>
                        <div className="text-sm text-gray-500 font-medium">Total Value</div>
                      </div>
                      
                      <div className="flex gap-2">
                        {/* View Order Details Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openOrderDetails(order.id)}
                          className="px-3 py-2 border-gray-300 hover:bg-gray-50"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        
                        {/* Status-specific actions */}
                        {order.status === 'pending' && (
                          <Button 
                            size="sm" 
                            onClick={() => handleConfirmOrder(order.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
                          >
                            Confirm
                          </Button>
                        )}
                        {order.status === 'confirmed' && (
                          <Button 
                            size="sm" 
                            onClick={() => onNavigate('dispatch', order.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Dispatch
                          </Button>
                        )}
                        {/* Vehicle assignment moved to dispatch page */}
                                    </div>
                                  </div>
                  </div>
                </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inventory Picker Dialog */}
      <Dialog open={showInventoryPicker} onOpenChange={setShowInventoryPicker}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="h-6 w-6 text-orange-600" />
              Pick Items from Inventory
            </DialogTitle>
            <DialogDescription>
              Select items from available inventory to fulfill this order. Items will be deducted from inventory automatically.
            </DialogDescription>
          </DialogHeader>
          
          {currentOrderId && (
            <div className="space-y-6 py-4">
              {/* Order Summary */}
              {(() => {
                const order = outletOrders.find(o => o.id === currentOrderId);
                if (!order) return null;
                
                return (
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-xl border border-blue-200">
                    <h3 className="font-bold text-lg text-blue-900 mb-4 flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      Order Requirements
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 font-medium">Outlet:</span>
                        <span className="text-gray-900 font-semibold">{order.outlet?.name || 'Unknown Outlet'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 font-medium">Requested Quantity:</span>
                        <span className="text-gray-900 font-semibold">{order.requested_quantity}kg</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 font-medium">Requested Sizes:</span>
                        <span className="text-gray-900 font-semibold">{order.requested_sizes?.join(', ') || 'Any'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 font-medium">Grade:</span>
                        <Badge className={order.requested_grade === 'A' ? 'bg-green-100 text-green-800' : order.requested_grade === 'B' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}>
                          Grade {order.requested_grade}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 font-medium">Price per kg:</span>
                        <span className="text-gray-900 font-semibold">{formatKES(order.price_per_kg || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 font-medium">Total Value:</span>
                        <span className="text-gray-900 font-semibold">{formatKES(order.total_value)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Available Inventory */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                  <Warehouse className="h-5 w-5 text-green-600" />
                  Available Inventory
                </h3>
                  {(() => {
                    const order = outletOrders.find(o => o.id === currentOrderId);
                    if (!order) return null;
                    const availableItems = getFilteredInventory(order);
                    const totalAvailable = availableItems.reduce((sum, item) => sum + (item.total_quantity || 0), 0);
                    return (
                      <div className="bg-green-50 px-3 py-1 rounded-full">
                        <span className="text-sm font-medium text-green-800">
                          {totalAvailable} pieces available
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <div className="grid gap-4 max-h-96 overflow-y-auto">
                  {(() => {
                    const order = outletOrders.find(o => o.id === currentOrderId);
                    if (!order) return null;
                    
                    const filteredInventory = getFilteredInventory(order);
                    
                    if (filteredInventory.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-500">
                          <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p>No inventory items match the order requirements</p>
                        </div>
                      );
                    }
                    
                    return filteredInventory.map((item) => (
                      <div key={item.id} className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-md transition-all duration-200">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <h4 className="font-semibold text-gray-900 text-lg">
                                Size {item.final_size || 'Unknown'} Fish
                              </h4>
                              <Badge className={item.final_grade === 'A' ? 'bg-green-100 text-green-800' : item.final_grade === 'B' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}>
                                Grade {item.final_grade || 'Unknown'}
                              </Badge>
                            </div>
                            
                            {/* Available Quantity and Storage Location */}
                            <div className="bg-blue-50 rounded-lg p-3 mb-3">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-blue-600" />
                                  <span className="text-sm font-medium text-blue-800">Available Quantity:</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-bold text-blue-900">
                                    {item.total_quantity || 0} pieces
                                  </span>
                                  <span className="text-sm font-medium text-gray-600">
                                    ({item.total_weight ? item.total_weight.toFixed(1) : '0.0'} kg)
                                  </span>
                                  {item.total_quantity && item.total_quantity <= 10 && (
                                    <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">
                                      Low Stock
                              </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex justify-between items-center mt-2">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-gray-600" />
                                  <span className="text-sm font-medium text-gray-700">Storage Location:</span>
                                </div>
                                <span className="text-sm font-semibold text-gray-900">
                                {item.storage_location || 'Processing Area'}
                                </span>
                              </div>
                            </div>
                            
                            {/* Additional Order Information */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="flex flex-col">
                                <span className="text-gray-500 text-xs font-medium">Processing Date</span>
                                <span className="text-gray-900 font-semibold">
                                  {item.processing_date ? new Date(item.processing_date).toLocaleDateString() : 'N/A'}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-gray-500 text-xs font-medium">Farmer</span>
                                <span className="text-gray-900 font-semibold truncate">{item.farmer_name || 'Unknown'}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 ml-4">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addToPickedItems(item, 1)}
                                className="border-blue-200 text-blue-700 hover:bg-blue-50"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <span className="text-sm font-medium min-w-[2rem] text-center">
                                {pickedItems.find(p => p.inventoryItem.id === item.id)?.quantity || 0}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const pickedItem = pickedItems.find(p => p.inventoryItem.id === item.id);
                                  if (pickedItem && pickedItem.quantity > 0) {
                                    updatePickedItemQuantity(item.id, pickedItem.quantity - 1);
                                  }
                                }}
                                className="border-blue-200 text-blue-700 hover:bg-blue-50"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Picked Items Summary */}
              {pickedItems.length > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                  <h3 className="font-bold text-lg text-green-900 mb-4 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Selected Items Summary
                  </h3>
                  <div className="space-y-3">
                    {pickedItems.map((pickedItem) => (
                      <div key={pickedItem.inventoryItem.id} className="flex justify-between items-center bg-white p-3 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">
                            Size {pickedItem.inventoryItem.final_size || 'Unknown'} - Grade {pickedItem.inventoryItem.final_grade || 'Unknown'}
                          </span>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            {pickedItem.quantity} pieces
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600">
                            {pickedItem.weight.toFixed(1)}kg
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeFromPickedItems(pickedItem.inventoryItem.id)}
                            className="border-red-200 text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center font-semibold text-green-900">
                        <span>Total:</span>
                        <span>
                          {pickedItems.reduce((sum, item) => sum + item.quantity, 0)} pieces • {' '}
                          {pickedItems.reduce((sum, item) => sum + item.weight, 0).toFixed(1)}kg
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowInventoryPicker(false);
                    setPickedItems([]);
                    setCurrentOrderId(null);
                  }}
                  className="px-6 py-2"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleInventoryPick}
                  disabled={pickedItems.length === 0}
                  className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Dispatch Order
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              Order Details - {selectedOrder?.order_number || selectedOrder?.id}
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Complete information for this outlet order
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Status & Basic Info */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(selectedOrder.status)}
                    <Badge className={`text-sm font-semibold px-4 py-2 rounded-xl ${getStatusColor(selectedOrder.status)}`}>
                      {selectedOrder.status.toUpperCase()}
                    </Badge>
                    {selectedOrder.requested_grade !== 'any' && (
                      <Badge variant="secondary" className="text-sm px-3 py-1 bg-indigo-100 text-indigo-700 rounded-xl">
                        Grade {selectedOrder.requested_grade}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">{formatKES(selectedOrder.total_value)}</div>
                    <div className="text-sm text-gray-500 font-medium">Total Value</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-gray-700">Order Date:</span>
                      <span className="text-sm text-gray-900">{new Date(selectedOrder.order_date).toLocaleDateString()}</span>
                    </div>
                    {selectedOrder.delivery_date && (
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-gray-700">Delivery Date:</span>
                        <span className="text-sm text-gray-900">{new Date(selectedOrder.delivery_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Fish className="h-4 w-4 text-cyan-600" />
                      <span className="text-sm font-medium text-gray-700">Quantity:</span>
                      <span className="text-sm text-gray-900">{selectedOrder.requested_quantity}kg</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium text-gray-700">Price per kg:</span>
                      <span className="text-sm text-gray-900">{formatKES(selectedOrder.price_per_kg || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Outlet Information */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Outlet Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Outlet Name:</span>
                      <p className="text-sm text-gray-900 font-semibold">{selectedOrder.outlet?.name || 'Unknown Outlet'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Location:</span>
                      <p className="text-sm text-gray-900">{selectedOrder.outlet?.location || 'Unknown Location'}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Phone:</span>
                      <p className="text-sm text-gray-900">{selectedOrder.outlet?.phone || 'Unknown Phone'}</p>
                    </div>
                    {selectedOrder.outlet?.manager_name && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">Manager:</span>
                        <p className="text-sm text-gray-900">{selectedOrder.outlet.manager_name}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Order Specifications */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-orange-600" />
                  Order Specifications
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Requested Sizes:</span>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedOrder.requested_sizes && selectedOrder.requested_sizes.length > 0 ? (
                          selectedOrder.requested_sizes.map((size, index) => (
                            <Badge key={index} variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                              Size {size}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-700">Any Size</Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Grade Preference:</span>
                      <p className="text-sm text-gray-900 mt-1">
                        {selectedOrder.requested_grade === 'any' ? 'Any Grade Available' : `Grade ${selectedOrder.requested_grade}`}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Quantity Breakdown:</span>
                      <div className="mt-2 bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Total Weight:</span>
                          <span className="text-sm font-semibold text-gray-900">{selectedOrder.requested_quantity}kg</span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-sm text-gray-600">Price per kg:</span>
                          <span className="text-sm font-semibold text-gray-900">{formatKES(selectedOrder.price_per_kg || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center mt-1 pt-2 border-t border-gray-200">
                          <span className="text-sm font-medium text-gray-700">Total Value:</span>
                          <span className="text-sm font-bold text-gray-900">{formatKES(selectedOrder.total_value)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-600" />
                    Order Notes
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700">{selectedOrder.notes}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => setShowOrderDetails(false)}
                  className="flex-1"
                >
                  Close
                </Button>
                {selectedOrder.status === 'pending' && (
                  <Button 
                    onClick={() => {
                      handleConfirmOrder(selectedOrder.id);
                      setShowOrderDetails(false);
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Confirm Order
                  </Button>
                )}
                {selectedOrder.status === 'confirmed' && (
                  <Button 
                    onClick={() => {
                      onNavigate('dispatch', selectedOrder.id);
                      setShowOrderDetails(false);
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Dispatch
                  </Button>
                )}
                {selectedOrder.status === 'dispatched' && (
                  <Button 
                    onClick={() => {
                      onNavigate('dispatch', selectedOrder.id);
                      setShowOrderDetails(false);
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Check Dispatch Page
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Order Confirmation Dialog */}
      <Dialog open={showConfirmationDialog} onOpenChange={setShowConfirmationDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <UserCheck className="h-6 w-6 text-blue-600" />
              </div>
              Confirm Order
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Review and confirm this order. Select who is confirming and choose to approve or discard.
            </DialogDescription>
          </DialogHeader>

          {orderToConfirm && (
            <div className="space-y-6">
              {/* Order Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Order Number:</span>
                    <span className="ml-2 font-medium">{orderToConfirm.order_number || orderToConfirm.id}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Outlet:</span>
                    <span className="ml-2 font-medium">{outlets.find(o => o.id === orderToConfirm.outlet_id)?.name || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Quantity:</span>
                    <span className="ml-2 font-medium">{orderToConfirm.requested_quantity} kg</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Value:</span>
                    <span className="ml-2 font-medium">KES {orderToConfirm.total_value.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Confirmation Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Confirmed By</Label>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <UserCheck className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user?.email || 'Current User'}</p>
                        <p className="text-sm text-gray-500">Logged in user</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Action *</Label>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="approve"
                        name="action"
                        value="approve"
                        checked={confirmationData.action === 'approve'}
                        onChange={(e) => setConfirmationData(prev => ({ ...prev, action: e.target.value as 'approve' | 'discard' }))}
                        className="h-4 w-4 text-green-600"
                      />
                      <Label htmlFor="approve" className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-4 w-4" />
                        Approve Order
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="discard"
                        name="action"
                        value="discard"
                        checked={confirmationData.action === 'discard'}
                        onChange={(e) => setConfirmationData(prev => ({ ...prev, action: e.target.value as 'approve' | 'discard' }))}
                        className="h-4 w-4 text-red-600"
                      />
                      <Label htmlFor="discard" className="flex items-center gap-2 text-red-700">
                        <Ban className="h-4 w-4" />
                        Discard Order
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Notes (Optional)</Label>
                  <Textarea
                    placeholder="Add any notes about this confirmation..."
                    className="h-20 resize-none"
                    value={confirmationData.notes}
                    onChange={(e) => setConfirmationData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <DialogFooter className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmationDialog(false)}
                  disabled={isConfirming}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmationSubmit}
                  disabled={isConfirming}
                  className={`flex-1 ${
                    confirmationData.action === 'approve' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  } text-white`}
                >
                  {isConfirming ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      {confirmationData.action === 'approve' ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve Order
                        </>
                      ) : (
                        <>
                          <Ban className="h-4 w-4 mr-2" />
                          Discard Order
                        </>
                      )}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}