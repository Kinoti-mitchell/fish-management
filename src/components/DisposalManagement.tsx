import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Trash2, Plus, Package, AlertTriangle, Calendar, Clock, MapPin } from "lucide-react";
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
  id: string;
  batchNumber: string;
  sizeClass: number;
  weightKg: number;
  storageLocation: string;
  daysInStorage: number;
  disposalReason: string;
  processingDate: string;
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
  const [ageCategory, setAgeCategory] = useState<string>("");
  const [customDaysOld, setCustomDaysOld] = useState<number>(30);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [disposalReason, setDisposalReason] = useState<string>("");
  const [disposalCost, setDisposalCost] = useState<number>(0);
  const [disposalNotes, setDisposalNotes] = useState<string>("");

  // Simplified age categories
  const ageCategories = [
    { value: "all", label: "All Items", description: "Show all available items", days: 0 },
    { value: "custom_age", label: "Custom Age", description: "Items older than specified days", days: 0 },
    { value: "inactive_storage", label: "Inactive Storage", description: "Items in inactive storage locations", days: 0 }
  ];

  useEffect(() => {
    loadDisposalData();
  }, []);

  useEffect(() => {
    if (ageCategory && ageCategory !== "") {
      loadInventoryForDisposal();
    }
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
      let maxDaysOld: number | undefined;
      let inactiveStorageOnly = false;

      if (ageCategory === "custom_age") {
        maxDaysOld = customDaysOld;
      } else if (ageCategory === "inactive_storage") {
        inactiveStorageOnly = true;
      }

      const items = await disposalService.getInventoryForDisposal(
        30, // daysOld
        true, // includeStorageIssues
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
      // Implementation for creating disposal
      console.log('Creating disposal with items:', selectedItems);
      // Reset form
      resetForm();
      setCreateDialogOpen(false);
      await loadDisposalData();
    } catch (error) {
      console.error('Error creating disposal:', error);
    } finally {
      setCreatingDisposal(false);
    }
  };

  const resetForm = () => {
    setAgeCategory("");
    setCustomDaysOld(30);
    setSelectedItems([]);
    setDisposalReason("");
    setDisposalCost(0);
    setDisposalNotes("");
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
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
            <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto overflow-x-hidden">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">Create New Disposal Record</DialogTitle>
                <DialogDescription>
                  Configure disposal criteria and select items for disposal
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
              {/* First Step - Select Disposal Reason */}
              <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-indigo-50 max-w-md mx-auto">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    Select Disposal Reason
                  </CardTitle>
                  <p className="text-sm text-gray-600">Choose why you want to dispose items</p>
                    </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="ageCategory" className="text-sm font-semibold text-gray-700">
                      Disposal Reason *
                    </Label>
                    <Select value={ageCategory} onValueChange={setAgeCategory}>
                      <SelectTrigger className="h-12 bg-white border-2 border-gray-200 hover:border-blue-300 focus:border-blue-500 transition-colors">
                        <SelectValue placeholder="Select disposal reason" />
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
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-gray-700">Selected Reason</Label>
                          <div className="p-3 bg-white rounded-lg border border-gray-200">
                            <Badge variant="secondary" className="text-sm">
                              {ageCategories.find(cat => cat.value === ageCategory)?.label}
                            </Badge>
                          </div>
                        </div>
                        
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
                          <Label htmlFor="disposalReason" className="text-sm font-semibold text-gray-700">
                            Disposal Reason *
                          </Label>
                          <Input
                            id="disposalReason"
                            value={disposalReason}
                            onChange={(e) => setDisposalReason(e.target.value)}
                            className="h-12 bg-white border-2 border-gray-200 hover:border-green-300 focus:border-green-500 transition-colors"
                            placeholder="Enter disposal reason"
                          />
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
                <Card className="overflow-x-hidden">
                  <CardHeader className="pb-4">
                      <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-gray-600" />
                        Available Items for Disposal ({inventoryItems.length})
                      </CardTitle>
                      <p className="text-sm text-gray-600">Select items to include in this disposal</p>
                  </CardHeader>
                  <CardContent>
                      {inventoryItems.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Trash2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <p>No items found matching your criteria</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                          {inventoryItems.map((item) => (
                            <Card 
                              key={item.id} 
                              className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                                selectedItems.includes(item.id) 
                                  ? 'ring-2 ring-red-500 bg-red-50' 
                                  : 'hover:bg-gray-50'
                              }`}
                              onClick={() => toggleItemSelection(item.id)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge variant="outline" className="text-xs">
                                    {item.batchNumber}
                                      </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    Size {item.sizeClass}
                                </Badge>
                            </div>
                            
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Weight:</span>
                                    <span className="font-medium">{item.weightKg.toFixed(2)} kg</span>
                                          </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Location:</span>
                                    <span className="font-medium">{item.storageLocation}</span>
                                          </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Age:</span>
                                    <span className="font-medium">{item.daysInStorage} days</span>
                                        </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Reason:</span>
                                    <span className="font-medium text-red-600">{item.disposalReason}</span>
                                      </div>
                                    </div>
                                
                                {selectedItems.includes(item.id) && (
                                  <div className="mt-2 text-center">
                                    <Badge className="bg-red-600 text-white">Selected</Badge>
                              </div>
                            )}
                              </CardContent>
                            </Card>
                          ))}
                          </div>
                    )}
                  </CardContent>
                </Card>
                </div>
              )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
              {ageCategory && ageCategory !== "" && (
                <Button 
                  onClick={handleCreateDisposal} 
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
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Reason</th>
                      <th className="text-left p-2">Weight (kg)</th>
                      <th className="text-left p-2">Cost (KES)</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disposalRecords.map((record) => (
                      <tr key={record.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{new Date(record.created_at).toLocaleDateString()}</td>
                        <td className="p-2">{typeof record.disposal_reason === 'object' ? record.disposal_reason?.name || 'Unknown' : record.disposal_reason || 'Unknown'}</td>
                        <td className="p-2">{record.total_weight_kg.toFixed(2)}</td>
                        <td className="p-2">{record.disposal_cost.toFixed(2)}</td>
                        <td className="p-2">
                          <Badge variant={record.status === 'completed' ? 'default' : 'secondary'}>
                        {record.status}
                      </Badge>
                        </td>
                      </tr>
                    ))}
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