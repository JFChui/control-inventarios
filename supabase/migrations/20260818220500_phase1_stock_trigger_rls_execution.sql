-- The stock movement INSERT policy authorizes the business operation.
-- Run the existing stock-application trigger as its owner so product RLS does
-- not block the derived quantity_on_hand update for department_user.
alter function public.apply_stock_movement() security definer;
alter function public.apply_stock_movement() set search_path = public;

-- Trigger functions are not direct API endpoints.
revoke all on function public.apply_stock_movement()
  from public, anon, authenticated;
