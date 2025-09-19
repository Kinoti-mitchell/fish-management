-- Fix get_inventory_summary_with_sorting function
-- The error is due to bigint vs integer mismatch in column 3

-- Drop the existing function
DROP FUNCTION IF EXISTS get_inventory_summary_with_sorting();

-- Recreate with correct data types
CREATE OR REPLACE FUNCTION get_inventory_summary_with_sorting()
RETURNS TABLE(
    size INTEGER,
    current_stock BIGINT,
    total_added_from_sorting BIGINT,
    total_dispatched BIGINT,
    last_sorting_date TIMESTAMP WITH TIME ZONE,
    last_dispatch_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        i.size,
        i.quantity as current_stock,
        COALESCE(sorting_adds.total_added, 0) as total_added_from_sorting,
        COALESCE(dispatch_removes.total_dispatched, 0) as total_dispatched,
        sorting_adds.last_sorting_date,
        dispatch_removes.last_dispatch_date
    FROM inventory i
    LEFT JOIN (
        SELECT 
            ie.size,
            SUM(ie.quantity_change) as total_added,
            MAX(ie.created_at) as last_sorting_date
        FROM inventory_entries ie
        WHERE ie.entry_type = 'sorting' AND ie.quantity_change > 0
        GROUP BY ie.size
    ) sorting_adds ON i.size = sorting_adds.size
    LEFT JOIN (
        SELECT 
            ie.size,
            ABS(SUM(ie.quantity_change)) as total_dispatched,
            MAX(ie.created_at) as last_dispatch_date
        FROM inventory_entries ie
        WHERE ie.entry_type = 'order_dispatch' AND ie.quantity_change < 0
        GROUP BY ie.size
    ) dispatch_removes ON i.size = dispatch_removes.size
    ORDER BY i.size;
END;
$$ LANGUAGE plpgsql;
