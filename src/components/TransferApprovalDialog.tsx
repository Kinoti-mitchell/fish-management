"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { 
  CheckCircle, 
  XCircle, 
  Package, 
  Scale, 
  AlertCircle,
  Loader2
} from "lucide-react";

interface TransferApprovalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transferRequest: {
    id: string;
    from_storage_name: string;
    to_storage_name: string;
    size_class: number;
    quantity: number;
    weight_kg: number;
    notes?: string;
    created_at: string;
    is_bulk?: boolean;
    batch_size?: number;
    batch_transfers?: any[];
  };
  onApprove: (requestId: string, approvedBy: string) => Promise<void>;
  onDecline: (requestId: string, approvedBy: string) => Promise<void>;
  currentUserId: string;
}

export default function TransferApprovalDialog({
  isOpen,
  onClose,
  transferRequest,
  onApprove,
  onDecline,
  currentUserId,
}: TransferApprovalDialogProps) {
  const [approvalNotes, setApprovalNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setProcessing(true);
    setError(null);
    try {
      await onApprove(transferRequest.id, currentUserId);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to approve transfer");
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    setProcessing(true);
    setError(null);
    try {
      await onDecline(transferRequest.id, currentUserId);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to decline transfer");
    } finally {
      setProcessing(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            Transfer Approval Required
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Transfer Request Details */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Transfer Request Details
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">From Storage</Label>
                  <p className="font-semibold text-gray-900">{transferRequest.from_storage_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">To Storage</Label>
                  <p className="font-semibold text-gray-900">{transferRequest.to_storage_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Size Class</Label>
                  <Badge variant="outline" className="w-auto justify-center">
                    {transferRequest.is_bulk ? transferRequest.size_class : `Size ${transferRequest.size_class}`}
                  </Badge>
                  {transferRequest.is_bulk && (
                    <p className="text-xs text-gray-500 mt-1">
                      {transferRequest.batch_size} size{transferRequest.batch_size !== 1 ? 's' : ''} in batch
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium text-gray-600">Total Weight</Label>
                  <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5 text-green-600" />
                    <span className="font-bold text-green-600 text-lg">{transferRequest.weight_kg.toFixed(1)}kg</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Piece Count</Label>
                  <p className="text-sm text-gray-500">{transferRequest.quantity.toLocaleString()} pieces</p>
                </div>
                {transferRequest.notes && (
                  <div className="col-span-2">
                    <Label className="text-sm font-medium text-gray-600">Notes</Label>
                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{transferRequest.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Approval Notes */}
          <Card>
            <CardContent className="p-4">
              <Label htmlFor="approval-notes" className="text-sm font-medium text-gray-700">
                Approval Notes (Optional)
              </Label>
              <Textarea
                id="approval-notes"
                placeholder="Add any notes about this approval decision..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleDecline}
              disabled={processing}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Decline Transfer
            </Button>
            <Button
              onClick={handleApprove}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Approve & Complete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
