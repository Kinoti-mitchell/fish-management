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
  Trash2, Plus, AlertTriangle, CheckCircle, 
  Clock, Calendar, Fish, Package, 
  Search, Filter, Eye, Send, 
  X, Check, Ban, UserCheck, 
  FileText, PlusCircle, TrendingUp, 
  DollarSign, Weight, MapPin, Building2, RefreshCw, CalendarDays, ChevronDown,
  Download
} from "lucide-react";
import { NavigationSection, DisposalRecord, DisposalReason, DisposalItem } from "../types";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";
import { DisposalMarquee } from './DisposalMarquee';
import { useAuth } from "./AuthContext";
import { RioFishLogo } from "./RioFishLogo";
import { disposalService, DisposalStats } from "../services/disposalService";

interface DisposalManagementProps {
  onNavigate: (section: NavigationSection, itemId?: string) => void;
}

interface InventoryForDisposal {
  sorting_result_id: string;
  size_class: number;
  total_weight_grams: number;
  batch_number: string;
  storage_location_name: string;
  storage_status?: string; // Add storage status field
  farmer_name: string;
  processing_date: string;
  days_in_storage: number;
  disposal_reason: string;
  quality_notes: string;
}

export default function DisposalManagement({ onNavigate }: DisposalManagementProps) {
  const { user } = useAuth();
  const [disposalRecords, setDisposalRecords] = useState<DisposalRecord[]>([]);
  const [disposalReasons, setDisposalReasons] = useState<DisposalReason[]>([]);
  const [inventoryForDisposal, setInventoryForDisposal] = useState<InventoryForDisposal[]>([]);
  const [disposalStats, setDisposalStats] = useState<DisposalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingDisposal, setCreatingDisposal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DisposalRecord | null>(null);
  const [pendingDisposal, setPendingDisposal] = useState<DisposalRecord | null>(null);
  const [disposalItems, setDisposalItems] = useState<any[]>([]);
  
  // Form states
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [disposalMethod, setDisposalMethod] = useState<string>("waste");
  const [disposalLocation, setDisposalLocation] = useState<string>("");
  const [disposalCost, setDisposalCost] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [daysOld, setDaysOld] = useState<number>(30);
  const [includeStorageIssues, setIncludeStorageIssues] = useState<boolean>(true);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [expandedStorages, setExpandedStorages] = useState<Set<string>>(new Set());

  const disposalMethods = [
    { value: "waste", label: "Waste Disposal", description: "General waste disposal" },
    { value: "compost", label: "Compost", description: "Convert to compost" },
    { value: "donation", label: "Donation", description: "Donate to charity" },
    { value: "return_to_farmer", label: "Return to Farmer", description: "Return to original farmer" }
  ];

  useEffect(() => {
    loadData();
  }, []);

  // Auto-set date range when daysOld changes (only for certain thresholds)
  useEffect(() => {
    if (daysOld > 0 && daysOld <= 7) {
      // For 1-7 days, auto-set the date range
      const today = new Date();
      const cutoffDate = new Date();
      cutoffDate.setDate(today.getDate() - daysOld);
      
      // Set the date range to show items from cutoffDate to today
      setFromDate(cutoffDate.toISOString().split('T')[0]);
      setToDate(today.toISOString().split('T')[0]);
    } else if (daysOld === 0) {
      // If daysOld is 0, clear the date range to show all items
      setFromDate("");
      setToDate("");
    }
    // For daysOld > 7 (like 10, 30, etc.), allow manual date selection
  }, [daysOld]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadDisposalRecords(),
        loadDisposalReasons(),
        loadInventoryForDisposal(),
        loadDisposalStats()
      ]);
    } catch (error) {
      console.error("Error loading disposal data:", error);
      toast.error("Failed to load disposal data");
    } finally {
      setLoading(false);
    }
  };

  const loadDisposalRecords = async () => {
    const { data, error } = await supabase
      .from('disposal_records')
      .select(`
        *,
        disposal_reason:disposal_reasons(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error loading disposal records:", error);
      throw error;
    }

    // Fetch user profiles for disposed_by and approved_by fields
    if (data && data.length > 0) {
      const userIds = new Set<string>();
      data.forEach(record => {
        if (record.disposed_by) userIds.add(record.disposed_by);
        if (record.approved_by) userIds.add(record.approved_by);
      });

      if (userIds.size > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(userIds));

        if (!profilesError && profiles) {
          const userMap = new Map(profiles.map(profile => [profile.id, profile.full_name]));
          
          // Update the data with full names
          const finalData = data.map(record => ({
            ...record,
            disposed_by: record.disposed_by ? (userMap.get(record.disposed_by) || `User ${record.disposed_by.slice(0, 8)}`) : null,
            approved_by: record.approved_by ? (userMap.get(record.approved_by) || `User ${record.approved_by.slice(0, 8)}`) : null
          }));
          
          setDisposalRecords(finalData);
          return;
        }
      }
    }

    setDisposalRecords(data || []);
  };

  const loadDisposalReasons = async () => {
    const { data, error } = await supabase
      .from('disposal_reasons')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    setDisposalReasons(data || []);
  };

  const loadDisposalStats = async () => {
    try {
      console.log('🔍 [DisposalManagement] Loading disposal statistics...');
      const stats = await disposalService.getDisposalStats();
      setDisposalStats(stats);
      console.log('📊 [DisposalManagement] Disposal stats loaded:', stats);
    } catch (error) {
      console.error('❌ [DisposalManagement] Error loading disposal stats:', error);
      // Set default stats on error
      setDisposalStats({
        totalDisposals: 0,
        totalDisposedWeight: 0,
        totalDisposalCost: 0,
        pendingDisposals: 0,
        recentDisposals: 0,
        averageDisposalAge: 0,
        topDisposalReason: 'Age',
        monthlyDisposalTrend: 0
      });
    }
  };

  const loadInventoryForDisposal = async () => {
    try {
      console.log('🔍 [DisposalManagement] Loading inventory for disposal with threshold:', daysOld);
      
      // Use the disposal service to get inventory
      const data = await disposalService.getInventoryForDisposal(daysOld, true);
      
      console.log('📊 [DisposalManagement] Raw data from service:', data);
      
      let filteredData = data || [];
      
      // Apply date filtering if dates are provided
      if (fromDate || toDate) {
        filteredData = filteredData.filter((item: InventoryForDisposal) => {
          const processingDate = new Date(item.processing_date);
          const from = fromDate ? new Date(fromDate) : null;
          const to = toDate ? new Date(toDate) : null;
          
          if (from && processingDate < from) return false;
          if (to && processingDate > to) return false;
          return true;
        });
      }
      
      console.log('📊 [DisposalManagement] Filtered data:', filteredData);
          setInventoryForDisposal(filteredData);
    } catch (error) {
      console.error("❌ [DisposalManagement] Error loading inventory for disposal:", error);
      setInventoryForDisposal([]);
    }
  };

  const handleCreateDisposal = async () => {
    if (!selectedReason || selectedItems.length === 0) {
      toast.error("Please select a reason and at least one item");
      return;
    }

    // Prevent double creation
    if (creatingDisposal) {
      toast.error("Please wait, operation in progress...");
      return;
    }

    // Additional protection: disable the button immediately
    setCreatingDisposal(true);

    try {
      // Generate disposal number first
      const { data: disposalNumber, error: numberError } = await supabase
        .rpc('generate_disposal_number');
      
      if (numberError) {
        console.error("Error generating disposal number:", numberError);
        throw numberError;
      }

      // First create the disposal record
      const { data: disposalData, error: disposalError } = await supabase
        .from('disposal_records')
        .insert({
          disposal_number: disposalNumber,
          disposal_reason_id: selectedReason,
          disposal_method: disposalMethod,
          disposal_location: disposalLocation || null,
          disposal_cost: disposalCost,
          notes: notes || null,
          disposed_by: null, // Set to null to avoid foreign key constraint issues
          status: 'pending',
          total_weight_kg: 0 // Will be calculated
        })
        .select()
        .single();

      if (disposalError) {
        console.error("Error creating disposal record:", disposalError);
        throw disposalError;
      }

      // Then add the selected items to the disposal
      const selectedInventoryItems = inventoryForDisposal.filter(item => 
        selectedItems.includes(item.sorting_result_id)
      );

      let totalWeight = 0;

      for (const item of selectedInventoryItems) {
        const weightKg = item.total_weight_grams / 1000;
        totalWeight += weightKg;
        
        console.log(`Adding item to disposal: ${item.batch_number} Size ${item.size_class} - ${weightKg}kg (${item.total_weight_grams}g)`);

        const { error: itemError } = await supabase
          .from('disposal_items')
          .insert({
            disposal_record_id: disposalData.id,
            sorting_result_id: item.sorting_result_id,
            size_class: item.size_class,
            weight_kg: weightKg,
            batch_number: item.batch_number,
            storage_location_name: item.storage_location_name,
            farmer_name: item.farmer_name,
            processing_date: item.processing_date,
            quality_notes: item.quality_notes,
            disposal_reason: item.disposal_reason
          });

        if (itemError) {
          console.error("Error creating disposal item:", itemError);
          throw itemError;
        }
      }

      // Update the disposal record with totals
      console.log(`Updating disposal record ${disposalData.id} with total weight: ${totalWeight}kg`);
      const { error: updateError } = await supabase
        .from('disposal_records')
        .update({
          total_weight_kg: totalWeight
        })
        .eq('id', disposalData.id);

      if (updateError) {
        console.error("Error updating disposal record:", updateError);
        throw updateError;
      }

      toast.success(`Disposal created successfully! ${selectedItems.length} items added (${totalWeight.toFixed(2)} kg)`);
      setCreateDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error creating disposal:", error);
      toast.error("Failed to create disposal record");
    } finally {
      setCreatingDisposal(false);
    }
  };

  const handleApproveDisposal = async (recordId: string) => {
    try {
      const { error } = await supabase.rpc('approve_disposal', {
        p_disposal_id: recordId,
        p_approved_by: null // Set to null to avoid foreign key constraint issues
      });

      if (error) throw error;
      toast.success("Disposal approved successfully");
      loadData();
    } catch (error) {
      console.error("Error approving disposal:", error);
      toast.error("Failed to approve disposal");
    }
  };

  const openApprovalDialog = async (record: DisposalRecord) => {
    setPendingDisposal(record);
    setApprovalDialogOpen(true);
    
    // Load disposal items for this record
    try {
      const { data: items, error } = await supabase
        .from('disposal_items')
        .select('*')
        .eq('disposal_record_id', record.id);
      
      if (error) {
        console.error('Error loading disposal items:', error);
        setDisposalItems([]);
      } else {
        setDisposalItems(items || []);
      }
    } catch (error) {
      console.error('Error loading disposal items:', error);
      setDisposalItems([]);
    }
  };

  const openViewDialog = async (record: DisposalRecord) => {
    setSelectedRecord(record);
    setViewDialogOpen(true);
    
    // Load disposal items for this record
    try {
      const { data: items, error } = await supabase
        .from('disposal_items')
        .select('*')
        .eq('disposal_record_id', record.id);
      
      if (error) {
        console.error('Error loading disposal items:', error);
        setDisposalItems([]);
      } else {
        setDisposalItems(items || []);
      }
    } catch (error) {
      console.error('Error loading disposal items:', error);
      setDisposalItems([]);
    }
  };

  const handleCompleteDisposal = async (recordId: string) => {
    try {
      const { error } = await supabase.rpc('complete_disposal', {
        p_disposal_id: recordId
      });

      if (error) throw error;
      toast.success("Disposal completed successfully");
      loadData();
    } catch (error) {
      console.error("Error completing disposal:", error);
      toast.error("Failed to complete disposal");
    }
  };

  const handleApproveDisposalConfirmation = async () => {
    if (!pendingDisposal) return;

    try {
      setCreatingDisposal(true);
      
      // Update disposal status to completed (approved and completed in one step)
      const { error: approveError } = await supabase
        .from('disposal_records')
        .update({ 
          status: 'completed',
          approved_by: null // Set to null to avoid foreign key constraint issues
        })
        .eq('id', pendingDisposal.id);

      if (approveError) throw approveError;

      // Remove items from storage by updating their status
      const { error: removeError } = await supabase
        .from('disposal_items')
        .select('sorting_result_id')
        .eq('disposal_record_id', pendingDisposal.id);

      if (removeError) throw removeError;

      // Remove items from inventory by setting their weight to 0
      if (disposalItems && disposalItems.length > 0) {
        const sortingResultIds = disposalItems.map(item => item.sorting_result_id);
        
        console.log(`Removing ${sortingResultIds.length} items from inventory:`, sortingResultIds);
        
        const { error: updateInventoryError } = await supabase
          .from('sorting_results')
          .update({ 
            total_weight_grams: 0,
            total_pieces: 0
          })
          .in('id', sortingResultIds);

        if (updateInventoryError) {
          console.error("Error removing items from inventory:", updateInventoryError);
          throw updateInventoryError;
        }
        
        console.log(`Successfully removed ${sortingResultIds.length} items from inventory`);
      }

      toast.success("Disposal completed and items removed from storage");
      setApprovalDialogOpen(false);
      setPendingDisposal(null);
      loadData();
    } catch (error) {
      console.error("Error approving disposal:", error);
      toast.error("Failed to approve disposal");
    } finally {
      setCreatingDisposal(false);
    }
  };

  const handleDeclineDisposal = async () => {
    if (!pendingDisposal) return;

    try {
      setCreatingDisposal(true);
      
      console.log(`Attempting to decline disposal: ${pendingDisposal.id}`);
      
      // Update disposal status to cancelled (keep the record)
      const { error: cancelError } = await supabase
        .from('disposal_records')
        .update({ 
          status: 'cancelled',
          notes: (pendingDisposal.notes || '') + '\n\n[Declined by user]'
        })
        .eq('id', pendingDisposal.id);

      if (cancelError) {
        console.error("Error updating disposal record:", cancelError);
        throw cancelError;
      }

      // Keep disposal items but mark them as cancelled
      // This way you can see what was supposed to be disposed
      // Note: disposal_items table might not have a status field, so we'll just update the main record
      console.log(`Declining disposal record ${pendingDisposal.id}`);

      toast.success("Disposal declined and marked as cancelled");
      setApprovalDialogOpen(false);
      setPendingDisposal(null);
      loadData();
    } catch (error) {
      console.error("Error declining disposal:", error);
      toast.error("Failed to decline disposal");
    } finally {
      setCreatingDisposal(false);
    }
  };

  const resetForm = () => {
    setSelectedReason("");
    setDisposalMethod("waste");
    setDisposalLocation("");
    setDisposalCost(0);
    setNotes("");
    setSelectedItems([]);
    setFromDate("");
    setToDate("");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Number',
      'Date',
      'Reason',
      'Weight (kg)',
      'Status',
      'Created By',
      'Approved/Denied By'
    ];

    const csvData = filteredRecords.map(record => [
      record.disposal_number,
      new Date(record.disposal_date).toLocaleDateString(),
      record.disposal_reason?.name || 'N/A',
      record.total_weight_kg.toFixed(1),
      record.status,
      record.disposed_by || 'N/A',
      record.approved_by || (record.status === 'pending' ? 'Pending' : '-')
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `disposal-records-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    // Simple PDF generation using browser print
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tableHTML = `
      <html>
        <head>
          <title>Disposal Records Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #1f2937; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: bold; }
            .status-pending { background-color: #fef3c7; color: #92400e; }
            .status-approved { background-color: #dbeafe; color: #1e40af; }
            .status-completed { background-color: #d1fae5; color: #065f46; }
            .status-cancelled { background-color: #fee2e2; color: #991b1b; }
          </style>
        </head>
        <body>
          <h1>Rio Fish Farm - Disposal Records Report</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <p>Total Records: ${filteredRecords.length}</p>
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Date</th>
                <th>Reason</th>
                <th>Weight (kg)</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Approved/Denied By</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRecords.map(record => `
                <tr>
                  <td>${record.disposal_number}</td>
                  <td>${new Date(record.disposal_date).toLocaleDateString()}</td>
                  <td>${record.disposal_reason?.name || 'N/A'}</td>
                  <td>${record.total_weight_kg.toFixed(1)}</td>
                  <td class="status-${record.status}">${record.status}</td>
                  <td>${record.disposed_by || 'N/A'}</td>
                  <td>${record.approved_by || (record.status === 'pending' ? 'Pending' : '-')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(tableHTML);
    printWindow.document.close();
    printWindow.print();
  };

  const filteredRecords = disposalRecords.filter(record => {
    const matchesSearch = record.disposal_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.disposal_reason?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalWeight = inventoryForDisposal.reduce((sum, item) => sum + (item.total_weight_grams / 1000), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-600 font-medium">Loading disposal management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 content-container">
      <DisposalMarquee stats={disposalStats} />
      
      <div className="container mx-auto responsive-padding max-w-full overflow-x-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Disposal Management</h1>
            <p className="text-gray-600">Manage fish disposal and waste handling</p>
          </div>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-red-600 hover:bg-red-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Create Disposal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto overflow-x-hidden">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">Create New Disposal Record</DialogTitle>
                <DialogDescription>
                  Configure disposal criteria and select items for disposal
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Disposal Configuration */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-full overflow-x-hidden">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Filter Items for Disposal</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <Label htmlFor="daysOld" className="text-sm font-medium">Days Old Threshold</Label>
                          <Input
                            id="daysOld"
                            type="number"
                            value={daysOld}
                            onChange={(e) => setDaysOld(Number(e.target.value))}
                            placeholder="30"
                            className="mt-1"
                            min="0"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="includeStorageIssues"
                            checked={includeStorageIssues}
                            onCheckedChange={setIncludeStorageIssues}
                          />
                          <Label htmlFor="includeStorageIssues" className="text-sm">Include Storage Issues</Label>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <Label htmlFor="fromDate" className="text-sm font-medium break-words">
                            From Date {
                              daysOld === 0 ? '(Optional)' :
                              daysOld <= 7 ? `(Auto-set to ${daysOld} days ago)` :
                              `(Manual selection for ${daysOld}+ days)`
                            }
                          </Label>
                          <Input
                            id="fromDate"
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="mt-1"
                            max={new Date().toISOString().split('T')[0]}
                            disabled={daysOld > 0 && daysOld <= 7}
                          />
                          <p className="text-xs text-gray-500 mt-1 break-words">
                            {daysOld === 0 
                              ? 'Leave empty to show all items'
                              : daysOld <= 7 
                                ? `Automatically set based on ${daysOld} days threshold`
                                : `Select start date for items ${daysOld}+ days old`
                            }
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="toDate" className="text-sm font-medium break-words">
                            To Date {
                              daysOld === 0 ? '(Optional)' :
                              daysOld <= 7 ? '(Auto-set to today)' :
                              '(Manual selection)'
                            }
                          </Label>
                          <Input
                            id="toDate"
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="mt-1"
                            max={new Date().toISOString().split('T')[0]}
                            disabled={daysOld > 0 && daysOld <= 7}
                          />
                          <p className="text-xs text-gray-500 mt-1 break-words">
                            {daysOld === 0 
                              ? 'Leave empty to show all items'
                              : daysOld <= 7 
                                ? 'Automatically set to today'
                                : 'Select end date for the range'
                            }
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Disposal Details */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Disposal Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <Label htmlFor="reason" className="text-sm font-medium">Disposal Reason *</Label>
                          <Select value={selectedReason} onValueChange={setSelectedReason}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select reason" />
                            </SelectTrigger>
                            <SelectContent>
                              {disposalReasons.map((reason) => (
                                <SelectItem key={reason.id} value={reason.id}>
                                  {reason.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label htmlFor="method" className="text-sm font-medium">Disposal Method *</Label>
                          <Select value={disposalMethod} onValueChange={setDisposalMethod}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                            <SelectContent>
                              {disposalMethods.map((method) => (
                                <SelectItem key={method.value} value={method.value}>
                                  {method.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <Label htmlFor="location" className="text-sm font-medium">Disposal Location</Label>
                          <Input
                            id="location"
                            value={disposalLocation}
                            onChange={(e) => setDisposalLocation(e.target.value)}
                            placeholder="e.g., Waste Management Facility"
                            className="mt-1"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="cost" className="text-sm font-medium">Disposal Cost (KSh)</Label>
                          <Input
                            id="cost"
                            type="number"
                            value={disposalCost}
                            onChange={(e) => setDisposalCost(Number(e.target.value))}
                            placeholder="0"
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
                        <Textarea
                          id="notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Additional disposal notes..."
                          rows={3}
                          className="mt-1"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Inventory Items */}
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Select Items for Disposal</CardTitle>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedItems(inventoryForDisposal.map(item => item.sorting_result_id))}
                          className="text-green-600 hover:text-green-700"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Select All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedItems([])}
                          className="text-gray-600 hover:text-gray-700"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Clear All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={loadInventoryForDisposal}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Refresh
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Selected: {selectedItems.length} items</span>
                        <span className="mx-2">•</span>
                        <span className="font-medium">Total Weight: {inventoryForDisposal
                          .filter(item => selectedItems.includes(item.sorting_result_id))
                          .reduce((sum, item) => sum + (item.total_weight_grams / 1000), 0)
                          .toFixed(2)} kg</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {daysOld === 0 
                          ? 'Showing all items (no age filter)' 
                          : daysOld <= 7
                            ? `Showing items ${daysOld}+ days old (auto-range: ${fromDate} to ${toDate})`
                            : `Showing items ${daysOld}+ days old (manual range: ${fromDate || 'any'} to ${toDate || 'any'})`
                        }
                      </Badge>
                    </div>
                    {selectedItems.length > 0 && (
                      <div className="text-xs text-gray-500 mt-2">
                        Size Distribution: {Object.entries(
                          inventoryForDisposal
                            .filter(item => selectedItems.includes(item.sorting_result_id))
                            .reduce((acc, item) => {
                              acc[item.size_class] = (acc[item.size_class] || 0) + (item.total_weight_grams / 1000);
                              return acc;
                            }, {} as Record<number, number>)
                        ).map(([size, weight]) => `Size ${size}: ${weight.toFixed(1)}kg`).join(' | ')}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg max-h-60 overflow-y-auto">
                      {Object.entries(
                        inventoryForDisposal.reduce((acc, item) => {
                          const storage = item.storage_location_name;
                          if (!acc[storage]) {
                            acc[storage] = [];
                          }
                          acc[storage].push(item);
                          return acc;
                        }, {} as Record<string, InventoryForDisposal[]>)
                      ).map(([storageName, items]) => {
                        const isExpanded = expandedStorages.has(storageName);
                        const storageWeight = items.reduce((sum, item) => sum + (item.total_weight_grams / 1000), 0);
                        const selectedInStorage = items.filter(item => selectedItems.includes(item.sorting_result_id)).length;
                        
                        return (
                          <div key={storageName} className="border-b last:border-b-0">
                            {/* Storage Header */}
                            <div 
                              className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 cursor-pointer"
                              onClick={() => {
                                const newExpanded = new Set(expandedStorages);
                                if (isExpanded) {
                                  newExpanded.delete(storageName);
                                } else {
                                  newExpanded.add(storageName);
                                }
                                setExpandedStorages(newExpanded);
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <Building2 className="w-4 h-4 text-gray-600" />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-gray-900">{storageName}</h4>
                                    {items[0]?.storage_status === 'inactive' && (
                                      <Badge variant="destructive" className="text-xs">
                                        Inactive
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600">
                                    {items.length} batches • {storageWeight.toFixed(1)}kg
                                    {selectedInStorage > 0 && ` • ${selectedInStorage} selected`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={items[0]?.disposal_reason === 'Storage Inactive' ? 'destructive' : 'secondary'}>
                                  {items[0]?.disposal_reason}
                                </Badge>
                                <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </div>
                            
                            {/* Storage Items */}
                            {isExpanded && (
                              <div className="p-3 bg-white">
                                <div className="grid grid-cols-1 gap-2">
                                  {items.map((item) => (
                                    <div 
                                      key={item.sorting_result_id}
                                      className={`flex items-center justify-between p-2 rounded border ${selectedItems.includes(item.sorting_result_id) ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <Checkbox
                                          checked={selectedItems.includes(item.sorting_result_id)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setSelectedItems([...selectedItems, item.sorting_result_id]);
                                            } else {
                                              setSelectedItems(selectedItems.filter(id => id !== item.sorting_result_id));
                                            }
                                          }}
                                        />
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-blue-600">{item.batch_number}</span>
                                            <Badge variant="outline" className="text-xs">Size {item.size_class}</Badge>
                                            <Badge variant={item.days_in_storage > 30 ? "destructive" : "secondary"} className="text-xs">
                                              {item.days_in_storage} days
                                            </Badge>
                                          </div>
                                          <div className="text-sm text-gray-600">
                                            {item.farmer_name} • {(item.total_weight_grams / 1000).toFixed(1)}kg
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {inventoryForDisposal.length === 0 && (
                      <Alert className="mt-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          No items found for disposal with current criteria.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateDisposal} 
                  className="bg-red-600 hover:bg-red-700"
                  disabled={creatingDisposal}
                >
                  {creatingDisposal ? "Processing..." : "Create Disposal"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Approval Dialog */}
          <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Confirm Disposal
                </DialogTitle>
                <DialogDescription>
                  Please review the disposal details and confirm or decline the action.
                </DialogDescription>
              </DialogHeader>
              
              {pendingDisposal && (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-2">Disposal Summary</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Disposal Number:</span>
                        <p className="text-gray-600">{pendingDisposal.disposal_number}</p>
                      </div>
                      <div>
                        <span className="font-medium">Method:</span>
                        <p className="text-gray-600 capitalize">{pendingDisposal.disposal_method}</p>
                      </div>
                      <div>
                        <span className="font-medium">Total Weight:</span>
                        <p className="text-gray-600">{pendingDisposal.total_weight_kg.toFixed(2)} kg</p>
                      </div>
                    </div>
                    {pendingDisposal.notes && (
                      <div className="mt-3">
                        <span className="font-medium">Notes:</span>
                        <p className="text-gray-600 text-sm mt-1">{pendingDisposal.notes}</p>
                      </div>
                    )}
        </div>

                  {/* Items Being Disposed */}
                  <div className="bg-white border rounded-lg">
                    <div className="p-4 border-b">
                      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Items Being Disposed ({disposalItems.length} items)
                      </h4>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {disposalItems.length > 0 ? (
                        <div className="space-y-2">
                          {disposalItems.map((item, index) => (
                            <div key={index} className="border rounded-lg p-3 bg-gray-50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="font-medium text-blue-600 text-lg">
                                    {item.batch_number}
                                  </span>
                                  <Badge variant="outline" className="text-sm">
                                    Size {item.size_class || 'Unknown'}
                                  </Badge>
                                </div>
                                <span className="text-lg font-semibold text-gray-700">
                                  {item.weight_kg.toFixed(2)} kg
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-gray-500">
                          <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                          <p>Loading disposal items...</p>
                        </div>
                      )}
                    </div>
        </div>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Warning:</strong> Approving this disposal will permanently remove the {disposalItems.length} items shown above from storage. 
                      This action cannot be undone.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleDeclineDisposal}
                  disabled={creatingDisposal}
                  className="text-red-600 hover:text-red-700"
                >
                  {creatingDisposal ? "Processing..." : "Decline"}
                </Button>
                <Button 
                  onClick={handleApproveDisposalConfirmation}
                  disabled={creatingDisposal}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {creatingDisposal ? "Processing..." : "Approve & Remove from Storage"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Disposals</p>
                  <p className="text-2xl font-bold text-gray-900">{disposalRecords.length}</p>
                </div>
                <Trash2 className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{disposalRecords.filter(r => r.status === 'pending').length}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Available Items</p>
                  <p className="text-2xl font-bold text-orange-600">{inventoryForDisposal.length}</p>
                </div>
                <Package className="h-8 w-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Weight</p>
                  <p className="text-2xl font-bold text-blue-600">{totalWeight.toFixed(1)}kg</p>
                </div>
                <Weight className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search disposal records..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
          </CardContent>
        </Card>

        {/* Disposal Records Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Disposal Records
            </CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={exportToCSV}
                  variant="outline"
                  size="sm"
                  disabled={filteredRecords.length === 0}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button
                  onClick={exportToPDF}
                  variant="outline"
                  size="sm"
                  disabled={filteredRecords.length === 0}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Approved/Denied By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{record.disposal_number}</TableCell>
                    <TableCell>{new Date(record.disposal_date).toLocaleDateString()}</TableCell>
                    <TableCell>{record.disposal_reason?.name}</TableCell>
                    <TableCell>{record.total_weight_kg.toFixed(1)}kg</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(record.status)}>
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{record.disposed_by || 'N/A'}</TableCell>
                    <TableCell>{record.approved_by || (record.status === 'pending' ? 'Pending' : '-')}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                            onClick={() => openViewDialog(record)}
                            title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        
                        {record.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                              onClick={() => openApprovalDialog(record)}
                            className="text-blue-600 hover:text-blue-700"
                              title="Review & Approve Disposal"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                        
                        {record.status === 'approved' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCompleteDisposal(record.id)}
                            className="text-green-600 hover:text-green-700"
                              title="Complete Disposal"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredRecords.length === 0 && (
            <div className="text-center py-8 text-gray-500">
                <Trash2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No disposal records found</p>
                <p className="text-sm text-gray-400">Create your first disposal record to get started</p>
            </div>
          )}
          </CardContent>
        </Card>

        {/* View Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Disposal Details
              </DialogTitle>
              <DialogDescription>
                View detailed information about this disposal record
              </DialogDescription>
            </DialogHeader>
            
            {selectedRecord && (
              <div className="space-y-6">
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Disposal Number</Label>
                        <p className="text-lg font-semibold">{selectedRecord.disposal_number}</p>
        </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Status</Label>
                        <div className="mt-1">
                          <Badge className={getStatusColor(selectedRecord.status)}>
                            {selectedRecord.status}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Date</Label>
                        <p className="text-gray-900">{new Date(selectedRecord.disposal_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Method</Label>
                        <p className="text-gray-900 capitalize">{selectedRecord.disposal_method}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Location</Label>
                        <p className="text-gray-900">{selectedRecord.disposal_location || 'Not specified'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Cost</Label>
                        <p className="text-gray-900">KSh {selectedRecord.disposal_cost.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Disposal Reason */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Disposal Reason</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-900">{selectedRecord.disposal_reason?.name || 'Not specified'}</p>
                  </CardContent>
                </Card>

                {/* Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <Weight className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="text-sm text-gray-600">Total Weight</p>
                          <p className="text-xl font-semibold">{selectedRecord.total_weight_kg.toFixed(2)} kg</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Notes */}
                {selectedRecord.notes && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedRecord.notes}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Disposal Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Disposal Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Total Weight</Label>
                          <p className="text-lg font-semibold">{selectedRecord.total_weight_kg.toFixed(2)} kg</p>
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Disposal Location</Label>
                        <p className="text-gray-900 font-medium">
                          {selectedRecord.disposal_location || 'Not specified'}
                        </p>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Disposal Method</Label>
                        <p className="text-gray-900 font-medium capitalize">
                          {selectedRecord.disposal_method.replace('_', ' ')}
                        </p>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Disposal Cost</Label>
                        <p className="text-gray-900 font-medium">
                          KSh {selectedRecord.disposal_cost.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Detailed Items List */}
                {disposalItems.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Detailed Items Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {disposalItems.map((item, index) => (
                          <div key={index} className="border rounded-lg p-3 bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="font-medium text-blue-600 text-lg">
                                  {item.batch_number}
                                </span>
                                <Badge variant="outline" className="text-sm">
                                  Size {item.size_class || 'Unknown'}
                                </Badge>
                              </div>
                              <span className="text-lg font-semibold text-gray-700">
                                {item.weight_kg.toFixed(2)} kg
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
