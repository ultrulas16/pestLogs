-- COMPLETE RLS FIX for Operator Access
-- Problem: Operators cannot see main warehouse stock because they can't see the warehouse record.
-- Solution: Allow operators to see ANY warehouse belonging to their company.

-- 1. Enable reading of OPERATORS table (Base requirement)
DROP POLICY IF EXISTS "Operators view own data" ON operators;
CREATE POLICY "Operators view own data"
ON operators FOR SELECT TO authenticated
USING (profile_id = auth.uid());

-- 2. Enable reading of WAREHOUSES table
-- Allow seeing warehouses if the user is an operator for that company
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

-- 3. Enable reading of WAREHOUSE_ITEMS table
-- Allow seeing items if the user is an operator for the warehouse's company
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

-- 4. Enable reading of COMPANY_MATERIALS table
-- Allow seeing materials if the user is an operator for that company
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
