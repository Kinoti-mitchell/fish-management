/**
 * Outlet Order Inventory Integration Service
 * 
 * This service integrates outlet orders with the current inventory system,
 * providing real-time stock availability and safe order dispatch functionality.
 */

import { supabase, handleSupabaseError, withRetry } from '../lib/supabaseClient';
import { inventoryService } from './inventoryService';

// Types for inventory-aware ordering
export interface AvailableStock {
  size: number;
  total_quantity: number;
  total_weight_kg: number;
  storage_locations: {
    storage_location_id: string;
    storage_location_name: string;
    quantity: number;
    weight_kg: number;
    contributing_batches: any[];
  }[];
}

export interface OrderItem {
  size: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  selected_batches?: {
    batch_id: string;
    batch_number: string;
    quantity: number;
    weight_kg: number;
    storage_location_name: string;
  }[];
}

export interface InventoryAwareOrder {
  id: string;
  outlet_id: string;
  outlet_name: string;
  order_date: string;
  delivery_date?: string;
  items: OrderItem[];
  total_value: number;
  status: 'pending' | 'confirmed' | 'processing' | 'dispatched' | 'delivered' | 'cancelled';
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderFulfillmentPlan {
  order_id: string;
  can_fulfill: boolean;
  fulfillment_items: {
    size: number;
    requested_quantity: number;
    available_quantity: number;
    selected_batches: {
      batch_id: string;
      batch_number: string;
      quantity: number;
      weight_kg: number;
      storage_location_name: string;
    }[];
    shortfall?: number;
  }[];
  total_shortfall: number;
  estimated_dispatch_weight: number;
}

class OutletOrderInventoryService {
  /**
   * Get oldest batches for a specific size (FIFO priority)
   * This ensures outlet orders get the oldest inventory first
   */
  async getOldestBatchesForSize(size: number): Promise<any[]> {
    try {
      const oldestBatches = await inventoryService.getOldestBatchForRemoval();
      return oldestBatches
        .filter(batch => batch.size_class === size)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } catch (error) {
      console.error('Error getting oldest batches for size:', error);
      return [];
    }
  }

  /**
   * Get available stock for outlet ordering
   * This shows real-time inventory organized by size and storage location
   */
  async getAvailableStockForOrdering(): Promise<AvailableStock[]> {
    try {
      // Use the existing inventory service to get inventory by storage
      const inventoryByStorage = await inventoryService.getInventoryByStorage();
      
      // Group by size across all storage locations
      const sizeAggregation: Record<number, AvailableStock> = {};
      
      inventoryByStorage.forEach(item => {
        const size = item.size;
        
        if (!sizeAggregation[size]) {
          sizeAggregation[size] = {
            size,
            total_quantity: 0,
            total_weight_kg: 0,
            storage_locations: []
          };
        }
        
        // Add to total
        sizeAggregation[size].total_quantity += item.total_quantity;
        sizeAggregation[size].total_weight_kg += item.total_weight_kg;
        
        // Add storage location details
        sizeAggregation[size].storage_locations.push({
          storage_location_id: item.storage_location_id,
          storage_location_name: item.storage_location_name,
          quantity: item.total_quantity,
          weight_kg: item.total_weight_kg,
          contributing_batches: item.contributing_batches || []
        });
      });
      
      // Convert to array and sort by size
      return Object.values(sizeAggregation).sort((a, b) => a.size - b.size);
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching available stock for ordering'));
    }
  }

