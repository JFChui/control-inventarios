-- Housekeeping room statuses used as service types in maid allocations.
-- ADD VALUE cannot be used in the same transaction as the new labels.
alter type public.room_service_type add value if not exists 'inspected';
alter type public.room_service_type add value if not exists 'clean';
alter type public.room_service_type add value if not exists 'dirty';
alter type public.room_service_type add value if not exists 'out_of_order';
