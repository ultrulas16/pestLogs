-- Add RLS policies for operators to access admin_warehouses and admin_warehouse_items

-- Operators can view their company's admin warehouse
DROP POLICY IF EXISTS "Operators can view company admin warehouse" ON admin_warehouses;
CREATE POLICY "Operators can view company admin warehouse"
ON admin_warehouses FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM operators
    WHERE operators.profile_id = auth.uid()
    AND operators.company_id = admin_warehouses.company_id
  )
);

-- Operators can view items in their company's admin warehouse
DROP POLICY IF EXISTS "Operators can view company admin warehouse items" ON admin_warehouse_items;
CREATE POLICY "Operators can view company admin warehouse items"
ON admin_warehouse_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_warehouses
    JOIN operators ON operators.company_id = admin_warehouses.company_id
    WHERE admin_warehouses.id = admin_warehouse_items.warehouse_id
    AND operators.profile_id = auth.uid()
  )
);
