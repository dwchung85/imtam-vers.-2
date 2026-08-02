REVOKE ALL ON FUNCTION public.house_slot_load(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.house_slot_load(uuid) TO authenticated, service_role;