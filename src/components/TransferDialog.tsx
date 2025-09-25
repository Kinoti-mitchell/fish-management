"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { 
  ArrowRight, 
  Package, 
  Scale, 
  AlertCircle, 
  CheckCircle,
  Home,
  Loader2,
  Check
} from "lucide-react";
import { inventoryService } from "../services/inventoryService";
import { useAuth } from "./AuthContext";

interface TransferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sourceStorage: {
    id: string;
    name: string;
    location_type: string;
  };
  itemsToTransfer: Array<{
    size: number;
    quantity: number;
    total_weight: number;
  }>;
  onTransferComplete: () => void;
}

interface AvailableStorage {
  id: string;
  name: string;
  location_type: string;
  capacity_kg: number;
  current_usage_kg: number;
  available_capacity_kg: number;
  utilization_percent: number;
}

export default function TransferDialog({
  isOpen,
  onClose,
  sourceStorage,
  itemsToTransfer,
  onTransferComplete,
}: TransferDialogProps) {
  const { user } = useAuth();
  const [availableStorages, setAvailableStorages] = useState<AvailableStorage[]>([]);
  const [selectedStorageId, setSelectedStorageId] = useState<string>("");
  const [transferNotes, setTransferNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<Set<number>>(new Set());

  // Initialize selected sizes when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Select all sizes by default
      const allSizes = new Set(itemsToTransfer.map(item => item.size));
      setSelectedSizes(allSizes);
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, sourceStorage.id, itemsToTransfer]);

  // Reload available storages when selected sizes change
  useEffect(() => {
    if (isOpen && selectedSizes.size > 0) {
      loadAvailableStorages();
    }
  }, [selectedSizes, isOpen, sourceStorage.id]);

  // Calculate total weight to transfer based on selected sizes
  const totalWeightToTransfer = itemsToTransfer
    .filter(item => selectedSizes.has(item.size))
    .reduce((sum, item) => sum + item.total_weight, 0);

  // Calculate total pieces to transfer based on selected sizes
  const totalPiecesToTransfer = itemsToTransfer
    .filter(item => selectedSizes.has(item.size))
    .reduce((sum, item) => sum + item.quantity, 0);

  // Handle select all toggle
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSizes(new Set(itemsToTransfer.map(item => item.size)));
    } else {
      setSelectedSizes(new Set());
    }
  };

  // Handle individual size toggle
  const handleSizeToggle = (size: number, checked: boolean) => {
    const newSelectedSizes = new Set(selectedSizes);
    if (checked) {
      newSelectedSizes.add(size);
    } else {
      newSelectedSizes.delete(size);
    }
    setSelectedSizes(newSelectedSizes);
  };

  // Check if all sizes are selected
  const allSizesSelected = selectedSizes.size === itemsToTransfer.length;
  const someSizesSelected = selectedSizes.size > 0;

  const loadAvailableStorages = async () => {
    setLoading(true);
    setError(null);
    try {
      const storages = await inventoryService.getAvailableStorageLocationsForTransfer(sourceStorage.id);
      
      // Calculate current selected weight
      const currentSelectedWeight = itemsToTransfer
        .filter(item => selectedSizes.has(item.size))
        .reduce((sum, item) => sum + item.total_weight, 0);
      
      // Only show storages that have enough space for the selected amount
      const suitableStorages = storages.filter(storage => {
        const hasEnoughSpace = storage.available_capacity_kg >= currentSelectedWeight;
        console.log(`${storage.name}: ${storage.available_capacity_kg}kg available, need ${currentSelectedWeight.toFixed(1)}kg - ${hasEnoughSpace ? 'SUITABLE' : 'NOT ENOUGH SPACE'}`);
        return hasEnoughSpace;
      });
      
      console.log(`Found ${suitableStorages.length} suitable storage locations for ${currentSelectedWeight.toFixed(1)}kg transfer`);
      console.log('Suitable storages:', suitableStorages);
      
      setAvailableStorages(suitableStorages);
      
      if (suitableStorages.length === 0) {
        setError(`No storage locations have enough capacity for this transfer. Total weight to transfer: ${currentSelectedWeight.toFixed(1)}kg`);
      } else {
        console.log(`Found ${suitableStorages.length} suitable storage locations for transfer`);
      }
    } catch (err: any) {
      console.error("Error loading available storages:", err);
      setError(err.message || "Failed to load available storage locations");
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    // Prevent double submission
    if (transferring) {
      return;
    }

    if (!selectedStorageId) {
      setError("Please select a destination storage location");
      return;
    }

    if (selectedSizes.size === 0) {
      setError("Please select at least one size to transfer");
      return;
    }

    setTransferring(true);
    setError(null);

    try {
      console.log('Creating transfer request...');
      console.log('Source storage:', sourceStorage);
      console.log('Destination storage ID:', selectedStorageId);
      console.log('Selected sizes:', Array.from(selectedSizes));
      console.log('Items to transfer:', itemsToTransfer.filter(item => selectedSizes.has(item.size)));
      
      // Get selected items only
      const selectedItems = itemsToTransfer.filter(item => selectedSizes.has(item.size));
      const totalQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalWeight = selectedItems.reduce((sum, item) => sum + item.total_weight, 0);
      
      console.log(`Creating batch transfer for ${selectedItems.length} selected size classes, total quantity: ${totalQuantity}, total weight: ${totalWeight}kg`);
      
      // Prepare size data for batch transfer
      const sizeData = selectedItems.map(item => ({
        size: item.size,
        quantity: item.quantity,
        weightKg: item.total_weight
      }));
      
      // Create batch transfer request
      const result = await inventoryService.createBatchTransfer(
        sourceStorage.id,
        selectedStorageId,
        sizeData,
        `Transfer from ${sourceStorage.name} - Sizes: ${Array.from(selectedSizes).sort().join(', ')} - ${transferNotes || 'No notes'}`,
        user?.id
      );
      
      console.log('Batch transfer created:', result);
      
      // Show success message and immediately start transition
      setSuccess(`Transfer request created successfully for ${selectedItems.length} size${selectedItems.length !== 1 ? 's' : ''}! Awaiting approval.`);
      
      // Immediately call onTransferComplete to refresh the parent component
      onTransferComplete();
      
      // Close dialog after a brief delay to show success message
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err: any) {
      console.error("Error creating transfer request:", err);
      
      // Handle specific error cases with better user guidance
      if (err.message && (err.message.includes("already exists") || err.message.includes("409"))) {
        setError("A transfer request for these items already exists. Please check the 'Transfer Approvals' section to review pending requests.");
      } else if (err.message && err.message.includes("ERR_CONNECTION_CLOSED")) {
        setError("Connection error. Please check your internet connection and try again.");
      } else if (err.message && err.message.includes("500")) {
        setError("Server error. Please try again in a moment.");
      } else if (err.message && err.message.includes("insufficient")) {
        setError("Insufficient inventory for this transfer. Please check available quantities.");
      } else {
        setError(err.message || "Failed to create transfer request. Please try again.");
      }
    } finally {
      setTransferring(false);
    }
  };

  const selectedStorage = availableStorages.find(s => s.id === selectedStorageId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5" />
            Transfer Stock from {sourceStorage.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto flex-1 pr-2">
          {/* Source Storage Info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Home className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{sourceStorage.name}</h3>
                  <p className="text-sm text-gray-600 capitalize">{sourceStorage.location_type.replace('_', ' ')}</p>
                </div>
                <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Items to Transfer */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Scale className="w-4 h-4" />
                  Fish to Transfer (by Weight)
                </h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all"
                    checked={allSizesSelected}
                    onCheckedChange={handleSelectAll}
                  />
                  <label
                    htmlFor="select-all"
                    className="text-sm font-medium text-gray-700 cursor-pointer"
                  >
                    Select All
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                {itemsToTransfer.map((item, index) => (
                  <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${
                    selectedSizes.has(item.size) 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`size-${item.size}`}
                        checked={selectedSizes.has(item.size)}
                        onCheckedChange={(checked) => handleSizeToggle(item.size, checked as boolean)}
                      />
                      <Badge variant="outline" className="w-16 justify-center">
                        Size {item.size}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-blue-600" />
                        <span className="font-semibold text-blue-600">{item.total_weight.toFixed(1)}kg</span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.quantity} pieces
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div>
                    <span className="font-semibold text-gray-900">Total Weight</span>
                    <div className="text-sm text-gray-600">
                      {totalPiecesToTransfer} pieces selected
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-green-600" />
                    <span className="font-bold text-green-600 text-lg">{totalWeightToTransfer.toFixed(1)}kg</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Available Storage Locations */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Home className="w-4 h-4" />
                Available Storage Locations
              </h3>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Loading available storage locations...</span>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="p-1 bg-red-100 rounded-full">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-red-800 mb-1">Transfer Request Failed</h4>
                      <p className="text-sm text-red-700">{error}</p>
                      {error.includes("already exists") && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-xs text-blue-700">
                            💡 <strong>Tip:</strong> Navigate to "Transfer Approvals" to review and approve existing requests.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : availableStorages.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No suitable storage locations found</p>
                  <p className="text-sm text-gray-500 mt-1">
                    All active storage locations are at capacity or don't have enough space
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableStorages.map((storage) => (
                    <div
                      key={storage.id}
                      className={`p-4 border rounded-lg transition-all ${
                        selectedStorageId === storage.id
                          ? 'border-blue-300 bg-blue-50 cursor-pointer'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 cursor-pointer'
                      }`}
                      onClick={() => {
                        setSelectedStorageId(storage.id);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            selectedStorageId === storage.id
                              ? 'border-blue-600 bg-blue-600'
                              : 'border-gray-300'
                          }`}>
                            {selectedStorageId === storage.id && (
                              <CheckCircle className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{storage.name}</h4>
                            <p className="text-sm text-gray-600 capitalize">
                              {storage.location_type.replace('_', ' ')}
                            </p>
                          </div>
                        </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2 mb-1">
                              <Scale className="w-4 h-4 text-green-600" />
                              <span className="font-semibold text-green-600">
                                {storage.available_capacity_kg.toFixed(1)}kg available
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mb-1">
                              {storage.current_usage_kg.toFixed(1)}kg / {storage.capacity_kg.toFixed(1)}kg used
                            </div>
                            <div className="text-xs text-blue-600 font-medium">
                              Need: {totalWeightToTransfer.toFixed(1)}kg
                            </div>
                            <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                              <div
                                className={`h-2 rounded-full ${
                                  storage.utilization_percent >= 90
                                    ? 'bg-red-500'
                                    : storage.utilization_percent >= 70
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(storage.utilization_percent, 100)}%` }}
                              />
                            </div>
                          </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Success Message */}
          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-1 bg-green-100 rounded-full">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-green-800 mb-1">Transfer Request Created</h4>
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              </div>
            </div>
          )}

          {/* Transfer Notes */}
          <Card>
            <CardContent className="p-4">
              <Label htmlFor="transfer-notes" className="text-sm font-medium text-gray-700">
                Transfer Notes (Optional)
              </Label>
              <Textarea
                id="transfer-notes"
                placeholder="Add notes about this transfer..."
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Selected Storage Summary */}
          {selectedStorage && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                  Selected Destination
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{selectedStorage.name}</p>
                    <p className="text-sm text-gray-600">
                      Will have {(selectedStorage.available_capacity_kg - totalWeightToTransfer).toFixed(1)}kg remaining after transfer
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600 mb-1">
                      Transfer: {totalWeightToTransfer.toFixed(1)}kg
                    </div>
                    <div className="text-sm text-gray-600">
                      Current: {selectedStorage.utilization_percent.toFixed(1)}% used
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={transferring}>
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedStorageId || transferring || availableStorages.length === 0 || selectedSizes.size === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {transferring ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4 mr-2" />
                Transfer Stock
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
