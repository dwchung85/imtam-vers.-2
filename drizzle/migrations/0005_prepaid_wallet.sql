CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallet read" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('topup','tour_payment','tour_refund','tour_earning','withdrawal','withdrawal_return')),
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  booking_id uuid,
  ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX wallet_tx_once ON public.wallet_transactions(type, ref) WHERE ref IS NOT NULL;
CREATE INDEX wallet_tx_user ON public.wallet_transactions(user_id, created_at DESC);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx read" ON public.wallet_transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.wallet_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id text NOT NULL UNIQUE,
  amount integer NOT NULL CHECK (amount > 0 AND amount % 10000 = 0),
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','paid','failed')),
  payment_key text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_topups TO authenticated;
GRANT ALL ON public.wallet_topups TO service_role;
ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own topup read" ON public.wallet_topups FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.wallet_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  bank_name text NOT NULL,
  bank_account text NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','processing','paid','failed')),
  provider_ref text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
GRANT SELECT ON public.wallet_withdrawals TO authenticated;
GRANT ALL ON public.wallet_withdrawals TO service_role;
ALTER TABLE public.wallet_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own withdrawal read" ON public.wallet_withdrawals FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 잔액 변경은 이 함수로만 (서버 전용). 잔액 부족 시 오류, 같은 ref 중복 처리 방지.
CREATE OR REPLACE FUNCTION public.wallet_apply(_user_id uuid, _delta integer, _type text, _booking_id uuid, _ref text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  IF _ref IS NOT NULL AND EXISTS (SELECT 1 FROM public.wallet_transactions WHERE type = _type AND ref = _ref) THEN
    SELECT balance INTO new_balance FROM public.wallets WHERE user_id = _user_id;
    RETURN COALESCE(new_balance, 0);
  END IF;
  INSERT INTO public.wallets(user_id, balance) VALUES (_user_id, 0) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance + _delta INTO new_balance FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF new_balance < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;
  UPDATE public.wallets SET balance = new_balance, updated_at = now() WHERE user_id = _user_id;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, booking_id, ref)
  VALUES (_user_id, _type, _delta, new_balance, _booking_id, _ref);
  RETURN new_balance;
END;
$$;
REVOKE ALL ON FUNCTION public.wallet_apply(uuid, integer, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_apply(uuid, integer, text, uuid, text) TO service_role;