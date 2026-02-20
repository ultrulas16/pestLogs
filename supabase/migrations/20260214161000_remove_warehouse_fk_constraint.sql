-- Fix warehouse_transfers to accept admin_warehouses IDs
-- The issue: from_warehouse_id has a foreign key to warehouses table
-- But we need to transfer from admin_warehouses

-- Solution: Drop the strict foreign key constraint on from_warehouse_id
-- This allows flexibility for transfers from both warehouses and admin_warehouses

-- Drop the foreign key constraint
ALTER TABLE warehouse_transfers 
DROP CONSTRAINT IF EXISTS warehouse_transfers_from_warehouse_id_fkey;

-- We keep to_warehouse_id constraint since operator warehouses are in warehouses table
-- from_warehouse_id can now be any UUID (admin_warehouses or warehouses)

-- Add a comment to document this
COMMENT ON COLUMN warehouse_transfers.from_warehouse_id IS 
'Source warehouse ID - can reference either warehouses or admin_warehouses table';
