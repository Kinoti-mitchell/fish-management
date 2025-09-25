import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { 
  Truck, Plus, MapPin, Clock, Package, 
  CheckCircle, AlertTriangle, RefreshCw, User, Phone, Calendar
} from "lucide-react";
import { NavigationSection } from "../types";
import { supabase, handleSupabaseError, withRetry } from "../lib/supabaseClient";
import { toast } from "sonner";

interface DeliveryManagementProps {
  onNavigate: (section: NavigationSection, itemId?: string) => void;
}

// Delivery status options
const deliveryStatuses = [
  { value: 'scheduled', label: 'Scheduled', color: 'bg-blue-500' },
  { value: 'in-transit', label: 'In Transit', color: 'bg-yellow-500' },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-500' },
  { value: 'failed', label: 'Failed', color: 'bg-red-500' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-500' }
];

// Driver options
const drivers = [
  { id: 'driver1', name: 'John Mwangi', phone: '+254712345678', vehicle: 'KCA 123A' },
  { id: 'driver2', name: 'Mary Wanjiku', phone: '+254723456789', vehicle: 'KCB 456B' },
  { id: 'driver3', name: 'Peter Kimani', phone: '+254734567890', vehicle: 'KCC 789C' },
  { id: 'driver4', name: 'Grace Akinyi', phone: '+254745678901', vehicle: 'KCD 012D' }
];

export default function DeliveryManagement({ onNavigate }: DeliveryManagementProps) {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [isNewDeliveryOpen, setIsNewDeliveryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [formData, setFormData] = useState({
    orderId: '',
    driverId: '',
    vehicle: '',
    scheduledDate: '',
    priority: 'normal',
    notes: ''
  });

  // Fetch deliveries from database
  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('deliveries')
          .select('*')
          .order('scheduled_date', { ascending: false });
      });

      if (error) throw error;
      setDeliveries(data || []);
    } catch (error) {
      const errorMessage = handleSupabaseError(error, 'fetching deliveries');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      if (!formData.orderId || !formData.driverId || !formData.scheduledDate) {
        toast.error('Please fill in all required fields');
        return;
      }

      const selectedDriver = drivers.find(d => d.id === formData.driverId);
      if (!selectedDriver) {
        toast.error('Invalid driver selected');
        return;
      }

      const newDelivery = {
        order_id: formData.orderId,
        driver_id: formData.driverId,
        driver_name: selectedDriver.name,
        driver_phone: selectedDriver.phone,
        vehicle_number: formData.vehicle || selectedDriver.vehicle,
        scheduled_date: formData.scheduledDate,
        priority: formData.priority,
        status: 'scheduled',
        notes: formData.notes || null,
        created_at: new Date().toISOString()
      };

      const { error } = await withRetry(async () => {
        return await supabase
          .from('deliveries')
          .insert([newDelivery]);
      });

      if (error) throw error;

      toast.success('Delivery scheduled successfully');
      setFormData({
        orderId: '',
        driverId: '',
        vehicle: '',
        scheduledDate: '',
        priority: 'normal',
        notes: ''
      });
      setIsNewDeliveryOpen(false);
      await fetchDeliveries();
    } catch (error) {
      const errorMessage = handleSupabaseError(error, 'scheduling delivery');
      toast.error(errorMessage);
    }
  };

  // Handle status update
  const handleStatusUpdate = async (deliveryId: string, newStatus: string) => {
    try {
      const { error } = await withRetry(async () => {
        return await supabase
          .from('deliveries')
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', deliveryId);
      });

      if (error) throw error;

      toast.success(`Delivery status updated to ${newStatus}`);
      await fetchDeliveries();
    } catch (error) {
      const errorMessage = handleSupabaseError(error, 'updating delivery status');
      toast.error(errorMessage);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDeliveries();
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const getStatusColor = (status: string) => {
    const statusObj = deliveryStatuses.find(s => s.value === status);
    return statusObj ? statusObj.color : 'bg-gray-500';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'normal': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const stats = {
    totalDeliveries: deliveries.length,
    scheduled: deliveries.filter(d => d.status === 'scheduled').length,
    inTransit: deliveries.filter(d => d.status === 'in-transit').length,
    delivered: deliveries.filter(d => d.status === 'delivered').length,
    failed: deliveries.filter(d => d.status === 'failed').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 content-container responsive-padding">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                <Truck className="h-10 w-10 text-white" />
              </div>
        Delivery Management
      </h1>
            <p className="text-xl text-gray-600 ml-16">Schedule and track deliveries • Driver assignment • Route optimization</p>
          </div>
          <div className="flex gap-4">
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-6 py-3 rounded-2xl font-semibold"
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Dialog open={isNewDeliveryOpen} onOpenChange={setIsNewDeliveryOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-2xl font-semibold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                  <Plus className="h-6 w-6 mr-3" />
                  Schedule Delivery
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-gray-900">Schedule New Delivery</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-6">
                  <div className="space-y-3">
                    <Label className="text-base font-semibold text-gray-700">Order ID</Label>
                    <Select 
                      value={formData.orderId} 
                      onValueChange={(value) => setFormData({...formData, orderId: value})}
                    >
                      <SelectTrigger className="h-14 text-base">
                        <SelectValue placeholder="Select order" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ORD-001">ORD-001 - Nakuru Market (KES 45,000)</SelectItem>
                        <SelectItem value="ORD-002">ORD-002 - Kisumu Central (KES 32,500)</SelectItem>
                        <SelectItem value="ORD-003">ORD-003 - Mombasa Depot (KES 67,800)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="text-base font-semibold text-gray-700">Driver</Label>
                    <Select 
                      value={formData.driverId} 
                      onValueChange={(value) => {
                        const driver = drivers.find(d => d.id === value);
                        setFormData({
                          ...formData, 
                          driverId: value,
                          vehicle: driver?.vehicle || ''
                        });
                      }}
                    >
                      <SelectTrigger className="h-14 text-base">
                        <SelectValue placeholder="Select driver" />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            {driver.name} - {driver.vehicle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-base font-semibold text-gray-700">Vehicle Number</Label>
                      <Input 
                        placeholder="KCA 123A" 
                        className="h-14 text-base"
                        value={formData.vehicle}
                        onChange={(e) => setFormData({...formData, vehicle: e.target.value})}
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-base font-semibold text-gray-700">Priority</Label>
                      <Select 
                        value={formData.priority} 
                        onValueChange={(value) => setFormData({...formData, priority: value})}
                      >
                        <SelectTrigger className="h-14 text-base">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="text-base font-semibold text-gray-700">Scheduled Date & Time</Label>
                    <Input 
                      type="datetime-local" 
                      className="h-14 text-base"
                      value={formData.scheduledDate}
                      onChange={(e) => setFormData({...formData, scheduledDate: e.target.value})}
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="text-base font-semibold text-gray-700">Delivery Notes</Label>
                    <Textarea 
                      placeholder="Special instructions, delivery requirements, or notes..." 
                      className="h-24 text-base"
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    />
                  </div>
                  
                  <div className="flex justify-end gap-4 pt-6">
                    <Button variant="outline" onClick={() => setIsNewDeliveryOpen(false)} className="px-8 py-3 text-base">
                      Cancel
                    </Button>
                    <Button onClick={handleSubmit} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-8 py-3 text-base">
                      Schedule Delivery
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-50 to-indigo-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Total Deliveries</p>
                  <p className="text-4xl font-bold text-blue-900 mt-2">{stats.totalDeliveries}</p>
                </div>
                <div className="p-4 bg-blue-600 rounded-2xl shadow-lg">
                  <Truck className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-yellow-50 to-amber-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-yellow-600 uppercase tracking-wide">Scheduled</p>
                  <p className="text-4xl font-bold text-yellow-900 mt-2">{stats.scheduled}</p>
                </div>
                <div className="p-4 bg-yellow-600 rounded-2xl shadow-lg">
                  <Clock className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-orange-50 to-orange-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-orange-600 uppercase tracking-wide">In Transit</p>
                  <p className="text-4xl font-bold text-orange-900 mt-2">{stats.inTransit}</p>
                </div>
                <div className="p-4 bg-orange-600 rounded-2xl shadow-lg">
                  <Package className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-green-50 to-emerald-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-green-600 uppercase tracking-wide">Delivered</p>
                  <p className="text-4xl font-bold text-green-900 mt-2">{stats.delivered}</p>
                </div>
                <div className="p-4 bg-green-600 rounded-2xl shadow-lg">
                  <CheckCircle className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-red-50 to-red-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-600 uppercase tracking-wide">Failed</p>
                  <p className="text-4xl font-bold text-red-900 mt-2">{stats.failed}</p>
                </div>
                <div className="p-4 bg-red-600 rounded-2xl shadow-lg">
                  <AlertTriangle className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Deliveries List */}
        <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-3xl">
            <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Package className="h-8 w-8 text-blue-600" />
              Delivery Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading deliveries...</p>
              </div>
            ) : deliveries.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No deliveries found</h3>
                <p className="text-gray-500">Start by scheduling your first delivery</p>
              </div>
            ) : (
              <div className="space-y-6">
                {deliveries.map((delivery) => (
                  <div key={delivery.id} className="border-2 border-gray-100 rounded-3xl p-8 hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-white to-gray-50 hover:from-blue-50 hover:to-indigo-50">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-3">
                            <Truck className="h-6 w-6 text-blue-600" />
                            <span className="text-2xl font-bold text-gray-900">{delivery.id}</span>
                          </div>
                          <Badge className={`text-sm font-semibold px-4 py-2 rounded-xl ${getStatusColor(delivery.status)}`}>
                            {delivery.status.toUpperCase()}
                          </Badge>
                          <Badge className={`text-sm font-semibold px-4 py-2 rounded-xl ${getPriorityColor(delivery.priority)}`}>
                            {delivery.priority.toUpperCase()}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                          <div className="flex items-center gap-3 text-gray-700">
                            <Package className="h-5 w-5 text-blue-500" />
                            <div>
                              <div className="font-semibold text-gray-900">Order: {delivery.order_id}</div>
                              <div className="text-sm text-gray-500">Delivery ID</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-gray-700">
                            <User className="h-5 w-5 text-green-500" />
                            <div>
                              <div className="font-semibold text-gray-900">{delivery.driver_name}</div>
                              <div className="text-sm text-gray-500">{delivery.vehicle_number}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-gray-700">
                            <Phone className="h-5 w-5 text-purple-500" />
                            <span className="text-sm font-medium">{delivery.driver_phone}</span>
                          </div>
                          <div className="flex items-center gap-3 text-gray-700">
                            <Calendar className="h-5 w-5 text-orange-500" />
                            <span className="text-sm font-medium">{new Date(delivery.scheduled_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                        
                        {delivery.notes && (
                          <div className="bg-gray-50 p-4 rounded-2xl border-l-4 border-gray-400">
                            <div className="text-sm font-semibold text-gray-700 mb-2">Delivery Notes</div>
                            <div className="text-sm text-gray-600">{delivery.notes}</div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-4 min-w-fit">
                        <div className="flex gap-2">
                          {delivery.status === 'scheduled' && (
                            <Button 
                              size="sm" 
                              onClick={() => handleStatusUpdate(delivery.id, 'in-transit')}
                              className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white px-4 py-2 rounded-xl font-semibold"
                            >
                              Start Delivery
                            </Button>
                          )}
                          {delivery.status === 'in-transit' && (
                            <Button 
                              size="sm" 
                              onClick={() => handleStatusUpdate(delivery.id, 'delivered')}
                              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-2 rounded-xl font-semibold"
                            >
                              Mark Delivered
                            </Button>
                          )}
                          {delivery.status === 'delivered' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="px-4 py-2 rounded-xl font-semibold"
                              disabled
                            >
                              Completed
                            </Button>
                          )}
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
    </div>
  );
}
