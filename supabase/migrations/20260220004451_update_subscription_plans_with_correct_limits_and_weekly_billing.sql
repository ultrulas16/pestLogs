/*
  # Update Subscription Plans with Correct Limits and Weekly Billing

  ## Summary
  Updates existing subscription plans to match the requested tier structure and adds
  weekly pricing support.

  ## Changes

  ### Modified Tables
  - `subscription_plans`
    - Added `price_weekly` column (numeric, default 0) for weekly billing option
    - Added `billing_period` column (text) to indicate default billing: 'weekly', 'monthly', 'yearly'
    - Updated all plan limits to match the defined tier structure:
      - Deneme (Trial): 7 days, 3 customers, 2 warehouses, 3 branches, 1 operator
      - Başlangıç: 10 customers, 30 branches, 2 operators, 3 warehouses
      - Gelişmiş: 500 customers, 2000 branches, 20 operators, 21 warehouses
      - Kurumsal: 50 customers, 200 branches, 5 operators, 6 warehouses
      - Pro: 1000 customers, 5000 branches, 30 operators, 31 warehouses (weekly billing)

  ## Notes
  - Existing plan IDs are preserved
  - New Pro plan inserted if not exists
  - billing_period defaults to 'monthly'
*/

-- Add weekly pricing and billing period columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'price_weekly'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN price_weekly numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'billing_period'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN billing_period text DEFAULT 'monthly';
  END IF;
END $$;

-- Update Deneme (Trial) plan: 3 customers, 1 operator, 2 warehouses, 3 branches
UPDATE subscription_plans
SET
  max_customers = 3,
  max_operators = 1,
  max_warehouses = 2,
  max_branches = 3,
  billing_period = 'trial',
  display_order = 0
WHERE is_trial = true;

-- Update Başlangıç plan: 10 customers, 2 operators, 3 warehouses, 30 branches
UPDATE subscription_plans
SET
  max_customers = 10,
  max_operators = 2,
  max_warehouses = 3,
  max_branches = 30,
  billing_period = 'monthly',
  display_order = 1
WHERE name = 'Başlangıç' AND is_trial = false;

-- Update Kurumsal plan: 50 customers, 5 operators, 6 warehouses, 200 branches
UPDATE subscription_plans
SET
  max_customers = 50,
  max_operators = 5,
  max_warehouses = 6,
  max_branches = 200,
  billing_period = 'monthly',
  display_order = 3
WHERE name = 'Kurumsal' AND is_trial = false;

-- Rename Profesyonel to Gelişmiş with correct limits: 500 customers, 20 operators, 21 warehouses, 2000 branches
UPDATE subscription_plans
SET
  name = 'Gelişmiş',
  max_customers = 500,
  max_operators = 20,
  max_warehouses = 21,
  max_branches = 2000,
  billing_period = 'monthly',
  display_order = 2
WHERE name = 'Profesyonel' AND is_trial = false;

-- Insert Pro plan if it doesn't exist: 1000 customers, 30 operators, 31 warehouses, 5000 branches, weekly billing
INSERT INTO subscription_plans (
  name,
  description,
  price_monthly,
  price_yearly,
  price_weekly,
  max_users,
  max_operators,
  max_customers,
  max_branches,
  max_warehouses,
  max_storage_gb,
  features,
  is_active,
  is_popular,
  is_trial,
  billing_period,
  display_order
)
SELECT
  'Pro',
  'En büyük işletmeler için sınırsıza yakın kapasite',
  0,
  0,
  0,
  999,
  30,
  1000,
  5000,
  31,
  100,
  '["Gelişmiş Raporlama", "API Erişimi", "Öncelikli Destek", "Özel Entegrasyon"]'::jsonb,
  true,
  true,
  false,
  'weekly',
  4
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_plans WHERE name = 'Pro' AND is_trial = false
);
