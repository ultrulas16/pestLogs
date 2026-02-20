-- Fix RLS policies for operators to access warehouses and items

-- 1. Policies for 'warehouses' table
DROP POLICY IF EXISTS "Operators can view their company warehouses" ON warehouses;

CREATE POLICY "Operators can view their company warehouses"
ON warehouses
FOR SELECT
TO authenticated
USING (
  -- Operator can see warehouses belonging to their company
  exists (
    select 1 from operators
    where operators.profile_id = auth.uid()
    and operators.company_id = warehouses.company_id
  )
);

-- 2. Policies for 'warehouse_items' table
DROP POLICY IF EXISTS "Operators can view items in their company warehouses" ON warehouse_items;

CREATE POLICY "Operators can view items in their company warehouses"
ON warehouse_items
FOR SELECT
TO authenticated
USING (
  -- Operator can see items if they have access to the warehouse
  exists (
    select 1 from warehouses
    join operators on operators.company_id = warehouses.company_id
    where warehouses.id = warehouse_items.warehouse_id
    and operators.profile_id = auth.uid()
  )
);

-- 3. Ensure operators can also see 'company_materials' (should already exist, but reinforcing)
DROP POLICY IF EXISTS "Operators can view company materials" ON company_materials;

CREATE POLICY "Operators can view company materials"
ON company_materials
FOR SELECT
TO authenticated
USING (
  exists (
    select 1 from operators
    where operators.profile_id = auth.uid()
    and operators.company_id = company_materials.company_id
  )
);
