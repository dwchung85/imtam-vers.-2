-- 예약 결제 상태
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';
UPDATE public.bookings SET payment_status = 'not_required';

-- 토스페이먼츠 결제 및 호스트 정산 기록
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL,
  host_id uuid NOT NULL,
  order_id text NOT NULL UNIQUE,
  payment_key text,
  amount integer NOT NULL CHECK (amount > 0),
  method text,
  status text NOT NULL DEFAULT 'ready', -- ready | paid | failed | refunded
  approved_at timestamptz,
  refunded_at timestamptz,
  cancel_reason text,
  host_payout_amount integer,
  platform_fee_amount integer,
  payout_status text NOT NULL DEFAULT 'none', -- none | pending | paid
  payout_requested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guests, hosts and admins can view payments"
ON public.payments FOR SELECT TO authenticated
USING (
  auth.uid() = guest_id
  OR auth.uid() = host_id
  OR public.has_role(auth.uid(), 'admin')
);

-- 결제 관련 상태는 서버(service_role)만 변경 가능
CREATE OR REPLACE FUNCTION public.protect_booking_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
BEGIN
  IF is_service THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.payment_status := 'unpaid';
    NEW.status := 'pending';
    RETURN NEW;
  END IF;

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    RAISE EXCEPTION '결제 상태는 직접 변경할 수 없습니다.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.payment_status = 'unpaid' AND NEW.status IN ('confirmed', 'completed') THEN
      RAISE EXCEPTION '결제가 완료되지 않은 예약입니다.';
    END IF;
    IF NEW.payment_status = 'paid' AND NEW.status IN ('cancelled', 'completed') THEN
      RAISE EXCEPTION '결제된 예약의 취소·완료는 결제 처리와 함께 진행되어야 합니다.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_booking_payment ON public.bookings;
CREATE TRIGGER protect_booking_payment
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.protect_booking_payment();

-- 결제하지 않고 30분 지난 예약은 자리를 차지하지 않음
CREATE OR REPLACE FUNCTION public.house_slot_load(_house_id uuid)
RETURNS TABLE(visit_date text, visit_time_slot text, booked_visitors integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.visit_date, b.visit_time_slot, COALESCE(SUM(b.total_visitors), 0)::int
  FROM public.bookings b
  WHERE b.house_id = _house_id
    AND b.status IN ('pending', 'confirmed')
    AND (b.payment_status <> 'unpaid' OR b.created_at > now() - interval '30 minutes')
  GROUP BY b.visit_date, b.visit_time_slot
$$;

CREATE OR REPLACE FUNCTION public.validate_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      AND (b.payment_status <> 'unpaid' OR b.created_at > now() - interval '30 minutes')
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
    AND (b.payment_status <> 'unpaid' OR b.created_at > now() - interval '30 minutes')
    AND b.id <> NEW.id;

  IF booked + NEW.total_visitors > h.max_guests THEN
    RAISE EXCEPTION '해당 시간대는 정원(%명)이 마감되었습니다. 남은 자리: %명', h.max_guests, GREATEST(h.max_guests - booked, 0);
  END IF;

  RETURN NEW;
END;
$$;