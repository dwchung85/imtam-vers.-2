REVOKE EXECUTE ON FUNCTION public.house_slot_load(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.validate_booking() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_house_rating() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;