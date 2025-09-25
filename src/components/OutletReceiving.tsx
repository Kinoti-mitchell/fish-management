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
  CheckSquare, Plus, MapPin, Scale, AlertTriangle, 
  CheckCircle, Clock, Phone, Fish, Ruler, Calculator, RefreshCw,
  Eye, SquarePen, Weight, Target, DollarSign, ChevronDown
} from "lucide-react";
import { NavigationSection, OutletReceiving as OutletReceivingType } from "../types";
import { supabase, handleSupabaseError, withRetry, getAuthenticatedSupabase } from "../lib/supabaseClient";
import { auditLog } from "../utils/auditLogger";

// Using regular supabase client like other components
import { useAuth } from "./AuthContext";
import { toast } from "sonner";
import { RioFishLogo } from "./RioFishLogo";

interface OutletReceivingProps {
  onNavigate: (section: NavigationSection, itemId?: string) => void;
}

// Kenyan outlets/markets
const kenyanOutlets = [
  { id: 'nakuru', name: 'Nakuru Fresh Fish Market', location: 'Nakuru' },
  { id: 'kisumu', name: 'Kisumu Central Market', location: 'Kisumu' },
  { id: 'mombasa', name: 'Mombasa Fish Depot', location: 'Mombasa' },
  { id: 'nairobi', name: 'Nairobi Fish Market', location: 'Nairobi' },
  { id: 'eldoret', name: 'Eldoret Fresh Markets', location: 'Eldoret' },
  { id: 'thika', name: 'Thika Town Market', location: 'Thika' },
  { id: 'machakos', name: 'Machakos Market', location: 'Machakos' },
  { id: 'nyeri', name: 'Nyeri Fish Center', location: 'Nyeri' }
];

