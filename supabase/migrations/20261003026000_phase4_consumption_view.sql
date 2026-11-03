-- Consumo real mensual por categoría, solo salidas del kardex.

create or replace view public.v_monthly_consumption_by_category as
select
  date_trunc('month', m.occurred_at)::date as year_month,
  c.code as category_code,
  c.name as category_name,
  sum(m.quantity) as quantity_out
from public.stock_movements m
join public.products p on p.id = m.product_id
join public.product_categories c on c.id = p.category_id
where m.movement_type = 'out'
group by 1, 2, 3;

grant select on public.v_monthly_consumption_by_category to authenticated;
