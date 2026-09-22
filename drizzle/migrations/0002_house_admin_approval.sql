-- 1) roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 2) house approval workflow
ALTER TABLE public.houses
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reject_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

-- existing listings stay visible
UPDATE public.houses SET approval_status = 'approved' WHERE approval_status = 'pending' AND created_at < now();

CREATE INDEX IF NOT EXISTS houses_approval_status_idx ON public.houses (approval_status);

DROP POLICY IF EXISTS "Houses are viewable by everyone" ON public.houses;

CREATE POLICY "Approved houses are viewable by everyone"
ON public.houses FOR SELECT
USING (approval_status = 'approved');

CREATE POLICY "Hosts can view their own houses"
ON public.houses FOR SELECT TO authenticated
USING (auth.uid() = host_id);

CREATE POLICY "Admins can view all houses"
ON public.houses FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can review houses"
ON public.houses FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) block bookings on non-approved houses
CREATE OR REPLACE FUNCTION public.validate_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  h public.houses;
  booked int;
BEGIN
  SELECT * INTO h FROM public.houses WHERE id = NEW.house_id;
  IF h.id IS NULL THEN
    RAISE EXCEPTION '존재하지 않는 매물입니다.';
  END IF;

  IF h.approval_status <> 'approved' THEN
    RAISE EXCEPTION '관리자 승인이 완료되지 않은 매물은 예약할 수 없습니다.';
  END IF;

  IF jsonb_array_length(COALESCE(h.available_dates, '[]'::jsonb)) > 0
     AND NOT (h.available_dates ? NEW.visit_date) THEN
    RAISE EXCEPTION '선택한 날짜(%)는 호스트가 등록한 방문 가능 일정이 아닙니다.', NEW.visit_date;
  END IF;

  IF jsonb_array_length(COALESCE(h.available_time_slots, '[]'::jsonb)) > 0
     AND NOT (h.available_time_slots ? NEW.visit_time_slot) THEN
    RAISE EXCEPTION '선택한 시간대(%)는 호스트가 등록한 방문 가능 시간이 아닙니다.', NEW.visit_time_slot;
  END IF;

  IF NEW.total_visitors < 1 THEN
    RAISE EXCEPTION '동반 인수는 1명 이상이어야 합니다.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.house_id = NEW.house_id
      AND b.guest_id = NEW.guest_id
      AND b.visit_date = NEW.visit_date
      AND b.visit_time_slot = NEW.visit_time_slot
      AND b.status IN ('pending', 'confirmed')
      AND b.id <> NEW.id
  ) THEN
    RAISE EXCEPTION '이미 같은 날짜와 시간대에 신청한 예약이 있습니다.';
  END IF;

  SELECT COALESCE(SUM(b.total_visitors), 0) INTO booked
  FROM public.bookings b
  WHERE b.house_id = NEW.house_id
    AND b.visit_date = NEW.visit_date
    AND b.visit_time_slot = NEW.visit_time_slot
    AND b.status IN ('pending', 'confirmed')
    AND b.id <> NEW.id;

  IF booked + NEW.total_visitors > h.max_guests THEN
    RAISE EXCEPTION '해당 시간대는 정원(%명)이 마감되었습니다. 남은 자리: %명', h.max_guests, GREATEST(h.max_guests - booked, 0);
  END IF;

  RETURN NEW;
END;
$function$;