export default function OutletReceiving({ onNavigate }: OutletReceivingProps) {
  const { user } = useAuth();
  const [receivingRecords, setReceivingRecords] = useState<OutletReceivingType[]>([]);
  const [isNewReceivingOpen, setIsNewReceivingOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableDispatches, setAvailableDispatches] = useState<any[]>([]);
  const [selectedDispatch, setSelectedDispatch] = useState<any>(null);
  const [selectedRecord, setSelectedRecord] = useState<OutletReceivingType | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [expandedOutlets, setExpandedOutlets] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    dispatchId: '',
    outletId: '',
    actualWeight: '',
    actualValue: '',
    condition: '',
    receivedBy: user ? `${user.first_name} ${user.last_name}` : '',
    notes: '',
    sizeDiscrepancies: {} as { [size: number]: number }
  });

  // Update receivedBy when user changes
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        receivedBy: `${user.first_name} ${user.last_name}`
      }));
    }
  }, [user]);

  // Generate sequential ID for display
  const generateDisplayId = (index: number) => {
    return `REC${String(index + 1).padStart(4, '0')}`;
  };

  // Organize records by outlet
  const organizeRecordsByOutlet = (records: OutletReceivingType[]) => {
    const outletGroups: { [key: string]: OutletReceivingType[] } = {};
    
    records.forEach((record, index) => {
      const outletName = record.dispatch?.outlet_order?.outlet?.name || 'Unknown Outlet';
      if (!outletGroups[outletName]) {
        outletGroups[outletName] = [];
      }
      outletGroups[outletName].push({ ...record, displayIndex: index });
    });
    
    return outletGroups;
  };

  // Toggle outlet expansion
  const toggleOutletExpansion = (outletName: string) => {
    const newExpanded = new Set(expandedOutlets);
    if (newExpanded.has(outletName)) {
      newExpanded.delete(outletName);
    } else {
      newExpanded.add(outletName);
    }
    setExpandedOutlets(newExpanded);
  };

  // Handle view details
  const handleViewDetails = (record: OutletReceivingType) => {
    setSelectedRecord(record);
    setIsDetailsOpen(true);
  };

  // Fetch receiving records from database using direct query
  const fetchReceivingRecords = async () => {
    try {
      setLoading(true);
      const authenticatedSupabase = getAuthenticatedSupabase(user?.id);
      const { data, error } = await withRetry(async () => {
        return await authenticatedSupabase
          .from('outlet_receiving')
          .select(`
            *,
            dispatch_records!inner(
              id,
              destination,
              dispatch_date,
              outlet_orders!inner(
                id,
                order_number,
                outlets!inner(
                  id,
                  name,
                  location
                )
              )
            )
          `)
          .order('received_date', { ascending: false });
      });

      if (error) throw error;
      
      // Transform the data to match the expected format
      const transformedData = (data || []).map((record: any) => ({
        id: record.id,
        dispatch_id: record.dispatch_id,
        outlet_order_id: record.outlet_order_id,
        received_date: record.received_date,
        received_by: record.received_by,
        expected_weight: parseFloat(record.expected_weight) || 0,
        actual_weight_received: parseFloat(record.actual_weight_received) || 0,
        expected_value: parseFloat(record.expected_value) || 0,
        actual_value_received: parseFloat(record.actual_value_received) || 0,
        condition: record.condition || 'good',
        size_discrepancies: record.size_discrepancies || null,
        discrepancy_notes: record.discrepancy_notes || null,
        status: record.status || 'confirmed',
        outlet_name: record.outlet_name || 'Unknown',
        outlet_location: record.outlet_location || 'Unknown',
        created_at: record.created_at,
        updated_at: record.updated_at,
        dispatch: {
          id: record.dispatch_records?.id || record.dispatch_id,
          destination: record.dispatch_records?.destination || 'Unknown',
          dispatch_date: record.dispatch_records?.dispatch_date,
          outlet_order: {
            order_number: record.dispatch_records?.outlet_orders?.order_number || 'N/A',
            outlet: {
              name: record.dispatch_records?.outlet_orders?.outlets?.name || record.outlet_name || 'Unknown',
              location: record.dispatch_records?.outlet_orders?.outlets?.location || record.outlet_location || 'Unknown'
            }
          }
        }
      }));
      
      setReceivingRecords(transformedData);
    } catch (error) {
      const errorMessage = handleSupabaseError(error, 'fetching receiving records');
      toast.error(errorMessage);
      setReceivingRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch available dispatches with full details
  const fetchDispatches = async () => {
    try {
      const authenticatedSupabase = getAuthenticatedSupabase(user?.id);
      const { data, error } = await withRetry(async () => {
        return await authenticatedSupabase
          .from('dispatch_records')
          .select(`
            id,
            outlet_order_id,
            destination,
            total_weight,
            total_value,
            size_breakdown,
            status,
            dispatch_date,
            notes,
            picking_date,
            picking_time,
            assigned_driver,
            outlet_order:outlet_orders(
              id,
              order_number,
              total_value,
              outlet:outlets(name, location, phone)
            )
          `)
          .in('status', ['in-transit', 'dispatched', 'scheduled'])
          .order('dispatch_date', { ascending: false });
      });

      if (error) throw error;
      
      // Debug: Log fetched dispatches and their size breakdown data
      console.log('Fetched dispatches:', data);
      data?.forEach((dispatch, index) => {
        console.log(`Dispatch ${index} size breakdown:`, dispatch.size_breakdown);
      });
      
      return data || [];
    } catch (error) {
      console.error('Error fetching dispatches:', error);
      return [];
    }
  };

  // Calculate total size weight from size discrepancies
  const calculateTotalSizeWeight = () => {
    if (!selectedDispatch?.size_breakdown) return 0;
    
    let totalSizeWeight = 0;
    Object.entries(selectedDispatch.size_breakdown).forEach(([size, expectedQuantity]) => {
      const actualWeight = formData.sizeDiscrepancies[parseInt(size)] || 0;
      const actualQuantity = (expectedQuantity as number) + actualWeight;
      totalSizeWeight += actualQuantity;
    });
    
    return totalSizeWeight;
  };

  // Check if form has all required fields filled
  const isFormValid = () => {
    const totalSizeWeight = calculateTotalSizeWeight();
    const actualWeight = parseFloat(formData.actualWeight) || 0;
    
    // Check if dispatch has size breakdown and user needs to fill discrepancies
    const hasSizeBreakdown = selectedDispatch?.size_breakdown && Object.keys(selectedDispatch.size_breakdown).length > 0;
    const hasSizeDiscrepancies = Object.keys(formData.sizeDiscrepancies).length > 0;
    
    return !!(
      formData.dispatchId &&
      selectedDispatch &&
      formData.actualWeight &&
      formData.actualWeight.trim() !== '' &&
      parseFloat(formData.actualWeight) > 0 &&
      formData.actualValue &&
      formData.actualValue.trim() !== '' &&
      parseFloat(formData.actualValue) > 0 &&
      formData.condition &&
      formData.condition.trim() !== '' &&
      user &&
      user.id &&
      // Size breakdown validation - if dispatch has size breakdown, user must fill discrepancies
      (!hasSizeBreakdown || hasSizeDiscrepancies) &&
      // Size weight validation
      (totalSizeWeight === 0 || Math.abs(totalSizeWeight - actualWeight) <= 0.1) // Allow 0.1kg tolerance
    );
  };

  // Validate receiving data
  const validateReceivingData = () => {
    const errors: string[] = [];

    // 1. Validate dispatch selection
    if (!formData.dispatchId || !selectedDispatch) {
      errors.push('Please select a valid dispatch');
    }

    // 2. Validate dispatch ID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (formData.dispatchId && !uuidRegex.test(formData.dispatchId)) {
      errors.push('Invalid dispatch ID format. Please refresh and select a dispatch again.');
      console.error('Invalid dispatch ID:', formData.dispatchId);
    }

    // 3. Validate weight received (required)
    if (!formData.actualWeight || formData.actualWeight.trim() === '') {
      errors.push('Please enter the weight received');
    } else if (parseFloat(formData.actualWeight) <= 0) {
      errors.push('Weight received must be greater than 0');
    } else if (parseFloat(formData.actualWeight) < 0.1) {
      errors.push('Weight received seems too low (<0.1kg). Please verify the value');
    }
    // Note: Removed high weight validation to allow large values

    // 4. Validate value received (required)
    if (!formData.actualValue || formData.actualValue.trim() === '') {
      errors.push('Please enter the value received');
    } else if (parseFloat(formData.actualValue) <= 0) {
      errors.push('Value received must be greater than 0');
    }
    // Note: Removed high value validation to allow exact matches

    // 5. Validate condition (required)
    if (!formData.condition || formData.condition.trim() === '') {
      errors.push('Please select the condition of received items');
    }

    // 6. Validate received by (should be auto-filled, but check)
    if (!user || !user.id) {
      errors.push('User session expired. Please refresh and try again');
    }

    // 7. Check for unrealistic expected values in dispatch data (warnings only, not blocking)
    if (selectedDispatch) {
      const expectedWeight = selectedDispatch.total_weight || 0;
      const expectedValue = selectedDispatch.total_value || 0;
      
      if (expectedWeight > 10000) {
        console.warn(`⚠️ WARNING: Expected weight (${expectedWeight}kg) seems unrealistic. Please verify dispatch data.`);
      }
      
      if (expectedValue > 1000000) {
        console.warn(`⚠️ WARNING: Expected value (KES ${expectedValue.toLocaleString()}) seems unrealistic. Please verify dispatch data.`);
      }
    }

    // 8. Check for significant discrepancies (warning only, not blocking)
    if (selectedDispatch && selectedDispatch.total_weight > 0) {
      const expectedWeight = selectedDispatch.total_weight || 0;
      const actualWeight = parseFloat(formData.actualWeight) || 0;
      const weightDiff = Math.abs(actualWeight - expectedWeight);
      const weightDiffPercent = expectedWeight > 0 ? (weightDiff / expectedWeight) * 100 : 0;

      if (weightDiffPercent > 20) {
        console.warn(`Weight discrepancy is ${weightDiffPercent.toFixed(1)}% - please verify the received weight`);
      }
    }

    // 8. Validate numeric inputs are actually numbers
    if (formData.actualWeight && isNaN(parseFloat(formData.actualWeight))) {
      errors.push('Weight received must be a valid number');
    }
    if (formData.actualValue && isNaN(parseFloat(formData.actualValue))) {
      errors.push('Value received must be a valid number');
    }

    // 9. Validate size breakdown - if dispatch has size breakdown, user must fill in discrepancies
    if (selectedDispatch?.size_breakdown && Object.keys(selectedDispatch.size_breakdown).length > 0) {
      // Check if user has filled in any size discrepancies
      const hasSizeDiscrepancies = Object.keys(formData.sizeDiscrepancies).length > 0;
      
      if (!hasSizeDiscrepancies) {
        errors.push('This dispatch has size breakdown data. Please fill in the size discrepancies section below.');
      } else {
        // If size discrepancies are filled, validate they match total weight
        const totalSizeWeight = calculateTotalSizeWeight();
        const actualWeight = parseFloat(formData.actualWeight) || 0;
        const weightDifference = Math.abs(totalSizeWeight - actualWeight);
        
        if (weightDifference > 0.1) { // Allow 0.1kg tolerance
          errors.push(`Size breakdown total (${totalSizeWeight.toFixed(1)}kg) does not match total weight received (${actualWeight.toFixed(1)}kg). Difference: ${weightDifference.toFixed(1)}kg`);
        }
      }
    }

    return errors;
  };

  // Audit logging function - now using centralized audit logger
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

  // Handle form submission
  const handleSubmit = async () => {
    // Prevent double entry
    if (isSubmitting) {
      toast.warning('Please wait, submission in progress...');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Validate the form data
      const validationErrors = validateReceivingData();
      if (validationErrors.length > 0) {
        validationErrors.forEach(error => toast.error(error));
        return;
      }

      // Show warnings for unrealistic data but allow submission
      if (selectedDispatch) {
        const expectedWeight = selectedDispatch.total_weight || 0;
        const expectedValue = selectedDispatch.total_value || 0;
        const actualWeight = parseFloat(formData.actualWeight) || 0;
        
        if (expectedWeight > 10000) {
          toast.warning(`⚠️ Large expected weight: ${expectedWeight}kg`);
        }
        
        if (expectedValue > 1000000) {
          toast.warning(`⚠️ Large expected value: KES ${expectedValue.toLocaleString()}`);
        }
        
        if (actualWeight > expectedWeight && actualWeight > 10000) {
          toast.warning(`⚠️ Received weight (${actualWeight}kg) is larger than expected (${expectedWeight}kg)`);
        }
        
        const weightDiffPercent = expectedWeight > 0 ? (Math.abs(actualWeight - expectedWeight) / expectedWeight) * 100 : 0;
        if (weightDiffPercent > 20) {
          toast.warning(`⚠️ Large discrepancy: ${weightDiffPercent.toFixed(1)}%`);
        }
      }

      const newRecord = {
        dispatch_id: formData.dispatchId,
        outlet_order_id: selectedDispatch.outlet_order_id,
        received_date: new Date().toISOString().split('T')[0],
        received_by: user?.id || null, // Use user UUID instead of name string
        expected_weight: parseFloat((selectedDispatch.total_weight || 0).toString()),
        actual_weight_received: parseFloat(formData.actualWeight) || 0,
        expected_pieces: 0, // Set to 0 since we're not tracking pieces
        actual_pieces_received: 0, // Set to 0 since we're not tracking pieces
        expected_value: parseFloat((selectedDispatch.total_value || selectedDispatch.outlet_order?.total_value || 0).toString()),
        actual_value_received: parseFloat(formData.actualValue) || 0,
        condition: formData.condition || 'good',
        size_discrepancies: Object.keys(formData.sizeDiscrepancies).length > 0 ? formData.sizeDiscrepancies : null,
        discrepancy_notes: formData.notes || null,
        status: 'confirmed',
        outlet_name: selectedDispatch.outlet_order?.outlet?.name || selectedDispatch.destination,
        outlet_location: selectedDispatch.outlet_order?.outlet?.location || 'Unknown'
      };

      console.log('Creating receiving record with data:', newRecord);
      console.log('Form data dispatchId:', formData.dispatchId);
      console.log('Form data dispatchId type:', typeof formData.dispatchId);
      console.log('Selected dispatch:', selectedDispatch);
      console.log('Selected dispatch ID:', selectedDispatch?.id);
      console.log('Selected dispatch ID type:', typeof selectedDispatch?.id);

      const authenticatedSupabase = getAuthenticatedSupabase(user?.id);
      const { data: newReceivingRecord, error } = await withRetry(async () => {
        return await authenticatedSupabase
          .from('outlet_receiving')
          .insert([newRecord])
          .select('id')
          .single();
      });

      if (error) throw error;

      // Update dispatch status to delivered
      await authenticatedSupabase
        .from('dispatch_records')
        .update({ status: 'delivered', updated_at: new Date().toISOString() })
        .eq('id', formData.dispatchId);

      // Log audit event for outlet receiving (with error handling)
      try {
        await logAuditEvent('INSERT', 'outlet_receiving', newReceivingRecord.id, null, {
          ...newRecord,
          entry_code: `RCV-${Date.now()}`, // Generate entry code for receiving
          fish_type: selectedDispatch.fish_type || 'Tilapia',
          condition: newRecord.condition,
          weight_received: newRecord.actual_weight_received,
          outlet_id: selectedDispatch.outlet_order?.outlet_id,
          receiving_date: newRecord.received_date
        });
      } catch (auditError) {
        console.warn('Audit logging failed (non-critical):', auditError);
        // Don't fail the entire operation for audit logging issues
      }

      toast.success('Receiving record created successfully');
      setFormData({
        dispatchId: '',
        outletId: '',
        actualWeight: '',
        actualValue: '',
        condition: '',
        receivedBy: user ? `${user.first_name} ${user.last_name}` : '',
        notes: '',
        sizeDiscrepancies: {}
      });
      setSelectedDispatch(null);
      setIsNewReceivingOpen(false);
      await fetchReceivingRecords();
    } catch (error) {
      const errorMessage = handleSupabaseError(error, 'creating receiving record');
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Load available dispatches when dialog opens
  const loadAvailableDispatches = async () => {
    try {
      const dispatches = await fetchDispatches();
      console.log('Fetched dispatches:', dispatches);
      setAvailableDispatches(dispatches);
    } catch (error) {
      console.error('Error loading dispatches:', error);
      toast.error('Failed to load available dispatches');
    }
  };

  // Debug: Log available dispatches whenever they change
  useEffect(() => {
    console.log('Available dispatches updated:', availableDispatches);
    availableDispatches.forEach((dispatch, index) => {
      console.log(`Dispatch ${index}:`, {
        id: dispatch.id,
        idType: typeof dispatch.id,
        destination: dispatch.destination,
        total_weight: dispatch.total_weight,
        size_breakdown: dispatch.size_breakdown
      });
    });
  }, [availableDispatches]);

  // Handle dispatch selection
  const handleDispatchSelection = (dispatchId: string) => {
    console.log('Selected dispatch ID:', dispatchId);
    console.log('Available dispatches:', availableDispatches);
    
    // Validate that the selected ID is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(dispatchId)) {
      console.error('Invalid dispatch ID format:', dispatchId);
      toast.error('Invalid dispatch selection. Please refresh and try again.');
      return;
    }
    
    const dispatch = availableDispatches.find(d => d.id === dispatchId);
    console.log('Found dispatch:', dispatch);
    
    if (!dispatch) {
      console.error('Dispatch not found for ID:', dispatchId);
      toast.error('Selected dispatch not found. Please refresh and try again.');
      return;
    }
    
    // Double-check that the dispatch ID is valid
    if (!dispatch.id || !uuidRegex.test(dispatch.id)) {
      console.error('Dispatch has invalid ID:', dispatch.id);
      toast.error('Selected dispatch has invalid ID. Please refresh and try again.');
      return;
    }
    
    setSelectedDispatch(dispatch);
    
    // Debug: Log size breakdown data
    console.log('Selected dispatch size breakdown:', dispatch.size_breakdown);
    console.log('Size breakdown keys:', dispatch.size_breakdown ? Object.keys(dispatch.size_breakdown) : 'No size breakdown');
    console.log('Size breakdown entries:', dispatch.size_breakdown ? Object.entries(dispatch.size_breakdown) : 'No size breakdown');
    
    // Pre-fill form with expected values from dispatch
    setFormData(prev => ({
      ...prev,
      dispatchId: dispatch.id, // Ensure we use the actual dispatch ID
      outletId: dispatch.outlet_order?.outlet?.name || '',
      actualWeight: dispatch.total_weight?.toString() || '',
      actualValue: dispatch.total_value?.toString() || '',
      condition: 'good' // Default condition
    }));
  };

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchReceivingRecords();
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchReceivingRecords();
  }, []);

  // Load dispatches when dialog opens
  useEffect(() => {
    if (isNewReceivingOpen) {
      loadAvailableDispatches();
    }
  }, [isNewReceivingOpen]);
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-emerald-500 text-white';
      case 'disputed': return 'bg-red-500 text-white';
      case 'pending': return 'bg-amber-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'bg-green-500 text-white';
      case 'good': return 'bg-blue-500 text-white';
      case 'fair': return 'bg-orange-500 text-white';
      case 'poor': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const formatKES = (amount: number) => {
    return `KES ${amount.toLocaleString()}`;
  };

  const getDiscrepancy = (expected: number, actual: number) => {
    const diff = actual - expected;
    const percentage = expected > 0 ? ((diff / expected) * 100).toFixed(1) : '0';
    return { diff, percentage };
  };

  const formatSizeDiscrepancies = (discrepancies?: { [size: number]: number }) => {
    if (!discrepancies) return 'No size discrepancies';
    const items = Object.entries(discrepancies)
      .filter(([_, diff]) => diff !== 0)
      .map(([size, diff]) => `Size ${size}: ${diff > 0 ? '+' : ''}${diff}`);
    return items.length > 0 ? items.join(', ') : 'No size discrepancies';
  };

  const stats = {
    totalReceivings: receivingRecords.length,
    confirmed: receivingRecords.filter(r => r.status === 'confirmed').length,
    disputed: receivingRecords.filter(r => r.status === 'disputed').length,
    totalValue: receivingRecords.reduce((sum, record) => sum + (record.actual_value_received || 0), 0),
    totalWeight: receivingRecords.reduce((sum, record) => sum + (record.actual_weight_received || 0), 0)
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 content-container responsive-padding">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-green-500 to-blue-600 rounded-2xl shadow-lg">
                <CheckSquare className="h-10 w-10 text-white" />
              </div>
              Outlet Receiving Records
            </h1>
            <p className="text-xl text-gray-600 ml-16">Track what outlets received • Size-based verification • Quality control</p>
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
            <Dialog open={isNewReceivingOpen} onOpenChange={setIsNewReceivingOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white px-8 py-4 rounded-2xl font-semibold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                  <Plus className="h-6 w-6 mr-3" />
                  Record Receiving
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-gray-900">Record Outlet Receiving</DialogTitle>
                  <p className="text-sm text-gray-600 mt-2">
                    Fields marked with <span className="text-red-500">*</span> are required
                  </p>
                </DialogHeader>
                <div className="space-y-6 py-6">
                  <div className="space-y-3">
                    <Label className="text-base font-semibold text-gray-700">
                      Select Dispatch <span className="text-red-500">*</span>
                    </Label>
                    <Select 
                      value={formData.dispatchId} 
                      onValueChange={handleDispatchSelection}
                    >
                      <SelectTrigger className="h-14 text-base">
                        <SelectValue placeholder="Select dispatch to receive" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDispatches.map((dispatch) => (
                          <SelectItem key={dispatch.id} value={dispatch.id}>
                            {dispatch.outlet_order?.order_number || `ORD-${dispatch.id?.slice(-6)}`} - {dispatch.destination} 
                            {dispatch.total_weight > 0 ? (
                              ` (${dispatch.total_weight}kg)`
                            ) : (
                              ' (Not picked yet)'
                            )}
                            {' '}- {dispatch.status.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedDispatch && (
                    <div className="bg-blue-50 p-4 rounded-2xl border-l-4 border-blue-400">
                      <h4 className="font-semibold text-blue-900 mb-2">Dispatch Details</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Outlet:</span> {selectedDispatch.outlet_order?.outlet?.name || selectedDispatch.destination}
                        </div>
                        <div>
                          <span className="font-medium">Location:</span> {selectedDispatch.outlet_order?.outlet?.location || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Order Number:</span> {selectedDispatch.outlet_order?.order_number || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Status:</span> 
                          <span className={`ml-1 px-2 py-1 rounded text-xs font-medium ${
                            selectedDispatch.status === 'dispatched' ? 'bg-green-100 text-green-800' :
                            selectedDispatch.status === 'in-transit' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {selectedDispatch.status.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Expected Weight:</span> 
                          <span className={`font-medium ${selectedDispatch.total_weight > 10000 ? 'text-red-600' : 'text-green-600'}`}>
                            {selectedDispatch.total_weight}kg
                            {selectedDispatch.total_weight > 10000 && <span className="text-xs text-red-500 ml-1">⚠️</span>}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Expected Value:</span> 
                          <span className={`font-medium ${(selectedDispatch.total_value || 0) > 1000000 ? 'text-red-600' : 'text-gray-900'}`}>
                            KES {(selectedDispatch.total_value || selectedDispatch.outlet_order?.total_value || 0).toLocaleString()}
                            {(selectedDispatch.total_value || 0) > 1000000 && <span className="text-xs text-red-500 ml-1">⚠️</span>}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Dispatch Date:</span> {new Date(selectedDispatch.dispatch_date).toLocaleDateString()}
                        </div>
                        {selectedDispatch.assigned_driver && (
                          <div>
                            <span className="font-medium">Driver:</span> {selectedDispatch.assigned_driver}
                          </div>
                        )}
                        {selectedDispatch.picking_date && (
                          <div>
                            <span className="font-medium">Picking Date:</span> {new Date(selectedDispatch.picking_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      {selectedDispatch.size_breakdown && Object.keys(selectedDispatch.size_breakdown).length > 0 ? (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-blue-900">Size Breakdown Available:</span>
                            <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
                              {Object.keys(selectedDispatch.size_breakdown).length} sizes
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(selectedDispatch.size_breakdown).map(([size, quantity]) => (
                              <span key={size} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-sm font-medium border border-blue-300">
                                Size {size}: {quantity}kg
                              </span>
                            ))}
                          </div>
                          <div className="mt-2 text-xs text-blue-700">
                            ⚠️ Size discrepancies must be filled below before submitting
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600">
                          No size breakdown data available for this dispatch
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-base font-semibold text-gray-700">
                        Weight Received (kg) <span className="text-red-500">*</span>
                      </Label>
                      <Input 
                        type="number" 
                        step="0.1" 
                        placeholder="202.5" 
                        className="h-14 text-base"
                        value={formData.actualWeight}
                        onChange={(e) => setFormData({...formData, actualWeight: e.target.value})}
                      />
                      {selectedDispatch && formData.actualWeight && (
                        <div className="text-sm space-y-1">
                          <div className="text-gray-600">
                            Expected: {selectedDispatch.total_weight}kg
                          </div>
                          {(() => {
                            const expected = selectedDispatch.total_weight || 0;
                            const actual = parseFloat(formData.actualWeight) || 0;
                            const remaining = expected - actual;
                            const diff = actual - expected;
                            const diffPercent = expected > 0 ? ((diff / expected) * 100).toFixed(1) : '0';
                            const isSignificant = Math.abs(diff) > (expected * 0.1); // 10% threshold
                            
                            return (
                              <div className="space-y-1">
                                <div className={`${isSignificant ? 'text-orange-600 font-medium' : 'text-green-600'}`}>
                                  {diff > 0 ? `+${diff.toFixed(1)}kg (${diffPercent}% over)` : 
                                   diff < 0 ? `${diff.toFixed(1)}kg (${diffPercent}% under)` : 
                                   'Exact match'}
                                </div>
                                <div className="text-blue-600 font-medium">
                                  Remaining: {remaining > 0 ? remaining.toFixed(1) : 0}kg
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-base font-semibold text-gray-700">
                        Value Received (KES) <span className="text-red-500">*</span>
                      </Label>
                      <Input 
                        type="number" 
                        placeholder="101250" 
                        className="h-14 text-base"
                        value={formData.actualValue}
                        onChange={(e) => setFormData({...formData, actualValue: e.target.value})}
                      />
                      {selectedDispatch && formData.actualValue && (
                        <div className="text-sm">
                          <span className="text-gray-600">Expected: KES {selectedDispatch.total_value?.toLocaleString()}</span>
                          {(() => {
                            const expected = selectedDispatch.total_value || 0;
                            const actual = parseFloat(formData.actualValue) || 0;
                            const diff = actual - expected;
                            const diffPercent = expected > 0 ? ((diff / expected) * 100).toFixed(1) : '0';
                            const isSignificant = Math.abs(diff) > (expected * 0.1); // 10% threshold
                            return (
                              <span className={`ml-2 ${isSignificant ? 'text-orange-600 font-medium' : 'text-green-600'}`}>
                                ({diff > 0 ? '+' : ''}KES {diff.toLocaleString()}, {diffPercent}%)
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <Label className="text-base font-semibold text-gray-700">
                        Quality Condition <span className="text-red-500">*</span>
                      </Label>
                      <Select 
                        value={formData.condition} 
                        onValueChange={(value) => setFormData({...formData, condition: value})}
                      >
                        <SelectTrigger className="h-14 text-base">
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="excellent">🟢 Excellent - Perfect condition</SelectItem>
                          <SelectItem value="good">🔵 Good - Minor issues</SelectItem>
                          <SelectItem value="fair">🟡 Fair - Some quality concerns</SelectItem>
                          <SelectItem value="poor">🔴 Poor - Significant quality issues</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="text-base font-semibold text-gray-700">Received By</Label>
                    <Input 
                      placeholder="Staff member name" 
                      className="h-14 text-base bg-gray-50"
                      value={formData.receivedBy}
                      readOnly
                      title="Automatically set to logged-in user"
                    />
                  </div>
                  
                  {selectedDispatch?.size_breakdown && (
                    <div className="space-y-3">
                      <Label className="text-base font-semibold text-gray-700">
                        Size Discrepancies <span className="text-red-500">*</span>
                      </Label>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-blue-600" />
                          <div className="text-sm text-blue-800 font-medium">
                            This dispatch has size breakdown data. Please fill in the actual quantities received for each size.
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries(selectedDispatch.size_breakdown).map(([size, expectedQuantity]) => (
                          <div key={size} className="space-y-2">
                            <Label className="text-sm font-medium text-gray-600">Size {size} (Expected: {expectedQuantity}kg)</Label>
                            <Input 
                              type="number" 
                              step="0.1" 
                              placeholder="Actual received"
                              className="h-10 text-sm"
                              onChange={(e) => {
                                const actual = parseFloat(e.target.value) || 0;
                                const discrepancy = actual - (expectedQuantity as number);
                                setFormData(prev => ({
                                  ...prev,
                                  sizeDiscrepancies: {
                                    ...prev.sizeDiscrepancies,
                                    [parseInt(size)]: discrepancy
                                  }
                                }));
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      
                      {/* Size weight validation display */}
                      {Object.keys(formData.sizeDiscrepancies).length > 0 && (
                        <div className="mt-4 p-3 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Size Breakdown Total:</span>
                            <span className="text-sm font-bold text-blue-600">
                              {calculateTotalSizeWeight().toFixed(1)} kg
                            </span>
                          </div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Total Weight Received:</span>
                            <span className="text-sm font-bold text-green-600">
                              {parseFloat(formData.actualWeight || '0').toFixed(1)} kg
                            </span>
                          </div>
                          {(() => {
                            const totalSizeWeight = calculateTotalSizeWeight();
                            const actualWeight = parseFloat(formData.actualWeight || '0');
                            const difference = Math.abs(totalSizeWeight - actualWeight);
                            const isMatch = difference <= 0.1;
                            
                            return (
                              <div className={`flex items-center justify-between p-2 rounded ${
                                isMatch ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                              }`}>
                                <span className="text-sm font-medium">Match Status:</span>
                                <span className={`text-sm font-bold ${isMatch ? 'text-green-600' : 'text-red-600'}`}>
                                  {isMatch ? '✅ Match' : `❌ ${difference.toFixed(1)}kg difference`}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <Label className="text-base font-semibold text-gray-700">Quality & Discrepancy Notes</Label>
                    <Textarea 
                      placeholder="Any quality issues, missing items, or other discrepancies..." 
                      className="h-24 text-base"
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    />
                  </div>
                  
                  <div className="flex flex-col gap-4 pt-6">
                    {!isFormValid() && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <div className="text-sm text-amber-800 font-medium">
                            {(() => {
                              const totalSizeWeight = calculateTotalSizeWeight();
                              const actualWeight = parseFloat(formData.actualWeight || '0');
                              const sizeDifference = Math.abs(totalSizeWeight - actualWeight);
                              const hasSizeBreakdown = selectedDispatch?.size_breakdown && Object.keys(selectedDispatch.size_breakdown).length > 0;
                              const hasSizeDiscrepancies = Object.keys(formData.sizeDiscrepancies).length > 0;
                              
                              if (hasSizeBreakdown && !hasSizeDiscrepancies) {
                                return 'This dispatch has size breakdown data. Please fill in the size discrepancies section below.';
                              } else if (totalSizeWeight > 0 && sizeDifference > 0.1) {
                                return `Size breakdown total (${totalSizeWeight.toFixed(1)}kg) does not match total weight (${actualWeight.toFixed(1)}kg). Please adjust the values.`;
                              } else {
                                return 'Please fill in all required fields to continue';
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end gap-4">
                      <Button variant="outline" onClick={() => setIsNewReceivingOpen(false)} className="px-8 py-3 text-base">
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || !isFormValid()}
                        className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 px-8 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Recording...
                          </>
                        ) : (
                          'Record Receiving'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div> {/* closes flex gap-4 */}
        </div>   {/* closes header flex container */}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card className="border-0 shadow-xl bg-gradient-to-br from-green-50 to-emerald-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-green-600 uppercase tracking-wide">Total Records</p>
                  <p className="text-4xl font-bold text-green-900 mt-2">{stats.totalReceivings}</p>
                </div>
                <div className="p-4 bg-green-600 rounded-2xl shadow-lg">
                  <CheckSquare className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-50 to-green-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wide">Confirmed</p>
                  <p className="text-4xl font-bold text-emerald-900 mt-2">{stats.confirmed}</p>
                </div>
                <div className="p-4 bg-emerald-600 rounded-2xl shadow-lg">
                  <CheckCircle className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-red-50 to-red-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-600 uppercase tracking-wide">Disputed</p>
                  <p className="text-4xl font-bold text-red-900 mt-2">{stats.disputed}</p>
                </div>
                <div className="p-4 bg-red-600 rounded-2xl shadow-lg">
                  <AlertTriangle className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-50 to-blue-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Total Weight</p>
                  <p className="text-4xl font-bold text-blue-900 mt-2">{stats.totalWeight.toFixed(1)}</p>
                  <p className="text-sm text-blue-600">kg</p>
                </div>
                <div className="p-4 bg-blue-600 rounded-2xl shadow-lg">
                  <Scale className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-purple-50 to-purple-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-purple-600 uppercase tracking-wide">Total Value</p>
                  <p className="text-3xl font-bold text-purple-900 mt-2">{formatKES(stats.totalValue)}</p>
                </div>
                <div className="p-4 bg-purple-600 rounded-2xl shadow-lg">
                  <Calculator className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Receiving Records */}
        <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-3xl">
            <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Ruler className="h-8 w-8 text-green-600" />
              Receiving Records by Size
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading receiving records...</p>
              </div>
            ) : receivingRecords.length === 0 ? (
              <div className="text-center py-12">
                <CheckSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No receiving records found</h3>
                <p className="text-gray-500">Start by recording your first outlet receiving</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(organizeRecordsByOutlet(receivingRecords)).map(([outletName, records]) => (
                  <div key={outletName} className="border-2 border-gray-100 rounded-3xl p-6 hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-white to-gray-50">
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleOutletExpansion(outletName)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                          <MapPin className="h-6 w-6 text-blue-600" />
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">{outletName}</h3>
                            <p className="text-sm text-gray-500">{records[0]?.dispatch?.outlet_order?.outlet?.location || 'Unknown Location'}</p>
                          </div>
                        </div>
                        <Badge className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                          {records.length} {records.length === 1 ? 'Order' : 'Orders'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Total Received: {records.reduce((sum, r) => sum + (r.actual_weight_received || 0), 0).toFixed(1)} kg</span>
                        <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${expandedOutlets.has(outletName) ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                    
                    {expandedOutlets.has(outletName) && (
                      <div className="mt-6 space-y-4">
                        {records.map((record, index) => {
                          const weightDiscrepancy = getDiscrepancy(record.expected_weight || 0, record.actual_weight_received || 0);
                          const valueDiscrepancy = getDiscrepancy(record.expected_value || 0, record.actual_value_received || 0);
                          
                          return (
                            <div key={record.id} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-200">
                              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                                <div className="flex-1 space-y-4">
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-3">
                                      <CheckSquare className="h-5 w-5 text-green-600" />
                                      <span className="text-lg font-bold text-gray-900">{generateDisplayId(record.displayIndex || index)}</span>
                                    </div>
                                    <Badge className={`text-sm font-semibold px-3 py-1 rounded-xl ${getStatusColor(record.status)}`}>
                                      {record.status.toUpperCase()}
                                    </Badge>
                                    <Badge className={`text-sm font-semibold px-3 py-1 rounded-xl ${getConditionColor(record.condition)}`}>
                                      {record.condition.toUpperCase()}
                                    </Badge>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="flex items-center gap-3 text-gray-700">
                                      <Fish className="h-4 w-4 text-green-500" />
                                      <div>
                                        <div className="text-sm font-medium">Order: {record.dispatch?.outlet_order?.order_number || `ORD-${record.dispatch_id?.slice(-6)}`}</div>
                                        <div className="text-xs text-gray-500">Dispatch: {record.dispatch?.destination || `DSP-${record.dispatch_id?.slice(-6)}`}</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-gray-700">
                                      <CheckCircle className="h-4 w-4 text-purple-500" />
                                      <span className="text-sm font-medium">By: {record.received_by_user ? `${record.received_by_user.first_name} ${record.received_by_user.last_name}` : 'Unknown'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-gray-700">
                                      <Clock className="h-4 w-4 text-orange-500" />
                                      <span className="text-sm font-medium">{new Date(record.received_date).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-gray-700">
                                      <Weight className="h-4 w-4 text-blue-500" />
                                      <span className="text-sm font-medium">{record.actual_weight_received || 0} kg</span>
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-gray-50 rounded-xl p-4">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Weight className="h-4 w-4 text-blue-600" />
                                        <span className="font-semibold text-gray-900 text-sm">Weight</span>
                                      </div>
                                      <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                          <span className="text-gray-600">Expected:</span>
                                          <span className="font-medium">{record.expected_weight || 0} kg</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                          <span className="text-gray-600">Received:</span>
                                          <span className="font-medium text-green-600">{record.actual_weight_received || 0} kg</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                          <span className="text-gray-600">Diff:</span>
                                          <span className={`font-medium ${weightDiscrepancy.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {weightDiscrepancy.diff >= 0 ? '+' : ''}{weightDiscrepancy.diff.toFixed(2)} kg
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    
                                    <div className="bg-gray-50 rounded-xl p-4">
                                      <div className="flex items-center gap-2 mb-2">
                                        <DollarSign className="h-4 w-4 text-purple-600" />
                                        <span className="font-semibold text-gray-900 text-sm">Value</span>
                                      </div>
                                      <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                          <span className="text-gray-600">Expected:</span>
                                          <span className="font-medium">KSh {(record.expected_value || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                          <span className="text-gray-600">Received:</span>
                                          <span className="font-medium text-green-600">KSh {(record.actual_value_received || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                          <span className="text-gray-600">Diff:</span>
                                          <span className={`font-medium ${valueDiscrepancy.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {valueDiscrepancy.diff >= 0 ? '+' : ''}KSh {valueDiscrepancy.diff.toLocaleString()}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {record.discrepancy_notes && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                                      <div className="flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                                        <div>
                                          <div className="font-semibold text-yellow-800 text-sm mb-1">Discrepancy Notes</div>
                                          <div className="text-xs text-yellow-700">{record.discrepancy_notes}</div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex flex-col gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="h-10 px-4 border-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300"
                                    onClick={() => handleViewDetails(record)}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Details
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="h-10 px-4 border-2 border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300"
                                  >
                                    <SquarePen className="h-4 w-4 mr-2" />
                                    Edit
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Eye className="h-6 w-6 text-blue-600" />
              Receiving Record Details - {selectedRecord && generateDisplayId(0)}
            </DialogTitle>
          </DialogHeader>
          
          {selectedRecord && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-4 rounded-xl">
                  <h3 className="font-semibold text-blue-900 mb-3">Outlet Information</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Name:</span> {selectedRecord.dispatch?.outlet_order?.outlet?.name || 'Unknown'}</div>
                    <div><span className="font-medium">Location:</span> {selectedRecord.dispatch?.outlet_order?.outlet?.location || 'Unknown'}</div>
                    <div><span className="font-medium">Order Number:</span> {selectedRecord.dispatch?.outlet_order?.order_number || 'N/A'}</div>
                  </div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-xl">
                  <h3 className="font-semibold text-green-900 mb-3">Receiving Information</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Received By:</span> {selectedRecord.received_by_user ? `${selectedRecord.received_by_user.first_name} ${selectedRecord.received_by_user.last_name}` : 'Unknown'}</div>
                    <div><span className="font-medium">Date:</span> {new Date(selectedRecord.received_date).toLocaleDateString()}</div>
                    <div><span className="font-medium">Status:</span> <Badge className={getStatusColor(selectedRecord.status)}>{selectedRecord.status.toUpperCase()}</Badge></div>
                  </div>
                </div>
              </div>

              {/* Weight & Value Comparison */}
              <div className="grid grid-cols-1 gap-6">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Weight className="h-5 w-5 text-blue-600" />
                    Weight Details
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expected Weight:</span>
                      <span className="font-medium">{selectedRecord.expected_weight || 0} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Actual Weight:</span>
                      <span className="font-medium text-green-600">{selectedRecord.actual_weight_received || 0} kg</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-600">Difference:</span>
                      <span className={`font-medium ${(selectedRecord.actual_weight_received || 0) >= (selectedRecord.expected_weight || 0) ? 'text-green-600' : 'text-red-600'}`}>
                        {((selectedRecord.actual_weight_received || 0) - (selectedRecord.expected_weight || 0)) >= 0 ? '+' : ''}{((selectedRecord.actual_weight_received || 0) - (selectedRecord.expected_weight || 0)).toFixed(2)} kg
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Value Details */}
              <div className="bg-purple-50 p-4 rounded-xl">
                <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                  Value Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-sm text-gray-600">Expected Value</div>
                    <div className="text-lg font-bold text-gray-900">KSh {(selectedRecord.expected_value || 0).toLocaleString()}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600">Actual Value</div>
                    <div className="text-lg font-bold text-green-600">KSh {(selectedRecord.actual_value_received || 0).toLocaleString()}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600">Difference</div>
                    <div className={`text-lg font-bold ${((selectedRecord.actual_value_received || 0) - (selectedRecord.expected_value || 0)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {((selectedRecord.actual_value_received || 0) - (selectedRecord.expected_value || 0)) >= 0 ? '+' : ''}KSh {((selectedRecord.actual_value_received || 0) - (selectedRecord.expected_value || 0)).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Condition & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-orange-50 p-4 rounded-xl">
                  <h3 className="font-semibold text-orange-900 mb-3">Condition</h3>
                  <Badge className={getConditionColor(selectedRecord.condition)}>
                    {selectedRecord.condition.toUpperCase()}
                  </Badge>
                </div>

                {selectedRecord.discrepancy_notes && (
                  <div className="bg-yellow-50 p-4 rounded-xl">
                    <h3 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      Discrepancy Notes
                    </h3>
                    <p className="text-sm text-yellow-800">{selectedRecord.discrepancy_notes}</p>
                  </div>
                )}
              </div>

              {/* Size Discrepancies */}
              {selectedRecord.size_discrepancies && (
                <div className="bg-gray-50 p-4 rounded-xl">
                  <h3 className="font-semibold text-gray-900 mb-3">Size Discrepancies</h3>
                  <div className="text-sm text-gray-700">{formatSizeDiscrepancies(selectedRecord.size_discrepancies)}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
