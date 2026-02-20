-- Add is_checked column to visits table for calendar approval
ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS is_checked boolean DEFAULT false;

-- Add is_invoiced column to paid_material_sales table for material invoicing status
-- Corrected from visit_paid_products to paid_material_sales based on visits.tsx usage
ALTER TABLE paid_material_sales 
ADD COLUMN IF NOT EXISTS is_invoiced boolean DEFAULT false;
