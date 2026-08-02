-- 날짜/시간대별 예약된 인원 집계 (개인정보 없음)
CREATE OR REPLACE FUNCTION public.house_slot_load(_house_id uuid)
RETURNS TABLE (visit_date text, visit_time_slot text, booked_visitors integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.visit_date, b.visit_time_slot, COALESCE(SUM(b.total_visitors), 0)::int
  FROM public.bookings b
  WHERE b.house_id = _house_id
    AND b.status IN ('pending', 'confirmed')
  GROUP BY b.visit_date, b.visit_time_slot
$$;

GRANT EXECUTE ON FUNCTION public.house_slot_load(uuid) TO authenticated, anon, service_role;

-- 예약 유효성 검증 (가능 일정 / 정원 / 중복)
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
$$;

DROP TRIGGER IF EXISTS validate_booking_trg ON public.bookings;
CREATE TRIGGER validate_booking_trg
BEFORE INSERT OR UPDATE OF visit_date, visit_time_slot, total_visitors, status
ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.validate_booking();

-- 평점 자동 재계산 트리거 복구
DROP TRIGGER IF EXISTS recompute_house_rating_trg ON public.bookings;
CREATE TRIGGER recompute_house_rating_trg
AFTER INSERT OR DELETE OR UPDATE OF rating
ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.recompute_house_rating();

-- updated_at 자동 갱신
DROP TRIGGER IF EXISTS set_bookings_updated_at ON public.bookings;
CREATE TRIGGER set_bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_houses_updated_at ON public.houses;
CREATE TRIGGER set_houses_updated_at
BEFORE UPDATE ON public.houses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();