-- Auto-create main warehouse for new company users
-- This trigger ensures every company has a main warehouse automatically

CREATE OR REPLACE FUNCTION create_main_warehouse_for_company()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create warehouse for company role users
  IF NEW.role = 'company' AND NEW.company_id IS NOT NULL THEN
    -- Check if main warehouse already exists
    IF NOT EXISTS (
      SELECT 1 FROM warehouses 
      WHERE company_id = NEW.company_id 
      AND warehouse_type = 'company_main'
    ) THEN
      -- Create main warehouse
      INSERT INTO warehouses (
        name,
        warehouse_type,
        company_id,
        location
      ) VALUES (
        'Ana Depo',
        'company_main',
        NEW.company_id,
        'Merkez'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS create_main_warehouse_on_company_insert ON profiles;

-- Create trigger
CREATE TRIGGER create_main_warehouse_on_company_insert
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_main_warehouse_for_company();

-- Also create warehouses for existing companies that don't have one
INSERT INTO warehouses (name, warehouse_type, company_id, location)
SELECT 
  'Ana Depo',
  'company_main',
  p.company_id,
  'Merkez'
FROM profiles p
WHERE p.role = 'company' 
  AND p.company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM warehouses w 
    WHERE w.company_id = p.company_id 
    AND w.warehouse_type = 'company_main'
  )
GROUP BY p.company_id;
