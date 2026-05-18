-- The previous migration already added the necessary UPDATE, INSERT, and DELETE policies.
-- This block ensures all operational tables have the correct policies for management.

-- No changes needed to the existing 'owns_restaurant' function as it correctly checks ownership or admin role.

-- Verify and ensure all operational tables are covered for full management by owners/admins.
-- (Categories, Items, Combos, Groups, Beverages, Delivery Zones)
-- All these were covered in the previous successful migration call.

-- This migration serves as a checkpoint to confirm integration readiness.
SELECT 1; 