  /**
   * Create an inventory-aware outlet order
   */
  async createInventoryAwareOrder(orderData: {
    outlet_id: string;
    delivery_date?: string;
    items: Omit<OrderItem, 'total_price'>[];
    notes?: string;
    created_by?: string;
  }): Promise<InventoryAwareOrder> {
    try {
      // Validate stock availability for all items
      const availableStock = await this.getAvailableStockForOrdering();
      const stockMap = new Map(availableStock.map(stock => [stock.size, stock]));
      
      // Check availability and calculate totals
      const validatedItems: OrderItem[] = [];
      let totalValue = 0;
      
      for (const item of orderData.items) {
        const available = stockMap.get(item.size);
        if (!available || available.total_quantity < item.quantity) {
          throw new Error(`Insufficient stock for size ${item.size}. Available: ${available?.total_quantity || 0}, Requested: ${item.quantity}`);
        }
        
        const totalPrice = item.quantity * item.unit_price;
        validatedItems.push({
          ...item,
          total_price: totalPrice
        });
        totalValue += totalPrice;
      }
      
      // Get outlet information
      const { data: outlet, error: outletError } = await withRetry(async () => {
        return await supabase
          .from('outlets')
          .select('name')
          .eq('id', orderData.outlet_id)
          .single();
      });
      
      if (outletError) throw outletError;
      
      // Create the order in the database
      const { data: order, error: orderError } = await withRetry(async () => {
        return await supabase
          .from('outlet_orders')
          .insert([{
            outlet_id: orderData.outlet_id,
            order_date: new Date().toISOString(),
            delivery_date: orderData.delivery_date,
            requested_sizes: orderData.items.map(item => item.size),
            requested_quantity: orderData.items.reduce((sum, item) => sum + item.quantity, 0),
            price_per_kg: orderData.items[0]?.unit_price || 0, // Use first item's price as reference
            total_value: totalValue,
            status: 'pending',
            notes: orderData.notes,
            created_by: orderData.created_by
          }])
          .select()
          .single();
      });
      
      if (orderError) throw orderError;
      
      // Create order items
      for (const item of validatedItems) {
        const { error: itemError } = await withRetry(async () => {
          return await supabase
            .from('order_items')
            .insert([{
              order_id: order.id,
              size: item.size,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price
            }]);
        });
        
        if (itemError) throw itemError;
      }
      
      // Return the created order with full details
      return {
        id: order.id,
        outlet_id: order.outlet_id,
        outlet_name: outlet.name,
        order_date: order.order_date,
        delivery_date: order.delivery_date,
        items: validatedItems,
        total_value: order.total_value,
        status: order.status,
        notes: order.notes,
        created_by: order.created_by,
        created_at: order.created_at,
        updated_at: order.updated_at
      };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'creating inventory-aware order'));
    }
  }

  /**
   * Create a fulfillment plan for an order
   * This shows which specific batches will be used to fulfill the order
   */
  async createOrderFulfillmentPlan(orderId: string): Promise<OrderFulfillmentPlan> {
    try {
      // Get order details with items
      const { data: order, error: orderError } = await withRetry(async () => {
        return await supabase
          .from('outlet_orders')
          .select(`
            *,
            order_items(*)
          `)
          .eq('id', orderId)
          .single();
      });
      
      if (orderError) throw orderError;
      
      // Get current available stock
      const availableStock = await this.getAvailableStockForOrdering();
      const stockMap = new Map(availableStock.map(stock => [stock.size, stock]));
      
      // Create fulfillment plan for each item
      const fulfillmentItems = order.order_items.map((item: any) => {
        const available = stockMap.get(item.size);
        const requestedQuantity = item.quantity;
        const availableQuantity = available?.total_quantity || 0;
        
        // Select batches to fulfill this item (FIFO - First In, First Out)
        const selectedBatches: any[] = [];
        let remainingQuantity = requestedQuantity;
        
        if (available && available.storage_locations) {
          // Get oldest batches from inventory service for consistent FIFO ordering
          const oldestBatches = await inventoryService.getOldestBatchForRemoval();
          
          // Filter oldest batches for this specific size
          const sizeSpecificOldestBatches = oldestBatches
            .filter(batch => batch.size_class === item.size)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          
          // Use oldest batches first, then fall back to available stock batches
          const allBatches = [
            ...sizeSpecificOldestBatches.map(batch => ({
              batch_id: batch.batch_id,
              batch_number: batch.batch_number,
              quantity: batch.total_pieces,
              weight_kg: batch.total_weight_kg,
              created_at: batch.created_at,
              storage_location_name: batch.storage_location_name,
              isOldest: true
            })),
            ...available.storage_locations.flatMap(loc => 
              loc.contributing_batches.map(batch => ({
                ...batch,
                storage_location_name: loc.storage_location_name,
                isOldest: false
              }))
            ).filter(batch => 
              !sizeSpecificOldestBatches.some(oldest => oldest.batch_id === batch.batch_id)
            )
          ].sort((a, b) => {
            // Oldest batches first, then by creation date
            if (a.isOldest && !b.isOldest) return -1;
            if (!a.isOldest && b.isOldest) return 1;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
          
          for (const batch of allBatches) {
            if (remainingQuantity <= 0) break;
            
            const batchQuantity = Math.min(batch.quantity, remainingQuantity);
            selectedBatches.push({
              batch_id: batch.batch_id,
              batch_number: batch.batch_number,
              quantity: batchQuantity,
              weight_kg: (batchQuantity / batch.quantity) * batch.weight_kg,
              storage_location_name: batch.storage_location_name
            });
            
            remainingQuantity -= batchQuantity;
          }
        }
        
        return {
          size: item.size,
          requested_quantity: requestedQuantity,
          available_quantity: availableQuantity,
          selected_batches: selectedBatches,
          shortfall: Math.max(0, requestedQuantity - availableQuantity)
        };
      });
      
      const totalShortfall = fulfillmentItems.reduce((sum, item) => sum + item.shortfall, 0);
      const estimatedDispatchWeight = fulfillmentItems.reduce((sum, item) => 
        sum + item.selected_batches.reduce((batchSum, batch) => batchSum + batch.weight_kg, 0), 0
      );
      
      return {
        order_id: orderId,
        can_fulfill: totalShortfall === 0,
        fulfillment_items: fulfillmentItems,
        total_shortfall: totalShortfall,
        estimated_dispatch_weight: estimatedDispatchWeight
      };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'creating order fulfillment plan'));
    }
  }

  /**
   * Dispatch an order with inventory tracking
   * This safely reduces inventory and creates dispatch records
   */
  async dispatchOrderWithInventoryTracking(orderId: string): Promise<{
    success: boolean;
    dispatch_record_id?: string;
    inventory_updates: any[];
    message: string;
  }> {
    try {
      // Get fulfillment plan
      const fulfillmentPlan = await this.createOrderFulfillmentPlan(orderId);
      
      if (!fulfillmentPlan.can_fulfill) {
        return {
          success: false,
          message: `Cannot fulfill order. Shortfall: ${fulfillmentPlan.total_shortfall} pieces`
        };
      }
      
      // Start transaction-like operations
      const inventoryUpdates: any[] = [];
      
      // Update inventory for each fulfilled item
      for (const item of fulfillmentPlan.fulfillment_items) {
        for (const batch of item.selected_batches) {
          // Create inventory entry for this dispatch
          const { data: inventoryEntry, error: entryError } = await withRetry(async () => {
            return await supabase
              .from('inventory_entries')
              .insert([{
                size: item.size,
                quantity_change: -batch.quantity, // Negative for dispatch
                entry_type: 'order_dispatch',
                reference_id: orderId,
                notes: `Order dispatch - Batch: ${batch.batch_number}, Storage: ${batch.storage_location_name}`
              }])
              .select()
              .single();
          });
          
          if (entryError) throw entryError;
          inventoryUpdates.push(inventoryEntry);
        }
      }
      
      // Update order status
      const { error: orderUpdateError } = await withRetry(async () => {
        return await supabase
          .from('outlet_orders')
          .update({
            status: 'dispatched',
            dispatch_date: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);
      });
      
      if (orderUpdateError) throw orderUpdateError;
      
      // Create dispatch record
      const { data: dispatchRecord, error: dispatchError } = await withRetry(async () => {
        return await supabase
          .from('dispatch_records')
          .insert([{
            outlet_order_id: orderId,
            dispatch_date: new Date().toISOString(),
            total_weight_kg: fulfillmentPlan.estimated_dispatch_weight,
            total_pieces: fulfillmentPlan.fulfillment_items.reduce((sum, item) => sum + item.requested_quantity, 0),
            status: 'dispatched',
            notes: `Automated dispatch with inventory tracking. Weight: ${fulfillmentPlan.estimated_dispatch_weight.toFixed(2)}kg`
          }])
          .select()
          .single();
      });
      
      if (dispatchError) throw dispatchError;
      
      return {
        success: true,
        dispatch_record_id: dispatchRecord.id,
        inventory_updates: inventoryUpdates,
        message: `Order dispatched successfully. Weight: ${fulfillmentPlan.estimated_dispatch_weight.toFixed(2)}kg`
      };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'dispatching order with inventory tracking'));
    }
  }

  /**
   * Get inventory-aware outlet orders
   */
  async getInventoryAwareOrders(): Promise<InventoryAwareOrder[]> {
    try {
      const { data: orders, error } = await withRetry(async () => {
        return await supabase
          .from('outlet_orders')
          .select(`
            *,
            outlet:outlets(name, location, phone, manager_name, status),
            order_items(*)
          `)
          .order('order_date', { ascending: false });
      });
      
      if (error) throw error;
      
      return (orders || []).map(order => ({
        id: order.id,
        outlet_id: order.outlet_id,
        outlet_name: order.outlet?.name || 'Unknown Outlet',
        order_date: order.order_date,
        delivery_date: order.delivery_date,
        items: (order.order_items || []).map((item: any) => ({
          size: item.size,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        })),
        total_value: order.total_value,
        status: order.status,
        notes: order.notes,
        created_by: order.created_by,
        created_at: order.created_at,
        updated_at: order.updated_at
      }));
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching inventory-aware orders'));
    }
  }

  /**
   * Get order impact on inventory
   * Shows how orders affect current stock levels
   */
  async getOrderInventoryImpact(): Promise<{
    current_stock: AvailableStock[];
    pending_orders_impact: {
      size: number;
      reserved_quantity: number;
      reserved_weight_kg: number;
    }[];
    recent_dispatches: {
      order_id: string;
      outlet_name: string;
      dispatch_date: string;
      total_weight_kg: number;
      total_pieces: number;
    }[];
  }> {
    try {
      // Get current stock
      const currentStock = await this.getAvailableStockForOrdering();
      
      // Get pending orders and their impact
      const { data: pendingOrders, error: pendingError } = await withRetry(async () => {
        return await supabase
          .from('outlet_orders')
          .select(`
            *,
            outlet:outlets(name),
            order_items(*)
          `)
          .in('status', ['pending', 'confirmed', 'processing']);
      });
      
      if (pendingError) throw pendingError;
      
      // Calculate reserved quantities by size
      const reservedBySize: Record<number, { quantity: number; weight_kg: number }> = {};
      
      pendingOrders?.forEach(order => {
        order.order_items?.forEach((item: any) => {
          if (!reservedBySize[item.size]) {
            reservedBySize[item.size] = { quantity: 0, weight_kg: 0 };
          }
          reservedBySize[item.size].quantity += item.quantity;
          // Estimate weight (using average weight per fish)
          const avgWeightPerFish = 0.5; // This could be made more sophisticated
          reservedBySize[item.size].weight_kg += item.quantity * avgWeightPerFish;
        });
      });
      
      const pendingOrdersImpact = Object.entries(reservedBySize).map(([size, data]) => ({
        size: parseInt(size),
        reserved_quantity: data.quantity,
        reserved_weight_kg: data.weight_kg
      }));
      
      // Get recent dispatches
      const { data: recentDispatches, error: dispatchError } = await withRetry(async () => {
        return await supabase
          .from('dispatch_records')
          .select(`
            *,
            outlet_order:outlet_orders(
              outlet:outlets(name)
            )
          `)
          .order('dispatch_date', { ascending: false })
          .limit(10);
      });
      
      if (dispatchError) throw dispatchError;
      
      const recentDispatchesFormatted = (recentDispatches || []).map(dispatch => ({
        order_id: dispatch.outlet_order_id,
        outlet_name: dispatch.outlet_order?.outlet?.name || 'Unknown Outlet',
        dispatch_date: dispatch.dispatch_date,
        total_weight_kg: dispatch.total_weight_kg,
        total_pieces: dispatch.total_pieces
      }));
      
      return {
        current_stock: currentStock,
        pending_orders_impact: pendingOrdersImpact,
        recent_dispatches: recentDispatchesFormatted
      };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching order inventory impact'));
    }
  }
}

// Export singleton instance
export const outletOrderInventoryService = new OutletOrderInventoryService();
export default outletOrderInventoryService;
