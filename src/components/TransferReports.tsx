"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  ArrowRight,
  Download,
  RefreshCw,
  Search,
  Calendar,
  Package,
  Scale,
  AlertCircle,
  Loader2,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Home
} from "lucide-react";
import { inventoryService } from "../services/inventoryService";
import TransferApprovalDialog from "./TransferApprovalDialog";
import { useAuth } from "./AuthContext";

interface TransferRecord {
  id: string;
  from_storage: string;
  to_storage: string;
  size: number;
  quantity: number;
  weight_kg: number;
  notes: string;
  status: string;
  created_at: string;
  created_by: string;
  approved_by?: string;
  is_bulk?: boolean;
  batch_size?: number;
  batch_transfers?: any[];
  // Batch grouping fields
  batch_key?: string;
  is_batch?: boolean;
  batch_sizes?: number[];
  total_batch_quantity?: number;
  total_batch_weight?: number;
}

interface TransferReportsProps {
  onNavigate?: (section: string) => void;
}

export default function TransferReports({ onNavigate }: TransferReportsProps = {}) {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'declined'>('all');
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRecord | null>(null);

  // Function to group batch transfers
  const groupBatchTransfers = (transfers: TransferRecord[]): TransferRecord[] => {
    const grouped = new Map<string, TransferRecord[]>();
    const result: TransferRecord[] = [];

    // Group transfers by batch key (same from/to storage, created_at, and notes)
    transfers.forEach(transfer => {
      const batchKey = `${transfer.from_storage}-${transfer.to_storage}-${transfer.created_at}-${transfer.notes || ''}`;
      
      if (!grouped.has(batchKey)) {
        grouped.set(batchKey, []);
      }
      grouped.get(batchKey)!.push(transfer);
    });

    // Process each group
    grouped.forEach((batchTransfers) => {
      if (batchTransfers.length > 1) {
        // This is a batch - create a single grouped record
        const firstTransfer = batchTransfers[0];
        const totalQuantity = batchTransfers.reduce((sum, t) => sum + t.quantity, 0);
        const totalWeight = batchTransfers.reduce((sum, t) => sum + t.weight_kg, 0);
        const sizes = batchTransfers.map(t => t.size).sort((a, b) => a - b);

        const groupedTransfer: TransferRecord = {
          ...firstTransfer,
          id: `batch-${firstTransfer.id}`, // Use batch prefix for unique ID
          is_batch: true,
          batch_sizes: sizes,
          total_batch_quantity: totalQuantity,
          total_batch_weight: totalWeight,
          batch_transfers: batchTransfers,
          // Use the first transfer's size for display, but show all sizes
          size: sizes[0], // Will be overridden in display
        };

        result.push(groupedTransfer);
      } else {
        // Single transfer - add as is
        result.push(batchTransfers[0]);
      }
    });

    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const fetchTransferHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔍 Fetching transfer history...');
      const data = await inventoryService.getTransferHistory(200);
      console.log('📊 Transfer history data received:', data);
      console.log('📋 Data analysis:', {
        totalTransfers: data?.length || 0,
        hasData: data && data.length > 0,
        sampleTransfer: data?.[0] || null,
        allTransfers: data
      });
      
      // Group batch transfers
      const groupedData = groupBatchTransfers(data);
      console.log('📦 Grouped transfers:', groupedData);
      
      setTransfers(groupedData);
    } catch (err: any) {
      console.error("Error fetching transfer history:", err);
      setError(err.message || "Failed to fetch transfer history");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTransferHistory();
    setRefreshing(false);
  };

  const handleApproveTransfer = async (transferId: string, approvedBy: string) => {
    try {
      // For batch transfers, use the first transfer's ID (remove batch- prefix)
      const actualTransferId = transferId.startsWith('batch-') 
        ? transferId.replace('batch-', '') 
        : transferId;
        
      await inventoryService.approveTransfer(actualTransferId, approvedBy);
      await fetchTransferHistory(); // Refresh the list
      setApprovalDialogOpen(false);
      setSelectedTransfer(null);
    } catch (err: any) {
      console.error("Error approving transfer:", err);
      throw err; // Re-throw to let the dialog handle the error
    }
  };

  const handleDeclineTransfer = async (transferId: string, approvedBy: string) => {
    try {
      // For batch transfers, use the first transfer's ID (remove batch- prefix)
      const actualTransferId = transferId.startsWith('batch-') 
        ? transferId.replace('batch-', '') 
        : transferId;
        
      await inventoryService.declineTransfer(actualTransferId, approvedBy);
      await fetchTransferHistory(); // Refresh the list
      setApprovalDialogOpen(false);
      setSelectedTransfer(null);
    } catch (err: any) {
      console.error("Error declining transfer:", err);
      throw err; // Re-throw to let the dialog handle the error
    }
  };


  const openApprovalDialog = (transfer: TransferRecord) => {
    setSelectedTransfer(transfer);
    setApprovalDialogOpen(true);
  };

  useEffect(() => {
    fetchTransferHistory();
  }, []);

  const filteredTransfers = transfers.filter(transfer => {
    const matchesSearch = !searchTerm || 
      transfer.from_storage.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.to_storage.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.size.toString().includes(searchTerm);
    
    const matchesStatus = activeTab === 'all' || transfer.status === activeTab;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case 'declined':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Denied
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            {status}
          </Badge>
        );
    }
  };

  const getTabCounts = () => {
    const all = transfers.length;
    const pending = transfers.filter(t => t.status === 'pending').length;
    const approved = transfers.filter(t => t.status === 'approved').length;
    const declined = transfers.filter(t => t.status === 'declined').length;
    
    return { all, pending, approved, declined };
  };

  const tabCounts = getTabCounts();

  const exportToCSV = () => {
    const headers = [
      'Date',
      'From Storage',
      'To Storage', 
      'Size Class',
      'Weight (kg)',
      'Pieces',
      'Notes',
      'Created By'
    ];

    const csvData = filteredTransfers.map(transfer => [
      new Date(transfer.created_at).toLocaleDateString(),
      transfer.from_storage,
      transfer.to_storage,
      transfer.size,
      transfer.weight_kg?.toFixed(1) || '0.0',
      transfer.quantity,
      transfer.notes,
      transfer.created_by || 'System'
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transfer-reports-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    // Simple PDF generation using browser print
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Transfer Reports - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #2563eb; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
            .summary { background-color: #f8fafc; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Fish Inventory Transfer Reports</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
          </div>
          
          <div class="summary">
            <h3>Summary</h3>
            <p><strong>Total Transfers:</strong> ${filteredTransfers.length}</p>
            <p><strong>Total Quantity Transferred:</strong> ${filteredTransfers.reduce((sum, t) => sum + t.quantity, 0)} pieces</p>
            <p><strong>Date Range:</strong> ${filteredTransfers.length > 0 ? 
              `${new Date(Math.min(...filteredTransfers.map(t => new Date(t.created_at).getTime()))).toLocaleDateString()} - ${new Date(Math.max(...filteredTransfers.map(t => new Date(t.created_at).getTime()))).toLocaleDateString()}` : 
              'No transfers found'
            }</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>From Storage</th>
                <th>To Storage</th>
                <th>Size Class</th>
                <th>Quantity</th>
                <th>Notes</th>
                <th>Created By</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTransfers.map(transfer => `
                <tr>
                  <td>${new Date(transfer.created_at).toLocaleDateString()}</td>
                  <td>${transfer.from_storage}</td>
                  <td>${transfer.to_storage}</td>
                  <td>Size ${transfer.size}</td>
                  <td>${transfer.quantity}</td>
                  <td>${transfer.notes}</td>
                  <td>${transfer.created_by || 'System'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 content-container responsive-padding">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="h-6 w-6 md:h-8 md:w-8 text-blue-600" /> 
              Transfer Reports & Approvals
            </h1>
            <p className="text-gray-600 mt-1">Manage and approve fish transfer requests</p>
          </div>
          {onNavigate && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={() => onNavigate('inventory')}
                variant="outline" 
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <Home className="w-4 h-4" />
                Back to Inventory
              </Button>
            </div>
          )}
        </div>

        {/* Search and Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search transfers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={exportToCSV}
                variant="outline"
                size="sm"
                disabled={filteredTransfers.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={exportToPDF}
                variant="outline"
                size="sm"
                disabled={filteredTransfers.length === 0}
              >
                <FileText className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </div>

        {/* Pending Transfers Alert */}
        {tabCounts.pending > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-800">Pending Transfers Require Approval</h3>
                <p className="text-sm text-amber-700">
                  You have {tabCounts.pending} transfer request{tabCounts.pending !== 1 ? 's' : ''} waiting for approval. 
                  Click the "Review" button in the table below to approve or decline transfers.
                </p>
              </div>
            </div>
          </div>
        )}

      {/* Status Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeTab === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 ${
                activeTab === 'all' 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
              }`}
            >
              <FileText className="h-4 w-4" />
              All ({tabCounts.all})
            </Button>
            <Button
              variant={activeTab === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('pending')}
              className={`flex items-center gap-2 ${
                activeTab === 'pending' 
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                  : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
              }`}
            >
              <Clock className="h-4 w-4" />
              Pending ({tabCounts.pending})
            </Button>
            <Button
              variant={activeTab === 'approved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('approved')}
              className={`flex items-center gap-2 ${
                activeTab === 'approved' 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
              }`}
            >
              <CheckCircle className="h-4 w-4" />
              Approved ({tabCounts.approved})
            </Button>
            <Button
              variant={activeTab === 'declined' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('declined')}
              className={`flex items-center gap-2 ${
                activeTab === 'declined' 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
              }`}
            >
              <XCircle className="h-4 w-4" />
              Denied ({tabCounts.declined})
            </Button>
          </div>
        </div>


      {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Transfers</p>
                <p className="text-2xl font-bold text-blue-600">{filteredTransfers.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <ArrowRight className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <span className="text-green-600 font-medium">{tabCounts.approved} approved</span>
              <span className="text-gray-400 mx-2">•</span>
              <span className="text-gray-500">{tabCounts.pending} pending</span>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Quantity</p>
                <p className="text-2xl font-bold text-green-600">
                  {filteredTransfers.reduce((sum, t) => sum + t.quantity, 0)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Package className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <span className="text-gray-600">Total pieces transferred</span>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Weight</p>
                <p className="text-2xl font-bold text-orange-600">
                  {filteredTransfers.reduce((sum, t) => sum + (t.weight_kg || 0), 0).toFixed(1)}kg
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Scale className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <span className="text-gray-600">Total weight transferred</span>
            </div>
          </div>
          
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Reviews</p>
                <p className="text-2xl font-bold text-purple-600">{tabCounts.pending}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              {tabCounts.pending > 0 ? (
                <span className="text-amber-600 font-medium flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Needs attention
                </span>
              ) : (
                <span className="text-green-600 font-medium flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  All caught up
                </span>
              )}
            </div>
          </div>
      </div>

      {/* Transfer Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Transfer History</h3>
            <p className="text-sm text-gray-600">View and manage all transfer requests</p>
          </div>
          <div className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                <p className="text-gray-600">Loading transfer history...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-8 bg-red-50 border border-red-200 rounded-lg m-6">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div>
                <h3 className="font-medium text-red-800">Error Loading Data</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <Button 
                  onClick={fetchTransferHistory} 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                >
                  Try Again
                </Button>
              </div>
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-gray-50 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <ArrowRight className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Transfers Found</h3>
              <p className="text-gray-600">
                {searchTerm ? "No transfers match your search criteria" : "No transfers have been recorded yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>From Storage</TableHead>
                    <TableHead>To Storage</TableHead>
                    <TableHead>Size Class</TableHead>
                    <TableHead>Weight (kg)</TableHead>
                    <TableHead>Pieces</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell className="font-medium">
                        {new Date(transfer.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-red-100 rounded">
                            <ArrowRight className="w-3 h-3 text-red-600" />
                          </div>
                          <span className="font-medium">{transfer.from_storage}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-green-100 rounded">
                            <ArrowRight className="w-3 h-3 text-green-600 rotate-180" />
                          </div>
                          <span className="font-medium">{transfer.to_storage}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-center gap-1">
                          {transfer.is_batch ? (
                            <div className="flex flex-wrap gap-1 justify-center">
                              <Badge variant="secondary" className="text-xs">
                                Batch
                              </Badge>
                              {transfer.batch_sizes?.map((size, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  Size {size}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <Badge variant="outline" className="w-auto justify-center">
                              Size {transfer.size}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-blue-600">
                        <div className="flex items-center gap-1">
                          <Scale className="w-4 h-4" />
                          {transfer.is_batch 
                            ? `${transfer.total_batch_weight?.toFixed(1) || '0.0'}kg`
                            : `${transfer.weight_kg?.toFixed(1) || '0.0'}kg`
                          }
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {transfer.is_batch 
                          ? `${transfer.total_batch_quantity || 0} pieces`
                          : `${transfer.quantity} pieces`
                        }
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(transfer.status)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {transfer.notes || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {transfer.created_by || 'System'}
                      </TableCell>
                      <TableCell>
                        {transfer.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openApprovalDialog(transfer)}
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Review
                          </Button>
                        )}
                        {transfer.status !== 'pending' && (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          </div>
        </div>

      {/* Transfer Approval Dialog */}
      {approvalDialogOpen && selectedTransfer && (
        <TransferApprovalDialog
          isOpen={approvalDialogOpen}
          onClose={() => {
            setApprovalDialogOpen(false);
            setSelectedTransfer(null);
          }}
          transferRequest={{
            id: selectedTransfer.id,
            from_storage_name: selectedTransfer.from_storage,
            to_storage_name: selectedTransfer.to_storage,
            size_class: selectedTransfer.is_batch ? 0 : selectedTransfer.size, // Use 0 for batch
            quantity: selectedTransfer.is_batch ? selectedTransfer.total_batch_quantity || 0 : selectedTransfer.quantity,
            weight_kg: selectedTransfer.is_batch ? selectedTransfer.total_batch_weight || 0 : selectedTransfer.weight_kg,
            notes: selectedTransfer.notes,
            created_at: selectedTransfer.created_at,
            is_bulk: selectedTransfer.is_batch || selectedTransfer.is_bulk,
            batch_size: selectedTransfer.is_batch ? selectedTransfer.batch_sizes?.length || 0 : selectedTransfer.batch_size,
            batch_transfers: selectedTransfer.batch_transfers,
            // Add batch-specific fields
            is_batch: selectedTransfer.is_batch,
            batch_sizes: selectedTransfer.batch_sizes,
            total_batch_quantity: selectedTransfer.total_batch_quantity,
            total_batch_weight: selectedTransfer.total_batch_weight
          }}
          onApprove={handleApproveTransfer}
          onDecline={handleDeclineTransfer}
          currentUserId={user?.id || ''}
        />
      )}
      </div>
    </div>
  );
}
