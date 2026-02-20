-- COMPLETE FIX: Operator Transfer Request System
-- This migration fixes ALL operator access issues

-- ============================================
-- PART 1: OPERATORS TABLE ACCESS
-- ============================================
DROP POLICY IF EXISTS "Operators view own data" ON operators;
CREATE POLICY "Operators view own data"
ON operators FOR SELECT TO authenticated
USING (profile_id = auth.uid());

-- ============================================
-- PART 2: WAREHOUSES TABLE ACCESS
-- ============================================
-- Operators can see their company's warehouses
DROP POLICY IF EXISTS "Operators view company warehouses" ON warehouses;
CREATE POLICY "Operators view company warehouses"
ON warehouses FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM operators 
    WHERE operators.profile_id = auth.uid() 
    AND operators.company_id = warehouses.company_id
  )
);

-- Operators can INSERT their own warehouse if it doesn't exist
DROP POLICY IF EXISTS "Operators can create own warehouse" ON warehouses;
CREATE POLICY "Operators can create own warehouse"
ON warehouses FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM operators
    WHERE operators.profile_id = auth.uid()
    AND operators.id = warehouses.operator_id
    AND operators.company_id = warehouses.company_id
  )
);

-- ============================================
-- PART 3: WAREHOUSE_ITEMS TABLE ACCESS
-- ============================================
DROP POLICY IF EXISTS "Operators view company items" ON warehouse_items;
CREATE POLICY "Operators view company items"
ON warehouse_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM warehouses
    JOIN operators ON operators.company_id = warehouses.company_id
    WHERE warehouses.id = warehouse_items.warehouse_id
    AND operators.profile_id = auth.uid()
  )
);

-- ============================================
-- PART 4: COMPANY_MATERIALS TABLE ACCESS
-- ============================================
DROP POLICY IF EXISTS "Operators view materials" ON company_materials;
CREATE POLICY "Operators view materials"
ON company_materials FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM operators
    WHERE operators.profile_id = auth.uid()
    AND operators.company_id = company_materials.company_id
  )
);

-- ============================================
-- PART 5: WAREHOUSE_TRANSFERS TABLE ACCESS (CRITICAL!)
-- ============================================

-- Operators can INSERT transfer requests
DROP POLICY IF EXISTS "Operators can create transfer requests" ON warehouse_transfers;
CREATE POLICY "Operators can create transfer requests"
ON warehouse_transfers FOR INSERT TO authenticated
WITH CHECK (
  -- Must be an operator
  EXISTS (
    SELECT 1 FROM operators
    WHERE operators.profile_id = auth.uid()
  )
  AND
  -- The requested_by must be the current user
  requested_by = auth.uid()
);

-- Operators can VIEW their own transfer requests
DROP POLICY IF EXISTS "Operators view own transfers" ON warehouse_transfers;
CREATE POLICY "Operators view own transfers"
ON warehouse_transfers FOR SELECT TO authenticated
USING (
  requested_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM warehouses
    JOIN operators ON operators.company_id = warehouses.company_id
    WHERE warehouses.id = warehouse_transfers.to_warehouse_id
    AND operators.profile_id = auth.uid()
  )
);
