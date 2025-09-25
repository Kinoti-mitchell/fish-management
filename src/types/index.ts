export type NavigationSection =
  | "dashboard"
  | "warehouse-entry"
  | "processing"
  | "sorting"
  | "inventory"
  | "transfers"
  | "disposal"
  | "outlet-orders"
  | "dispatch"
  | "outlet-receiving"
  | "reports"
  | "user-management";

export interface Fish {
  id: string;
  size: number; // 0-10 scale (0-10 ready for dispatch)
  weight: number;
  grade: "A" | "B" | "C";
  status: "received" | "processed" | "graded" | "stored" | "dispatched";
  entryDate: string;
  location: string;
  farmerId: string;
  farmerName: string;
  pricePerKg: number; // in Kenyan Shillings
  totalValue: number; // in Kenyan Shillings
  readyForDispatch: boolean; // true if size 0-10
}

export interface WarehouseEntry {
  id: string;
  entryDate: string;
  totalWeight: number;
  totalPieces: number;
  receivedBy: string;
  condition: "excellent" | "good" | "fair" | "poor";
  temperature?: number;
  farmerName: string;
  farmerPhone: string;
  farmerLocation: string; // Homabay area
  pricePerKg: number; // in Kenyan Shillings
  totalValue: number; // in Kenyan Shillings
  notes?: string;
}

export interface ProcessingRecord {
  id: string;
  warehouseEntryId: string;
  processingDate: string;
  processedBy: string;
  preProcessingWeight: number;
  postProcessingWeight: number;
  processingWaste: number;
  processingYield: number; // percentage
  sizeDistribution: { [size: number]: number }; // size: quantity
  gradingResults: { [grade: string]: number }; // grade: quantity
  finalValue: number; // in Kenyan Shillings
  readyForDispatchCount: number; // count of size 0-10 fish
}

export interface OutletOrder {
  id: string;
  outlet_id: string;
  outlet?: {
    id: string;
    name: string;
    location: string;
    phone: string;
    manager_name?: string;
    status: string;
  };
  order_date: string;
  delivery_date?: string;
  requested_sizes?: number[]; // Array of sizes 0-10
  requested_quantity?: number;
  requested_grade?: "A" | "B" | "C" | "any";
  price_per_kg?: number; // in Kenyan Shillings
  total_value: number; // in Kenyan Shillings
  status: "pending" | "confirmed" | "processing" | "dispatched" | "delivered" | "cancelled";
  confirmed_date?: string;
  dispatch_date?: string;
  completed_date?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Enhanced order properties
  order_number?: string;
  size_quantities?: Record<number, number>; // size -> quantity in kg
  use_any_size?: boolean; // flag for "any size" orders
}

export interface DispatchRecord {
  id: string;
  outletOrderId: string;
  fishIds: string[];
  destination: string; // Kenyan towns/cities
  dispatchDate: string;
  dispatchedBy: string;
  totalWeight: number;
  totalPieces: number;
  sizeBreakdown: { [size: number]: number }; // size: quantity
  totalValue: number; // in Kenyan Shillings
  status: "scheduled" | "in-transit" | "delivered";
  notes?: string;
}

export interface OutletReceiving {
  id: string;
  dispatchId: string;
  outletOrderId: string;
  outletName: string;
  outletLocation: string; // Kenyan town/city
  receivedDate: string;
  receivedBy: string; // UUID of the user who received the items
  receivedByUser?: { // User object with name information
    first_name: string;
    last_name: string;
  };
  expectedWeight: number;
  actualWeightReceived: number;
  expectedPieces: number;
  actualPiecesReceived: number;
  expectedValue: number; // in Kenyan Shillings
  actualValueReceived: number; // in Kenyan Shillings
  condition: "excellent" | "good" | "fair" | "poor";
  sizeDiscrepancies?: { [size: number]: number }; // size: difference
  discrepancyNotes?: string;
  status: "pending" | "confirmed" | "disputed";
}

export interface ReportData {
  id: string;
  reportType: "daily" | "weekly" | "monthly" | "custom";
  dateRange: {
    start: string;
    end: string;
  };
  generatedBy: string;
  generatedAt: string;
  data: {
    warehouseEntries: number;
    totalWeight: number;
    totalValue: number;
    processingEfficiency: number;
    outletOrders: number;
    dispatches: number;
    sizeDistribution: { [size: number]: number };
    gradeDistribution: { [grade: string]: number };
    farmerPerformance: { [farmerId: string]: any };
    outletPerformance: { [outletId: string]: any };
  };
}

export interface Farmer {
  id: string;
  name: string;
  phone: string;
  location: string; // Homabay area
  rating: number;
  reliability: "excellent" | "good" | "fair" | "poor";
  status: "active" | "inactive";
  averageFishSize: number; // typical size range they provide
}

export interface AppState {
  appState: "landing" | "login" | "app";
  isLoggedIn: boolean;
  user?: {
    id: string; // Supabase user UUID
    email: string;
    role?: "admin" | "manager" | "operator"; // optional (from metadata/db)
  };
  currentSection: NavigationSection;
  selectedItemId?: string;
}

export interface DashboardStats {
  warehouseEntries: number;
  processingQueue: number;
  readyForDispatch: number; // size 0-10 fish count
  totalStock: number;
  outletOrders: number;
  pendingDispatches: number;
  totalValue: number; // in Kenyan Shillings
  averageFishSize: number;
}

// Sorting Module Types
export interface SizeClassThreshold {
  id: string;
  class_number: number;
  min_weight_grams: number;
  max_weight_grams: number;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface SortingBatch {
  id: string;
  processing_record_id: string;
  batch_number: string;
  total_weight_grams: number;
  total_pieces: number;
  sorting_date: string;
  sorted_by?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  notes?: string;
  created_at: string;
  updated_at: string;
  // Related data
  processing_record?: {
    id: string;
    processing_date: string;
    post_processing_weight: number;
    ready_for_dispatch_count: number;
  };
  sorted_by_user?: {
    id: string;
    email: string;
  };
}

export interface SortedFishItem {
  id: string;
  sorting_batch_id: string;
  size_class: number;
  weight_grams: number;
  length_cm?: number;
  grade?: 'A' | 'B' | 'C';
  quality_notes?: string;
  created_at: string;
}

export interface SortingResult {
  id: string;
  sorting_batch_id: string;
  size_class: number;
  total_pieces: number;
  total_weight_grams: number;
  average_weight_grams: number;
  grade_distribution: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface SortingSummary {
  batch_id: string;
  batch_number: string;
  total_items: number;
  total_weight: number;
  size_class_distribution: Record<number, {
    pieces: number;
    weight: number;
    average_weight: number;
  }>;
  grade_distribution: Record<string, number>;
  completion_percentage: number;
}

// Disposal Module Types
export interface DisposalReason {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DisposalRecord {
  id: string;
  disposal_number: string;
  disposal_date: string;
  disposal_reason_id: string;
  disposal_reason?: DisposalReason;
  total_weight_kg: number;
  total_pieces: number;
  disposal_method: 'compost' | 'waste' | 'donation' | 'return_to_farmer';
  disposal_location?: string;
  disposal_cost: number;
  notes?: string;
  disposed_by: string;
  approved_by?: string;
  status: 'pending' | 'approved' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface DisposalItem {
  id: string;
  disposal_record_id: string;
  sorting_result_id: string;
  size_class: number;
  quantity: number;
  weight_kg: number;
  batch_number?: string;
  storage_location_name?: string;
  farmer_name?: string;
  processing_date?: string;
  quality_notes?: string;
  disposal_reason?: string;
  created_at: string;
}