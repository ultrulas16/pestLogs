/*
  # Link subscriptions to plans and enforce resource limits

  ## Summary
  Connects the `subscriptions` table to `subscription_plans` so that
  each company's active plan limits are readable in one query. Also
  adds a `max_*` fallback columns directly on subscriptions for trial
  accounts that have no plan assigned yet.

  ## Changes
  ### subscriptions table
  - Add `plan_id` (uuid, FK → subscription_plans) — nullable, NULL = trial
  - Add `max_operators` integer — overrides plan when set manually by admin
  - Add `max_customers` integer
  - Add `max_branches` integer
  - Add `max_warehouses` integer

  ### RLS
  - No new policies needed; existing admin/company policies already cover subscriptions

  ### Notes
  - Trial defaults: 3 operators, 10 customers, 5 branches, 1 warehouse
  - When plan_id is set the plan's limits are used; manual overrides stay NULL
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN plan_id uuid REFERENCES subscription_plans(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'max_operators'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN max_operators integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'max_customers'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN max_customers integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'max_branches'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN max_branches integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'max_warehouses'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN max_warehouses integer;
  END IF;
END $$;
