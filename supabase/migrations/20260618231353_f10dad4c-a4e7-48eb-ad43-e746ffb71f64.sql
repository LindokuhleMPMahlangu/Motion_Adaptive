-- Enums
CREATE TYPE public.app_role AS ENUM ('patient', 'staff', 'admin');
CREATE TYPE public.facility_type AS ENUM ('hospital', 'clinic', 'pharmacy');
CREATE TYPE public.queue_status AS ENUM ('waiting', 'in_service', 'completed', 'cancelled');

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Facilities
CREATE TABLE public.facilities (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type facility_type NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  norm_wait_minutes INT NOT NULL DEFAULT 30,
  avg_service_minutes INT NOT NULL DEFAULT 15,
  services TEXT[] NOT NULL DEFAULT ARRAY['General consultation'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.facilities TO authenticated, anon;
GRANT ALL ON public.facilities TO service_role;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view facilities" ON public.facilities FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Staff manage facilities" ON public.facilities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

-- Queue entries
CREATE TABLE public.queue_entries (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  patient_name TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL DEFAULT 'General consultation',
  status queue_status NOT NULL DEFAULT 'waiting',
  is_emergency BOOLEAN NOT NULL DEFAULT false,
  booked_for TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  alerted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.queue_entries TO authenticated;
GRANT ALL ON public.queue_entries TO service_role;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients view own entries" ON public.queue_entries FOR SELECT TO authenticated USING (auth.uid() = patient_id);
CREATE POLICY "Patients create own entries" ON public.queue_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "Patients update own entries" ON public.queue_entries FOR UPDATE TO authenticated USING (auth.uid() = patient_id);
CREATE POLICY "Staff view all entries" ON public.queue_entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff update all entries" ON public.queue_entries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

-- Alert logs
CREATE TABLE public.alert_logs (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_entry_id UUID REFERENCES public.queue_entries ON DELETE SET NULL,
  facility_id UUID NOT NULL REFERENCES public.facilities ON DELETE CASCADE,
  wait_minutes INT NOT NULL DEFAULT 0,
  cause TEXT NOT NULL DEFAULT '',
  prevention TEXT NOT NULL DEFAULT '',
  logged_by UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_logs TO authenticated;
GRANT ALL ON public.alert_logs TO service_role;
ALTER TABLE public.alert_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage alert logs" ON public.alert_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

-- Patient queue status RPC
CREATE OR REPLACE FUNCTION public.get_my_queue_status()
RETURNS TABLE (
  entry_id UUID,
  facility_id UUID,
  facility_name TEXT,
  service TEXT,
  status queue_status,
  is_emergency BOOLEAN,
  checked_in_at TIMESTAMPTZ,
  booked_for TIMESTAMPTZ,
  queue_position INT,
  people_ahead INT,
  total_waiting INT,
  est_wait_minutes INT,
  norm_wait_minutes INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e RECORD;
  ahead INT;
  total INT;
  f RECORD;
BEGIN
  SELECT * INTO e FROM public.queue_entries q
  WHERE q.patient_id = auth.uid() AND q.status IN ('waiting','in_service')
  ORDER BY q.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO f FROM public.facilities WHERE id = e.facility_id;

  SELECT count(*) INTO ahead FROM public.queue_entries q
  WHERE q.facility_id = e.facility_id AND q.status = 'waiting'
    AND (
      (q.is_emergency AND NOT e.is_emergency)
      OR (q.is_emergency = e.is_emergency AND q.created_at < e.created_at)
    );

  SELECT count(*) INTO total FROM public.queue_entries q
  WHERE q.facility_id = e.facility_id AND q.status = 'waiting';

  RETURN QUERY SELECT
    e.id, e.facility_id, f.name, e.service, e.status, e.is_emergency,
    e.checked_in_at, e.booked_for,
    (ahead + 1)::INT, ahead::INT, total::INT,
    (ahead * f.avg_service_minutes)::INT, f.norm_wait_minutes;
END;
$$;

-- Auto profile + default patient role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'patient'))
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Realtime
ALTER TABLE public.queue_entries REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_entries;
ALTER TABLE public.alert_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_logs;

-- Seed facilities
INSERT INTO public.facilities (name, type, location, norm_wait_minutes, avg_service_minutes, services) VALUES
('Central General Hospital', 'hospital', 'Unit 04, Main Campus', 45, 18, ARRAY['Emergency','General consultation','Triage','X-Ray']),
('Riverside Clinic', 'clinic', 'Riverside Ave 12', 30, 12, ARRAY['General consultation','Vaccination','Blood test']),
('CityCare Pharmacy', 'pharmacy', 'Market Street 8', 15, 6, ARRAY['Prescription pickup','Consultation','Vaccination']);