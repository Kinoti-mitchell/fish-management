import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Trash2, Plus, Package, AlertTriangle, Calendar, Clock, MapPin, ChevronDown, ChevronRight, FileText, Download, TrendingUp, BarChart3 } from "lucide-react";
import { disposalService } from "../services/disposalService";
import { DisposalMarquee } from "./DisposalMarquee";

interface DisposalRecord {
  id: string;
  disposal_reason: string | { name: string };
  total_weight_kg: number;
  disposal_cost: number;
  status: string;
  created_at: string;
  disposal_date?: string;
  notes?: string;
  created_by?: string;
  approved_by?: string;
  batch_numbers?: string[];
  size_classes?: number[];
  disposal_method?: string;
}

interface DisposalStats {
  totalDisposals: number;
  totalDisposedWeight: number;
  totalDisposalCost: number;
  pendingDisposals: number;
  recentDisposals: number;
  averageDisposalAge: number;
  topDisposalReason: string;
}

interface InventoryItem {
  sorting_result_id: string;
  batch_number: string;
  size_class: number;
  total_weight_grams: number;
  storage_location_name: string;
  days_in_storage: number;
  disposal_reason: string;
  processing_date: string;
}

const DisposalManagement: React.FC = () => {
  const [disposalRecords, setDisposalRecords] = useState<DisposalRecord[]>([]);
  const [disposalStats, setDisposalStats] = useState<DisposalStats>({
    totalDisposals: 0,
    totalDisposedWeight: 0,
    totalDisposalCost: 0,
    pendingDisposals: 0,
    recentDisposals: 0,
    averageDisposalAge: 0,
    topDisposalReason: 'Age'
  });
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [creatingDisposal, setCreatingDisposal] = useState(false);
  const [selectedDisposal, setSelectedDisposal] = useState<DisposalRecord | null>(null);

  // Form state
  const [ageCategory, setAgeCategory] = useState<string>("all");
  const [customDaysOld, setCustomDaysOld] = useState<number>(1);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [disposalReason, setDisposalReason] = useState<string>("");
  const [expandedStorages, setExpandedStorages] = useState<Set<string>>(new Set());
  const [disposalCost, setDisposalCost] = useState<number>(0);
  const [disposalNotes, setDisposalNotes] = useState<string>("");
  const [disposalMethod, setDisposalMethod] = useState<string>("waste");
  
  // Reports state
  const [showReports, setShowReports] = useState<boolean>(false);
  const [reportDateRange, setReportDateRange] = useState<{from: string, to: string}>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    to: new Date().toISOString().split('T')[0] // today
  });

  // Simplified age categories
  const ageCategories = [
    { value: "all", label: "All Items", description: "Show all available items", days: 0 },
    { value: "custom_age", label: "Custom Age", description: "Items older than specified days", days: 0 },
    { value: "inactive_storage", label: "Inactive Storage", description: "Items in inactive storage locations", days: 0 }
  ];

  // Disposal method options
  const disposalMethods = [
    { value: "waste", label: "Waste Disposal", description: "Dispose as general waste" },
    { value: "compost", label: "Compost", description: "Convert to compost for farming" },
    { value: "donation", label: "Donation", description: "Donate to charity or food bank" },
    { value: "return_to_farmer", label: "Return to Farmer", description: "Return to original farmer" }
  ];

  useEffect(() => {
    loadDisposalData();
    loadInventoryForDisposal(); // Load inventory immediately - cache bust
  }, []);

  useEffect(() => {
      loadInventoryForDisposal();
  }, [ageCategory, customDaysOld]);

  const loadDisposalData = async () => {
    try {
      setLoading(true);
      const [records, stats] = await Promise.all([
        disposalService.getDisposalRecords(),
        disposalService.getDisposalStats()
      ]);
      setDisposalRecords(records);
      setDisposalStats(stats);
    } catch (error) {
      console.error('Error loading disposal data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInventoryForDisposal = async () => {
    try {
      let daysOld = 0;
      let maxDaysOld: number | undefined;
      let inactiveStorageOnly = false;
      let includeStorageIssues = false;

      if (ageCategory === "all") {
        daysOld = 0; // Show all items
        includeStorageIssues = true;
      } else if (ageCategory === "custom_age") {
        daysOld = customDaysOld; // Use whatever number the user enters (1 to whatever)
      } else if (ageCategory === "inactive_storage") {
        daysOld = 0;
        inactiveStorageOnly = true;
        includeStorageIssues = false; // Only show inactive storage items
      }

      const items = await disposalService.getInventoryForDisposal(
        daysOld,
        includeStorageIssues,
        maxDaysOld,
        inactiveStorageOnly
      );
      setInventoryItems(items);
    } catch (error) {
      console.error('Error loading inventory for disposal:', error);
      setInventoryItems([]);
    }
  };

  const handleCreateDisposal = async () => {
    if (selectedItems.length === 0) {
      alert('Please select at least one item for disposal');
      return;
    }

    try {
      setCreatingDisposal(true);
      
      // Calculate total weight of selected items
      const selectedItemsData = inventoryItems.filter(item => 
        selectedItems.includes(item.sorting_result_id)
      );
      const totalWeight = selectedItemsData.reduce((sum, item) => 
        sum + (item.total_weight_grams / 1000), 0
      );

      // Create disposal record
      const result = await disposalService.createDisposal({
        selectedItems,
        disposalReason,
        disposalCost,
        disposalNotes,
        disposalMethod,
        totalWeight
      });

      if (result.success) {
        alert(`✅ ${result.message}`);
        // Reset form
        resetForm();
        setCreateDialogOpen(false);
        await loadDisposalData();
      } else {
        alert(`❌ Error creating disposal: ${result.error}`);
      }
    } catch (error) {
      console.error('Error creating disposal:', error);
      alert('❌ An error occurred while creating the disposal record');
    } finally {
      setCreatingDisposal(false);
    }
  };

  const resetForm = () => {
    setAgeCategory("all");
    setCustomDaysOld(1);
    setSelectedItems([]);
    setDisposalReason("");
    setDisposalCost(0);
    setDisposalNotes("");
    setDisposalMethod("waste");
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const toggleStorageExpansion = (storageName: string) => {
    setExpandedStorages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(storageName)) {
        newSet.delete(storageName);
      } else {
        newSet.add(storageName);
      }
      return newSet;
    });
  };

  const expandAllStorages = () => {
    const allStorageNames = new Set(inventoryItems.map(item => item.storage_location_name));
    setExpandedStorages(allStorageNames);
  };

  const collapseAllStorages = () => {
    setExpandedStorages(new Set());
  };

  const selectAllItems = () => {
    const allItemIds = inventoryItems.map(item => item.sorting_result_id);
    setSelectedItems(allItemIds);
  };

  const deselectAllItems = () => {
    setSelectedItems([]);
  };

  const generateDisposalReport = () => {
    const filteredRecords = disposalRecords.filter(record => {
      const recordDate = new Date(record.created_at).toISOString().split('T')[0];
      return recordDate >= reportDateRange.from && recordDate <= reportDateRange.to;
    });

    const totalWeight = filteredRecords.reduce((sum, record) => sum + (record.total_weight_kg || 0), 0);
    const totalCost = filteredRecords.reduce((sum, record) => sum + (record.disposal_cost || 0), 0);
    
    // Group by disposal reason
    const reasonGroups: { [key: string]: { count: number, weight: number, cost: number } } = {};
    filteredRecords.forEach(record => {
      const reason = typeof record.disposal_reason === 'object' ? record.disposal_reason?.name || 'Unknown' : record.disposal_reason || 'Unknown';
      if (!reasonGroups[reason]) {
        reasonGroups[reason] = { count: 0, weight: 0, cost: 0 };
      }
      reasonGroups[reason].count++;
      reasonGroups[reason].weight += record.total_weight_kg || 0;
      reasonGroups[reason].cost += record.disposal_cost || 0;
    });

    return {
      totalRecords: filteredRecords.length,
      totalWeight,
      totalCost,
      reasonGroups,
      records: filteredRecords
    };
  };

  const exportToCSV = () => {
    const report = generateDisposalReport();
    const csvContent = [
      ['Date', 'Time', 'Batch Numbers', 'Size Classes', 'Disposal Reason', 'Disposal Method', 'Weight (kg)', 'Cost (KES)', 'Created By', 'Approved By', 'Status', 'Notes'].join(','),
      ...report.records.map(record => {
        const date = new Date(record.created_at);
        return [
          date.toLocaleDateString(),
          date.toLocaleTimeString(),
          record.batch_numbers?.join('; ') || 'N/A',
          record.size_classes?.join('; ') || 'N/A',
        typeof record.disposal_reason === 'object' ? record.disposal_reason?.name || 'Unknown' : record.disposal_reason || 'Unknown',
          record.disposal_method || 'N/A',
        record.total_weight_kg || 0,
        record.disposal_cost || 0,
          record.created_by || 'N/A',
          record.approved_by || 'N/A',
          record.status,
          record.notes || 'N/A'
        ].map(field => `"${field}"`).join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `disposal-report-${reportDateRange.from}-to-${reportDateRange.to}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading disposal data...</p>
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
          
          <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Disposal
          </Button>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent className="!max-w-4xl !w-[90vw] !h-[80vh] !flex !flex-col !top-[10vh] !left-[5vw] !translate-x-0 !translate-y-0">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">Create New Disposal Record</DialogTitle>
                <DialogDescription>
                  Configure disposal criteria and select items for disposal
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 flex-1 overflow-y-auto overflow-x-hidden min-h-0 pt-2" style={{maxHeight: 'calc(80vh - 150px)'}}>
              {/* First Step - Select Filter Criteria */}
              <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-indigo-50 max-w-md mx-auto">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    Select Filter Criteria
                  </CardTitle>
                  <p className="text-sm text-gray-600">Choose criteria for selecting items to dispose</p>
                    </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="ageCategory" className="text-sm font-semibold text-gray-700">
                      Filter Criteria *
                    </Label>
                    <Select value={ageCategory} onValueChange={(value) => {
                      setAgeCategory(value);
                      // Auto-populate disposal reason based on selection
                      const category = ageCategories.find(cat => cat.value === value);
                      if (category) {
                        setDisposalReason(category.label);
                      }
                    }}>
                      <SelectTrigger className="h-12 bg-white border-2 border-gray-200 hover:border-blue-300 focus:border-blue-500 transition-colors">
                        <SelectValue placeholder="Select filter criteria" />
                      </SelectTrigger>
                      <SelectContent>
                        {ageCategories.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            <div className="flex flex-col py-1">
                              <span className="font-medium text-gray-800">{category.label}</span>
                              <span className="text-xs text-gray-500">{category.description}</span>
                        </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                        </div>
                </CardContent>
              </Card>

              {/* Rest of the form - Show only after reason is selected */}
              {ageCategory && ageCategory !== "" && (
                <div className="space-y-4">
                  {/* Custom Age Input - Show for custom age reason */}
                  {ageCategory === "custom_age" && (
                    <Card className="shadow-lg border-0 bg-gradient-to-br from-yellow-50 to-orange-50 max-w-md mx-auto">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                          <Clock className="w-5 h-5 text-orange-600" />
                          Custom Age Threshold
                        </CardTitle>
                        <p className="text-sm text-gray-600">Set the minimum age in days for items to dispose</p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <Label htmlFor="customDaysOld" className="text-sm font-semibold text-gray-700">
                            Days Old Threshold *
                          </Label>
                          <Input
                            id="customDaysOld"
                            type="number"
                            value={customDaysOld}
                            onChange={(e) => setCustomDaysOld(Number(e.target.value))}
                            className="h-12 bg-white border-2 border-gray-200 hover:border-orange-300 focus:border-orange-500 transition-colors"
                            placeholder="Enter days old threshold"
                            min="1"
                          />
                      </div>
                    </CardContent>
                  </Card>
                  )}

                  {/* Disposal Configuration */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-full overflow-x-hidden">
                    <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                          <Trash2 className="w-5 h-5 text-blue-600" />
                          Filter Items for Disposal
                        </CardTitle>
                        <p className="text-sm text-gray-600">Configure criteria for selecting items</p>
                    </CardHeader>
                      <CardContent className="space-y-4">
                        
                        {ageCategory === "custom_age" && (
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-gray-700">Age Threshold</Label>
                            <div className="p-3 bg-white rounded-lg border border-gray-200">
                              <span className="text-sm text-gray-600">{customDaysOld} days or older</span>
                        </div>
                      </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Disposal Details */}
                    <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-emerald-50">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-green-600" />
                          Disposal Details
                        </CardTitle>
                        <p className="text-sm text-gray-600">Provide disposal information</p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        
                        <div className="space-y-2">
                          <Label htmlFor="disposalMethod" className="text-sm font-semibold text-gray-700">
                            Disposal Method *
                          </Label>
                          <Select value={disposalMethod} onValueChange={setDisposalMethod}>
                            <SelectTrigger className="h-12 bg-white border-2 border-gray-200 hover:border-green-300 focus:border-green-500 transition-colors">
                              <SelectValue placeholder="Select disposal method" />
                            </SelectTrigger>
                            <SelectContent>
                              {disposalMethods.map((method) => (
                                <SelectItem key={method.value} value={method.value}>
                                  <div className="flex flex-col py-1">
                                    <span className="font-medium text-gray-800">{method.label}</span>
                                    <span className="text-xs text-gray-500">{method.description}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="disposalCost" className="text-sm font-semibold text-gray-700">
                            Disposal Cost (KES)
                          </Label>
                          <Input
                            id="disposalCost"
                            type="number"
                            value={disposalCost}
                            onChange={(e) => setDisposalCost(Number(e.target.value))}
                            className="h-12 bg-white border-2 border-gray-200 hover:border-green-300 focus:border-green-500 transition-colors"
                            placeholder="Enter disposal cost"
                            min="0"
                            step="0.01"
                          />
                      </div>

                        <div className="space-y-2">
                          <Label htmlFor="disposalNotes" className="text-sm font-semibold text-gray-700">
                            Notes
                          </Label>
                          <Input
                            id="disposalNotes"
                            value={disposalNotes}
                            onChange={(e) => setDisposalNotes(e.target.value)}
                            className="h-12 bg-white border-2 border-gray-200 hover:border-green-300 focus:border-green-500 transition-colors"
                            placeholder="Additional notes (optional)"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Inventory Items */}
                <Card className="overflow-hidden">
                  <CardHeader className="pb-4">
                      <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-gray-600" />
                        Available Items for Disposal ({inventoryItems.length})
                      </CardTitle>
                      <p className="text-sm text-gray-600">
                        {ageCategory === "all" && "Showing all available items"}
                        {ageCategory === "custom_age" && `Showing items older than ${customDaysOld} days`}
                        {ageCategory === "inactive_storage" && "Showing items in inactive storage locations"}
                      </p>
                  </CardHeader>
                  <CardContent className="max-h-96 overflow-y-auto">
                      {inventoryItems.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Trash2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <p>No items found matching your criteria</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
                            <div className="text-sm text-gray-600">
                              Showing {inventoryItems.length} items across {new Set(inventoryItems.map(item => item.storage_location_name)).size} storage locations
                              {selectedItems.length > 0 && (
                                <span className="ml-2 font-semibold text-blue-600">
                                  • {selectedItems.length} selected
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={expandAllStorages}
                                className="text-xs"
                              >
                                Expand All
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={collapseAllStorages}
                                className="text-xs"
                              >
                                Collapse All
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={selectAllItems}
                                className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                              >
                                Select All
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={deselectAllItems}
                                className="text-xs bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                              >
                                Deselect All
                              </Button>
                            </div>
                          </div>
                          
                          {/* Group items by storage location */}
                          {Object.entries(
                            inventoryItems.reduce((groups, item) => {
                              const location = item.storage_location_name;
                              if (!groups[location]) {
                                groups[location] = [];
                              }
                              groups[location].push(item);
                              return groups;
                            }, {} as Record<string, typeof inventoryItems>)
                          ).map(([storageName, items]) => {
                            const isExpanded = expandedStorages.has(storageName);
                            const typedItems = items as typeof inventoryItems;
                            return (
                            <Card key={storageName} className="border-2 border-gray-200">
                              <CardHeader 
                                className="pb-3 cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => toggleStorageExpansion(storageName)}
                              >
                                <CardTitle className="text-lg font-semibold text-gray-800 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-gray-500" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-gray-500" />
                                    )}
                                    <MapPin className="w-5 h-5 text-blue-600" />
                                    {storageName}
                                  </div>
                                  <Badge variant="outline" className="text-sm">
                                    {typedItems.length} items
                                  </Badge>
                                </CardTitle>
                                <div className="text-sm text-gray-600">
                                  Total Weight: {(typedItems.reduce((sum, item) => sum + item.total_weight_grams, 0) / 1000).toFixed(2)} kg
                                </div>
                              </CardHeader>
                              {isExpanded && (
                              <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-x-hidden">
                                  {typedItems.map((item) => (
                            <Card 
                                      key={item.sorting_result_id} 
                              className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                                        selectedItems.includes(item.sorting_result_id) 
                                  ? 'ring-2 ring-red-500 bg-red-50' 
                                  : 'hover:bg-gray-50'
                              }`}
                                      onClick={() => toggleItemSelection(item.sorting_result_id)}
                            >
                                      <CardContent className="p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge variant="outline" className="text-xs">
                                            {item.batch_number}
                                      </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                            Size {item.size_class}
                                </Badge>
                            </div>
                            
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Weight:</span>
                                            <span className="font-medium">{(item.total_weight_grams / 1000).toFixed(2)} kg</span>
                                          </div>
                                  <div className="flex justify-between">
                                            <span className="text-gray-600">Age:</span>
                                            <span className="font-medium">{item.days_in_storage} days</span>
                                      </div>
                                    </div>
                                
                                        {selectedItems.includes(item.sorting_result_id) && (
                                  <div className="mt-2 text-center">
                                            <Badge className="bg-red-600 text-white text-xs">Selected</Badge>
                              </div>
                            )}
                              </CardContent>
                            </Card>
                          ))}
                                </div>
                              </CardContent>
                              )}
                            </Card>
                            );
                          })}
                          </div>
                    )}
                  </CardContent>
                </Card>
                </div>
              )}
              </div>

              <DialogFooter className="flex-shrink-0 border-t pt-4">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
              {ageCategory && ageCategory !== "" && (
                <Button 
                  onClick={() => handleCreateDisposal()} 
                  className="bg-red-600 hover:bg-red-700"
                  disabled={creatingDisposal}
                >
                  {creatingDisposal ? "Processing..." : "Create Disposal"}
                </Button>
              )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
                  <p className="text-sm font-medium text-gray-600">Total Weight</p>
                  <p className="text-2xl font-bold text-gray-900">{(disposalStats.totalDisposedWeight || 0).toFixed(1)} kg</p>
                </div>
                <Package className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Cost</p>
                  <p className="text-2xl font-bold text-gray-900">KES {(disposalStats.totalDisposalCost || 0).toFixed(2)}</p>
                </div>
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">{disposalStats.pendingDisposals || 0}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reports Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Disposal Reports
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowReports(!showReports)}
                  className="flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  {showReports ? 'Hide Reports' : 'Show Reports'}
                </Button>
                {showReports && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={exportToCSV}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          
          {showReports && (
            <CardContent>
              {/* Date Range Filter */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <Label htmlFor="reportFromDate" className="text-sm font-semibold text-gray-700">
                    From Date
                  </Label>
                  <Input
                    id="reportFromDate"
                    type="date"
                    value={reportDateRange.from}
                    onChange={(e) => setReportDateRange(prev => ({ ...prev, from: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="reportToDate" className="text-sm font-semibold text-gray-700">
                    To Date
                  </Label>
                  <Input
                    id="reportToDate"
                    type="date"
                    value={reportDateRange.to}
                    onChange={(e) => setReportDateRange(prev => ({ ...prev, to: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                      setReportDateRange({ from: thirtyDaysAgo, to: today });
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    Last 30 Days
                  </Button>
                </div>
              </div>

              {/* Report Summary */}
              {(() => {
                const report = generateDisposalReport();
                return (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-blue-600">Total Disposals</p>
                              <p className="text-2xl font-bold text-blue-900">{report.totalRecords}</p>
                            </div>
                            <Trash2 className="h-8 w-8 text-blue-400" />
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-green-50 border-green-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-green-600">Total Weight</p>
                              <p className="text-2xl font-bold text-green-900">{report.totalWeight.toFixed(1)} kg</p>
                            </div>
                            <Package className="h-8 w-8 text-green-400" />
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-orange-50 border-orange-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-orange-600">Total Cost</p>
                              <p className="text-2xl font-bold text-orange-900">KES {report.totalCost.toLocaleString()}</p>
                            </div>
                            <TrendingUp className="h-8 w-8 text-orange-400" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Disposal by Reason */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Disposal by Reason</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {Object.keys(report.reasonGroups).length === 0 ? (
                          <p className="text-gray-500 text-center py-4">No disposals found for the selected date range</p>
                        ) : (
                          <div className="space-y-3">
                            {Object.entries(report.reasonGroups).map(([reason, data]) => (
                              <div key={reason} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="text-sm">
                                    {data.count} records
                                  </Badge>
                                  <span className="font-medium text-gray-800">{reason}</span>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-gray-600">
                                    {data.weight.toFixed(1)} kg • KES {data.cost.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Recent Disposals */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Recent Disposals</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {report.records.length === 0 ? (
                          <p className="text-gray-500 text-center py-4">No disposals found for the selected date range</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-gray-50">
                                  <th className="text-left p-2 font-medium">Date & Time</th>
                                  <th className="text-left p-2 font-medium">Batch Numbers</th>
                                  <th className="text-left p-2 font-medium">Size Classes</th>
                                  <th className="text-left p-2 font-medium">Reason</th>
                                  <th className="text-left p-2 font-medium">Method</th>
                                  <th className="text-left p-2 font-medium">Weight (kg)</th>
                                  <th className="text-left p-2 font-medium">Cost (KES)</th>
                                  <th className="text-left p-2 font-medium">Created By</th>
                                  <th className="text-left p-2 font-medium">Approved By</th>
                                  <th className="text-left p-2 font-medium">Status</th>
                                  <th className="text-left p-2 font-medium">Notes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {report.records.slice(0, 10).map((record) => {
                                  const date = new Date(record.created_at);
                                  return (
                                  <tr key={record.id} className="border-b hover:bg-gray-50">
                                    <td className="p-2">
                                        <div className="text-xs">
                                          <div>{date.toLocaleDateString()}</div>
                                          <div className="text-gray-500">{date.toLocaleTimeString()}</div>
                                        </div>
                                      </td>
                                      <td className="p-2">
                                        <div className="text-xs">
                                          {record.batch_numbers?.length ? (
                                            record.batch_numbers.map((batch, idx) => (
                                              <Badge key={idx} variant="outline" className="text-xs mr-1 mb-1">
                                                {batch}
                                              </Badge>
                                            ))
                                          ) : (
                                            <span className="text-gray-400">N/A</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="p-2">
                                        <div className="text-xs">
                                          {record.size_classes?.length ? (
                                            record.size_classes.map((size, idx) => (
                                              <Badge key={idx} variant="secondary" className="text-xs mr-1 mb-1">
                                                Size {size}
                                              </Badge>
                                            ))
                                          ) : (
                                            <span className="text-gray-400">N/A</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="p-2 text-xs">
                                        {typeof record.disposal_reason === 'object' ? record.disposal_reason?.name || 'Unknown' : record.disposal_reason || 'Unknown'}
                                      </td>
                                      <td className="p-2 text-xs">
                                        {record.disposal_method || 'N/A'}
                                      </td>
                                      <td className="p-2 text-xs font-medium">
                                        {(record.total_weight_kg || 0).toFixed(1)}
                                      </td>
                                      <td className="p-2 text-xs font-medium">
                                        {(record.disposal_cost || 0).toLocaleString()}
                                      </td>
                                      <td className="p-2 text-xs">
                                        {record.created_by || 'N/A'}
                                      </td>
                                      <td className="p-2 text-xs">
                                        {record.approved_by || 'N/A'}
                                      </td>
                                      <td className="p-2">
                                        <Badge variant={record.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                                        {record.status}
                                      </Badge>
                                    </td>
                                      <td className="p-2 text-xs max-w-32 truncate" title={record.notes || ''}>
                                        {record.notes || 'N/A'}
                                      </td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            {report.records.length > 10 && (
                              <p className="text-sm text-gray-500 mt-2 text-center">
                                Showing 10 of {report.records.length} records
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}
            </CardContent>
          )}
        </Card>

        {/* Disposal Records Table */}
        <Card>
          <CardHeader>
            <CardTitle>Disposal Records</CardTitle>
          </CardHeader>
          <CardContent>
            {disposalRecords.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Trash2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No disposal records found</p>
              </div>
            ) : (
          <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-2 font-medium">Date & Time</th>
                      <th className="text-left p-2 font-medium">Batch Numbers</th>
                      <th className="text-left p-2 font-medium">Size Classes</th>
                      <th className="text-left p-2 font-medium">Reason</th>
                      <th className="text-left p-2 font-medium">Method</th>
                      <th className="text-left p-2 font-medium">Weight (kg)</th>
                      <th className="text-left p-2 font-medium">Cost (KES)</th>
                      <th className="text-left p-2 font-medium">Created By</th>
                      <th className="text-left p-2 font-medium">Approved By</th>
                      <th className="text-left p-2 font-medium">Status</th>
                      <th className="text-left p-2 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disposalRecords.map((record) => {
                      const date = new Date(record.created_at);
                      return (
                      <tr key={record.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                            <div className="text-xs">
                              <div>{date.toLocaleDateString()}</div>
                              <div className="text-gray-500">{date.toLocaleTimeString()}</div>
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="text-xs">
                              {record.batch_numbers?.length ? (
                                record.batch_numbers.map((batch, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs mr-1 mb-1">
                                    {batch}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-gray-400">N/A</span>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="text-xs">
                              {record.size_classes?.length ? (
                                record.size_classes.map((size, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs mr-1 mb-1">
                                    Size {size}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-gray-400">N/A</span>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-xs">
                            {typeof record.disposal_reason === 'object' ? record.disposal_reason?.name || 'Unknown' : record.disposal_reason || 'Unknown'}
                          </td>
                          <td className="p-2 text-xs">
                            {record.disposal_method || 'N/A'}
                          </td>
                          <td className="p-2 text-xs font-medium">
                            {record.total_weight_kg.toFixed(2)}
                          </td>
                          <td className="p-2 text-xs font-medium">
                            {record.disposal_cost.toFixed(2)}
                          </td>
                          <td className="p-2 text-xs">
                            {record.created_by || 'N/A'}
                          </td>
                          <td className="p-2 text-xs">
                            {record.approved_by || 'N/A'}
                          </td>
                          <td className="p-2">
                            <Badge variant={record.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                        {record.status}
                      </Badge>
                        </td>
                          <td className="p-2 text-xs max-w-32 truncate" title={record.notes || ''}>
                            {record.notes || 'N/A'}
                          </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
            </div>
          )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DisposalManagement;