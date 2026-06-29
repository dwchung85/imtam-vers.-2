
-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '',
  balance BIGINT NOT NULL DEFAULT 10000000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =========================
-- HOUSES
-- =========================
CREATE TABLE public.houses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_per_visit INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL DEFAULT '',
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  location TEXT NOT NULL DEFAULT '',
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_name TEXT NOT NULL DEFAULT '',
  host_avatar TEXT NOT NULL DEFAULT '',
  amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_guests INTEGER NOT NULL DEFAULT 1,
  rating NUMERIC,
  reviews_count INTEGER NOT NULL DEFAULT 0,
  available_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
  available_time_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  rooms INTEGER,
  bathrooms INTEGER,
  area INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.houses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.houses TO authenticated;
GRANT ALL ON public.houses TO service_role;

ALTER TABLE public.houses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Houses are viewable by everyone"
  ON public.houses FOR SELECT
  USING (true);

CREATE POLICY "Hosts can insert their own houses"
  ON public.houses FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update their own houses"
  ON public.houses FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can delete their own houses"
  ON public.houses FOR DELETE
  USING (auth.uid() = host_id);

-- =========================
-- BOOKINGS
-- =========================
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  house_title TEXT NOT NULL DEFAULT '',
  house_image TEXT NOT NULL DEFAULT '',
  house_price_per_visit INTEGER NOT NULL DEFAULT 0,
  guest_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL DEFAULT '',
  visit_date TEXT NOT NULL DEFAULT '',
  visit_time_slot TEXT NOT NULL DEFAULT '',
  total_visitors INTEGER NOT NULL DEFAULT 1,
  total_price INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  rating INTEGER CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guests and hosts can view their bookings"
  ON public.bookings FOR SELECT
  USING (
    auth.uid() = guest_id
    OR EXISTS (
      SELECT 1 FROM public.houses h WHERE h.id = bookings.house_id AND h.host_id = auth.uid()
    )
  );

CREATE POLICY "Guests can create their own bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = guest_id);

CREATE POLICY "Guests can update their own bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = guest_id)
  WITH CHECK (auth.uid() = guest_id);

CREATE POLICY "Hosts can update bookings on their houses"
  ON public.bookings FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.houses h WHERE h.id = bookings.house_id AND h.host_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.houses h WHERE h.id = bookings.house_id AND h.host_id = auth.uid())
  );

-- =========================
-- Updated-at trigger
-- =========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_houses_updated_at BEFORE UPDATE ON public.houses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- Auto-create profile on signup
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- Auto-recompute house rating when bookings change
-- =========================
CREATE OR REPLACE FUNCTION public.recompute_house_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_house UUID;
  cnt INTEGER;
  avg_rating NUMERIC;
BEGIN
  target_house := COALESCE(NEW.house_id, OLD.house_id);
  SELECT COUNT(*), AVG(rating) INTO cnt, avg_rating
    FROM public.bookings
    WHERE house_id = target_house AND rating IS NOT NULL;
  UPDATE public.houses
    SET rating = avg_rating, reviews_count = cnt
    WHERE id = target_house;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_bookings_rating
  AFTER INSERT OR UPDATE OF rating OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.recompute_house_rating();
