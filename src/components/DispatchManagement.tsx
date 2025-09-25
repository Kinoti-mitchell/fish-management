import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { 
  Truck, Clock, Eye, Building2, MapPin, Phone, Calendar, Fish, DollarSign, Package, CheckCircle
} from "lucide-react";
import { NavigationSection, OutletOrder } from "../types";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";
import { RioFishLogo } from "./RioFishLogo";

interface DispatchManagementProps {
  onNavigate: (section: NavigationSection, itemId?: string) => void;
}

// Interface for outlet data
interface Outlet {
  id: string;
  name: string;
  location: string;
  phone: string;
  manager_name?: string;
  status: string;
}

// Interface for inventory items
interface InventoryItem {
  id: string;
  final_size: number;
  total_weight: number;
  ready_for_dispatch_count: number;
  storage_location?: string;
  farmer_name?: string;
  entry_date?: string;
  condition?: string;
  temperature?: number;
  processed_by_name?: string;
}

// Interface for picked items
interface PickedItem {
  inventoryItem: InventoryItem;
  quantity: number;
  weight: number;
}

export default function DispatchManagement({ onNavigate }: DispatchManagementProps) {
  const [confirmedOrders, setConfirmedOrders] = useState<OutletOrder[]>([]);
  const [dispatchedOrders, setDispatchedOrders] = useState<OutletOrder[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Inventory picking state
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [showInventoryPicker, setShowInventoryPicker] = useState(false);
  const [pickedItems, setPickedItems] = useState<PickedItem[]>([]);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);

  // Approval form state
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [drivers, setDrivers] = useState<{id: string, name: string}[]>([]);
  const [approvalData, setApprovalData] = useState({
    driverId: '',
    notes: '',
    pickingDate: '',
    pickingTime: ''
  });

  // Invoice details state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OutletOrder | null>(null);

  // Fetch confirmed orders ready for dispatch
  const fetchConfirmedOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('outlet_orders')
        .select(`
          *,
          outlet:outlets(
            id,
            name,
            location,
            phone,
            manager_name,
            status
          )
        `)
        .eq('status', 'confirmed')
        .order('order_date', { ascending: false });

      if (error) throw error;
      setConfirmedOrders(data || []);
    } catch (error) {
      console.error('Error fetching confirmed orders:', error);
      toast.error('Failed to fetch confirmed orders', {
        description: 'Please refresh the page or try again later',
        duration: 5000,
      });
    }
  };

  // Fetch dispatched orders
  const fetchDispatchedOrders = async () => {
    try {
      // First, try to fetch with dispatch records
      const { data, error } = await supabase
        .from('outlet_orders')
        .select(`
          *,
          outlet:outlets(
            id,
            name,
            location,
            phone,
            manager_name,
            status
          )
        `)
        .eq('status', 'dispatched')
        .order('dispatch_date', { ascending: false });

      if (error) throw error;

      // If we have data, try to fetch dispatch records separately
      if (data && data.length > 0) {
        const orderIds = data.map(order => order.id);
        
        const { data: dispatchData, error: dispatchError } = await supabase
          .from('dispatch_records')
          .select('*')
          .in('outlet_order_id', orderIds);

        if (!dispatchError && dispatchData) {
          // Merge dispatch data with orders
          const ordersWithDispatch = data.map(order => {
            const dispatchRecord = dispatchData.find(d => d.outlet_order_id === order.id);
            return {
              ...order,
              dispatch_record: dispatchRecord || null
            };
          });
          setDispatchedOrders(ordersWithDispatch);
        } else {
          // If dispatch records query fails, just use orders without dispatch data
          console.warn('Could not fetch dispatch records:', dispatchError);
          setDispatchedOrders(data);
        }
      } else {
        setDispatchedOrders([]);
      }
    } catch (error) {
      console.error('Error fetching dispatched orders:', error);
      toast.error('Failed to fetch dispatched orders', {
        description: 'Please refresh the page or try again later',
        duration: 5000,
      });
    }
  };

  // Assign driver to order
  const assignDriver = async (orderId: string, driverName: string) => {
    try {
      const { error } = await supabase
        .from('outlet_orders')
        .update({ 
          status: 'assigned',
          assigned_driver: driverName,
          assigned_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', orderId);

      if (error) throw error;

      // Refresh confirmed orders
      await fetchConfirmedOrders();
      toast.success(`Driver ${driverName} assigned to order ${orderId}`);
    } catch (error) {
      console.error('Error assigning driver:', error);
      toast.error('Failed to assign driver', {
        description: 'Please try again or contact support if the issue persists',
        duration: 5000,
      });
    }
  };

  // Fetch outlets
  const fetchOutlets = async () => {
    try {
      const { data, error } = await supabase
        .from('outlets')
        .select('*')
        .order('name');

      if (error) throw error;
      setOutlets(data || []);
    } catch (error) {
      console.error('Error fetching outlets:', error);
      toast.error('Failed to fetch outlets', {
        description: 'Please refresh the page or try again later',
        duration: 5000,
      });
    }
  };

  // Fetch drivers from database
  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('role', 'driver')
        .order('first_name');

      if (error) throw error;
      const driverList = (data || []).map(driver => ({
        id: driver.id,
        name: `${driver.first_name} ${driver.last_name}`
      }));
      setDrivers(driverList);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      toast.error('Failed to fetch drivers', {
        description: 'Please refresh the page or try again later',
        duration: 5000,
      });
    }
  };

  // Fetch inventory data
  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('processing_records')
        .select(`
          id,
          post_processing_weight,
          ready_for_dispatch_count,
          processing_date,
          final_value
        `)
        .gt("ready_for_dispatch_count", 0)
        .order("processing_date", { ascending: false });

      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Failed to fetch inventory', {
        description: 'Please refresh the page or try again later',
        duration: 5000,
      });
      setInventory([]);
    }
  };

  // Open inventory picker for an order
  const openInventoryPicker = (orderId: string) => {
    setCurrentOrderId(orderId);
    setPickedItems([]);
    setShowInventoryPicker(true);
  };

  // Open approval form
  const openApproveDispatchForm = (orderId: string) => {
    setCurrentOrderId(orderId);
    setApprovalData({ driverId: '', notes: '', pickingDate: '', pickingTime: '' });
    setShowApproveForm(true);
  };

  // Handle approval form submission
  const handleApprovalSubmit = async () => {
    if (!currentOrderId || !approvalData.driverId) {
      toast.error('Please select a driver');
      return;
    }

    if (!approvalData.pickingDate || !approvalData.pickingTime) {
      toast.error('Please select picking date and time');
      return;
    }

    try {
      // Get driver name
      const selectedDriver = drivers.find(d => d.id === approvalData.driverId);
      const driverName = selectedDriver?.name || 'Unknown Driver';

      // Get order details
      const order = confirmedOrders.find(o => o.id === currentOrderId);
      const outlet = outlets.find(o => o.id === order?.outlet_id);

      // Use the data directly from the outlet order - it's already calculated correctly
      const expectedWeight = order?.requested_quantity || 0;
      const expectedPieces = order?.requested_quantity || 0; // For now, use same as weight (1 piece per kg)
      const sizeBreakdown = order?.size_quantities || {};

      // Create dispatch record with actual order values
      const { data: dispatchData, error: dispatchError } = await supabase
        .from("dispatch_records")
        .insert({
          outlet_order_id: currentOrderId,
          fish_ids: [], // Will be filled when inventory is picked
          destination: outlet?.name || 'Unknown',
          dispatch_date: new Date().toISOString().split('T')[0],
          total_weight: expectedWeight,
          total_pieces: expectedPieces,
          size_breakdown: sizeBreakdown,
          total_value: order?.total_value || 0,
          status: 'scheduled',
          notes: approvalData.notes,
          picking_date: approvalData.pickingDate,
          picking_time: approvalData.pickingTime,
          assigned_driver: driverName,
          assigned_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (dispatchError) throw dispatchError;

      // Update order status to dispatched (moved to dispatched section)
      const { error: updateError } = await supabase
        .from('outlet_orders')
        .update({ 
          status: 'dispatched',
          dispatch_date: new Date().toISOString().split('T')[0],
          notes: approvalData.notes
        })
        .eq('id', currentOrderId);

      if (updateError) throw updateError;

      // Close form and refresh data
      setShowApproveForm(false);
      setCurrentOrderId(null);
      await Promise.all([fetchConfirmedOrders(), fetchDispatchedOrders()]);

      toast.success('Dispatch approved successfully!', {
        description: `Driver ${driverName} assigned to order for picking on ${approvalData.pickingDate} at ${approvalData.pickingTime}`,
        duration: 5000,
      });
    } catch (error) {
      console.error('Error approving dispatch:', error);
      toast.error('Failed to approve dispatch', {
        description: 'Please try again or contact support if the issue persists',
        duration: 5000,
      });
    }
  };

  // Open invoice details modal
  const openInvoiceModal = (order: OutletOrder) => {
    setSelectedOrder(order);
    setShowInvoiceModal(true);
  };

  // Close invoice modal
  const closeInvoiceModal = () => {
    setShowInvoiceModal(false);
    setSelectedOrder(null);
  };

  // Print invoice
  const printInvoice = () => {
    window.print();
  };

  // Handle inventory picking
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

      // Update existing dispatch record with inventory details
      const totalWeight = pickedItems.reduce((sum, item) => sum + item.weight, 0);
      const totalPieces = pickedItems.reduce((sum, item) => sum + item.quantity, 0);
      const sizeBreakdown = pickedItems.reduce((acc, item) => {
        const size = item.inventoryItem.final_size || 0;
        acc[size] = (acc[size] || 0) + item.quantity;
        return acc;
      }, {} as Record<number, number>);

      const order = confirmedOrders.find(o => o.id === currentOrderId);

      // Update the existing dispatch record
      const { data: dispatchData, error: dispatchError } = await supabase
        .from("dispatch_records")
        .update({
          fish_ids: inventoryIds,
          total_weight: totalWeight,
          total_pieces: totalPieces,
          size_breakdown: sizeBreakdown,
          status: 'dispatched',
          notes: `Inventory picked for order ${order?.order_number || currentOrderId}`
        })
        .eq('outlet_order_id', currentOrderId)
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
      await Promise.all([fetchConfirmedOrders(), fetchDispatchedOrders(), fetchInventory()]);

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

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchConfirmedOrders(),
        fetchDispatchedOrders(),
        fetchOutlets(),
        fetchInventory(),
        fetchDrivers()
      ]);
      setLoading(false);
    };
    loadData();
  }, []);

  return (
    <>
      {/* Print Styles */}
      <style jsx="true" global="true">{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-invoice, .printable-invoice * {
            visibility: visible;
          }
          .printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 20px !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .printable-invoice .bg-gradient-to-r {
            background: #2563eb !important;
            color: white !important;
          }
          .printable-invoice .bg-green-600 {
            background: #16a34a !important;
            color: white !important;
          }
          .printable-invoice .bg-gray-50 {
            background: #f9fafb !important;
          }
          .printable-invoice .bg-yellow-50 {
            background: #fefce8 !important;
          }
          .printable-invoice .text-white {
            color: white !important;
          }
          .printable-invoice .text-blue-100 {
            color: #dbeafe !important;
          }
          .printable-invoice .text-green-100 {
            color: #dcfce7 !important;
          }
          .printable-invoice .border {
            border: 1px solid #d1d5db !important;
          }
          .printable-invoice .rounded-lg,
          .printable-invoice .rounded-xl,
          .printable-invoice .rounded-2xl {
            border-radius: 4px !important;
          }
          .printable-invoice .shadow-2xl,
          .printable-invoice .shadow-lg {
            box-shadow: none !important;
          }
          .printable-invoice .p-8 {
            padding: 16px !important;
          }
          .printable-invoice .p-6 {
            padding: 12px !important;
          }
          .printable-invoice .p-4 {
            padding: 8px !important;
          }
          .printable-invoice .p-3 {
            padding: 6px !important;
          }
          .printable-invoice .text-3xl {
            font-size: 24px !important;
          }
          .printable-invoice .text-2xl {
            font-size: 20px !important;
          }
          .printable-invoice .text-lg {
            font-size: 16px !important;
          }
          .printable-invoice .mb-6 {
            margin-bottom: 12px !important;
          }
          .printable-invoice .mb-4 {
            margin-bottom: 8px !important;
          }
          .printable-invoice .mb-2 {
            margin-bottom: 4px !important;
          }
          .printable-invoice .mb-1 {
            margin-bottom: 2px !important;
          }
          .printable-invoice .mt-4 {
            margin-top: 8px !important;
          }
          .printable-invoice .gap-6 {
            gap: 12px !important;
          }
          .printable-invoice .max-h-\[60vh\] {
            max-height: none !important;
          }
          .printable-invoice .overflow-hidden {
            overflow: visible !important;
          }
          .printable-invoice .overflow-y-auto {
            overflow: visible !important;
          }
          .printable-invoice .flex {
            display: block !important;
          }
          .printable-invoice .grid {
            display: block !important;
          }
          .printable-invoice .grid > * {
            margin-bottom: 8px !important;
          }
          .printable-invoice .hidden {
            display: none !important;
          }
          .printable-invoice table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          .printable-invoice th,
          .printable-invoice td {
            padding: 8px !important;
            text-align: left !important;
            border-bottom: 1px solid #d1d5db !important;
          }
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 content-container responsive-padding">
      <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-4">
            <RioFishLogo size="lg" showText={false} />
          </div>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Truck className="h-8 w-8" />
              Dispatch Management
            </h1>
            <p className="text-white/80 mt-2">
              Assign drivers to confirmed orders and manage dispatch operations
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-white/70">Total Orders</p>
              <p className="text-2xl font-bold">{confirmedOrders.length + dispatchedOrders.length}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-white/70">Awaiting Dispatch</p>
              <p className="text-2xl font-bold text-orange-200">{confirmedOrders.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dispatch Statistics */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Awaiting Dispatch</p>
                <p className="text-3xl font-bold text-orange-800">{confirmedOrders.length}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Dispatched</p>
                <p className="text-3xl font-bold text-green-800">{dispatchedOrders.length}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Truck className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Orders</p>
                <p className="text-3xl font-bold text-blue-800">{confirmedOrders.length + dispatchedOrders.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-muted-foreground">Loading dispatch data...</span>
              </div>
      )}

      {/* Confirmed Orders Awaiting Driver Assignment */}
      {!loading && (
      <Card className="shadow-lg border-0">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b">
          <CardTitle className="flex items-center gap-2 text-orange-800">
              <Clock className="h-5 w-5" />
              Orders Awaiting Driver Assignment ({confirmedOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
            {confirmedOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="bg-orange-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                  <Truck className="h-10 w-10 text-orange-600" />
                </div>
                <p className="text-lg font-medium">No orders awaiting dispatch</p>
                <p className="text-sm">Confirmed orders will appear here for driver assignment</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {confirmedOrders.map((order) => (
                  <div key={order.id} className="bg-white border border-orange-200 rounded-xl p-5 hover:shadow-xl transition-all duration-300 hover:border-orange-400 hover:-translate-y-1">
                    {/* Order Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1">
                          AWAITING DRIVER
                      </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-blue-50"
                      >
                        <Eye className="h-4 w-4 text-gray-600" />
                      </Button>
                    </div>

                    {/* Order Info */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        <span className="font-semibold text-gray-900 text-sm">{order.outlet?.name || 'Unknown Outlet'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <MapPin className="h-3 w-3" />
                        <span>{order.outlet?.location || 'Unknown Location'}</span>
                      </div>
                    </div>
                    
                    {/* Order Details */}
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Order ID:</span>
                        <span className="font-medium text-gray-900">{order.order_number || order.id}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Quantity:</span>
                        <span className="font-medium text-gray-900">{order.requested_quantity}kg</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Sizes:</span>
                        <span className="font-medium text-gray-900">{order.requested_sizes?.join(', ') || 'Any'}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Date:</span>
                        <span className="font-medium text-gray-900">{new Date(order.order_date).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Total Value */}
                    <div className="border-t border-gray-100 pt-3 mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">Total Value</span>
                        <span className="text-lg font-bold text-gray-900">KES {order.total_value?.toLocaleString() || '0'}</span>
                      </div>
                    </div>
                    
                    {/* Approve Dispatch Button */}
                    <div className="space-y-2">
                      <Button 
                        size="sm" 
                        onClick={() => openApproveDispatchForm(order.id)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white text-xs"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Approve Dispatch
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dispatched Orders */}
      {!loading && (
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Truck className="h-5 w-5" />
              Dispatched Orders ({dispatchedOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {dispatchedOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                  <Truck className="h-10 w-10 text-green-600" />
                </div>
                <p className="text-lg font-medium">No dispatched orders</p>
                <p className="text-sm">Orders that have been dispatched will appear here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {dispatchedOrders.map((order) => (
                  <div key={order.id} className="bg-white border border-green-200 rounded-xl p-5 hover:shadow-xl transition-all duration-300 hover:border-green-400 hover:-translate-y-1">
                    {/* Order Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1">
                          DISPATCHED
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-blue-50"
                        onClick={() => openInvoiceModal(order)}
                        title="View Invoice Details"
                      >
                        <Eye className="h-4 w-4 text-gray-600" />
                      </Button>
                    </div>

                    {/* Order Info */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        <span className="font-semibold text-gray-900 text-sm">{order.outlet?.name || 'Unknown Outlet'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <MapPin className="h-3 w-3" />
                        <span>{order.outlet?.location || 'Unknown Location'}</span>
                      </div>
                    </div>

                    {/* Order Details */}
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Order ID:</span>
                        <span className="font-medium text-gray-900">{order.order_number || order.id}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Quantity:</span>
                        <span className="font-medium text-gray-900">{order.requested_quantity}kg</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Sizes:</span>
                        <span className="font-medium text-gray-900">{order.requested_sizes?.join(', ') || 'Any'}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Dispatched:</span>
                        <span className="font-medium text-gray-900">{new Date(order.dispatch_date || order.order_date).toLocaleDateString()}</span>
                      </div>
                      {(order.dispatch_record?.picking_date || order.dispatch_record?.notes?.includes('Picking:')) && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Picking Date:</span>
                          <span className="font-medium text-gray-900">
                            {order.dispatch_record?.picking_date ? 
                             new Date(order.dispatch_record.picking_date).toLocaleDateString() :
                             order.dispatch_record?.notes?.match(/Picking: ([^ ]+)/)?.[1] || 'Not specified'}
                          </span>
                        </div>
                      )}
                      {(order.dispatch_record?.picking_time || order.dispatch_record?.notes?.includes('at ')) && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Picking Time:</span>
                          <span className="font-medium text-gray-900">
                            {order.dispatch_record?.picking_time || 
                             order.dispatch_record?.notes?.match(/at ([^.]+)/)?.[1] || 'Not specified'}
                          </span>
                        </div>
                      )}
                      {(order.dispatch_record?.assigned_driver || order.dispatch_record?.notes?.includes('Driver:')) && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Driver:</span>
                          <span className="font-medium text-gray-900">
                            {order.dispatch_record?.assigned_driver || 
                             order.dispatch_record?.notes?.match(/Driver: ([^,]+)/)?.[1] || 'Not assigned'}
                          </span>
                        </div>
                      )}
                      {order.dispatch_record?.total_weight && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Weight:</span>
                          <span className="font-medium text-gray-900">{order.dispatch_record.total_weight} kg</span>
                        </div>
                      )}
                    </div>

                    {/* Total Value */}
                    <div className="border-t border-gray-100 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">Total Value</span>
                        <span className="text-lg font-bold text-gray-900">KES {order.total_value?.toLocaleString() || '0'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Inventory Picker Modal */}
      {showInventoryPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Pick Inventory for Order</h2>
              <p className="text-sm text-gray-600 mt-1">
                Select items from inventory to fulfill this order
              </p>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {inventory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No inventory available</p>
                  <p className="text-sm">No items are ready for dispatch</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inventory.map((item) => {
                    const isPicked = pickedItems.some(p => p.inventoryItem.id === item.id);
                    const pickedItem = pickedItems.find(p => p.inventoryItem.id === item.id);
                    
                    return (
                      <div key={item.id} className={`border rounded-lg p-4 ${isPicked ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-medium text-gray-900">Size {item.final_size}</h3>
                            <p className="text-sm text-gray-600">
                              Available: {item.ready_for_dispatch_count} pieces
                            </p>
                          </div>
                          <Badge className={isPicked ? 'bg-orange-500' : 'bg-gray-500'}>
                            {isPicked ? 'Picked' : 'Available'}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="text-xs text-gray-600">
                            <p>Weight: {item.total_weight}kg</p>
                            <p>Storage: {item.storage_location || 'Unknown'}</p>
                            <p>Farmer: {item.farmer_name || 'Unknown'}</p>
                          </div>
                          
                          {isPicked ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                max={item.ready_for_dispatch_count}
                                value={pickedItem?.quantity || 1}
                                onChange={(e) => {
                                  const quantity = parseInt(e.target.value) || 1;
                                  setPickedItems(prev => 
                                    prev.map(p => 
                                      p.inventoryItem.id === item.id 
                                        ? { ...p, quantity, weight: quantity * (item.total_weight / item.ready_for_dispatch_count) }
                                        : p
                                    )
                                  );
                                }}
                                className="w-20 px-2 py-1 border rounded text-sm"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPickedItems(prev => prev.filter(p => p.inventoryItem.id !== item.id));
                                }}
                                className="text-red-600 hover:text-red-700"
                              >
                                Remove
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => {
                                setPickedItems(prev => [...prev, {
                                  inventoryItem: item,
                                  quantity: 1,
                                  weight: item.total_weight / item.ready_for_dispatch_count
                                }]);
                              }}
                              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                            >
                              Add to Pick List
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                {pickedItems.length > 0 && (
                  <p>
                    Selected: {pickedItems.reduce((sum, item) => sum + item.quantity, 0)} pieces, 
                    {pickedItems.reduce((sum, item) => sum + item.weight, 0).toFixed(2)}kg
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowInventoryPicker(false);
                    setCurrentOrderId(null);
                    setPickedItems([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInventoryPick}
                  disabled={pickedItems.length === 0}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  Dispatch Order
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approval Form Modal */}
      {showApproveForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Approve Dispatch</h2>
              <p className="text-sm text-gray-600 mt-1">
                Assign a driver and approve this dispatch
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Driver Selection */}
              <div>
                <Label className="text-sm font-medium text-gray-700">Select Driver</Label>
                <Select onValueChange={(driverId) => setApprovalData(prev => ({ ...prev, driverId }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose a driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Picking Date */}
              <div>
                <Label className="text-sm font-medium text-gray-700">Picking Date *</Label>
                <input
                  type="date"
                  value={approvalData.pickingDate}
                  onChange={(e) => setApprovalData(prev => ({ ...prev, pickingDate: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Picking Time */}
              <div>
                <Label className="text-sm font-medium text-gray-700">Picking Time *</Label>
                <input
                  type="time"
                  value={approvalData.pickingTime}
                  onChange={(e) => setApprovalData(prev => ({ ...prev, pickingTime: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <Label className="text-sm font-medium text-gray-700">Notes (Optional)</Label>
                <textarea
                  value={approvalData.notes}
                  onChange={(e) => setApprovalData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any notes for this dispatch..."
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowApproveForm(false);
                  setCurrentOrderId(null);
                  setApprovalData({ driverId: '', notes: '', pickingDate: '', pickingTime: '' });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApprovalSubmit}
                disabled={!approvalData.driverId}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Dispatch
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {showInvoiceModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="printable-invoice bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <RioFishLogo size="lg" showText={false} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold">Dispatch Invoice</h2>
                    <p className="text-blue-100 text-lg mt-1">
                      Order #{selectedOrder.order_number || selectedOrder.id.slice(0, 8)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={printInvoice}
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20 px-4 py-2 rounded-xl font-semibold"
                  >
                    Print
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closeInvoiceModal}
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20 px-4 py-2 rounded-xl font-semibold"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">From:</h3>
                  <p className="text-gray-700">Rio Fish Management</p>
                  <p className="text-gray-700">Nairobi, Kenya</p>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">To:</h3>
                  <p className="text-gray-700 font-medium">{selectedOrder.outlet?.name || 'Unknown Outlet'}</p>
                  <p className="text-gray-700">{selectedOrder.outlet?.location || 'Unknown Location'}</p>
                </div>
              </div>

              {/* Order Details Table */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-left py-2 font-semibold text-gray-700">Item</th>
                      <th className="text-left py-2 font-semibold text-gray-700">Details</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr className="border-b border-gray-200">
                      <td className="py-2 text-gray-600">Order #</td>
                      <td className="py-2 font-medium">{selectedOrder.order_number || selectedOrder.id.slice(0, 8)}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-2 text-gray-600">Date</td>
                      <td className="py-2 font-medium">{new Date(selectedOrder.order_date).toLocaleDateString()}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-2 text-gray-600">Quantity</td>
                      <td className="py-2 font-medium">{selectedOrder.requested_quantity} kg</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-2 text-gray-600">Sizes</td>
                      <td className="py-2 font-medium">{selectedOrder.requested_sizes?.join(', ') || 'Any Size'}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-2 text-gray-600">Driver</td>
                      <td className="py-2 font-medium">
                        {selectedOrder.dispatch_record?.assigned_driver || 
                         (selectedOrder.dispatch_record?.notes?.match(/Driver: ([^,]+)/)?.[1]) || 
                         'Not assigned'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-600">Price/kg</td>
                      <td className="py-2 font-medium">KES {selectedOrder.price_per_kg?.toLocaleString() || '0'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Total Amount */}
              <div className="bg-green-600 rounded-lg p-4 text-white text-center">
                <p className="text-green-100 text-sm mb-1">Total Amount</p>
                <p className="text-3xl font-bold">KES {selectedOrder.total_value?.toLocaleString() || '0'}</p>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm text-gray-700"><strong>Notes:</strong> {selectedOrder.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
    </>
  );
}