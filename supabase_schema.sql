-- ============================================================================
-- TECHNOVA CODE SPRINT: 9 DAYS TO BUILD (14 Oct - 22 Oct 2026)
-- Supabase PostgreSQL Schema (Single Source of Truth)
-- Run this entire script in the Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================================

-- 1. USERS TABLE (Registered Students & Profiles)
CREATE TABLE IF NOT EXISTS public.users (
  uid TEXT PRIMARY KEY,
  prn TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  year TEXT DEFAULT 'First Year (FE)',
  branch TEXT DEFAULT 'Computer Engineering',
  language TEXT DEFAULT 'Python',
  track TEXT DEFAULT 'Python',
  role TEXT DEFAULT 'student',
  session_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_prn ON public.users (UPPER(prn));
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_session_token ON public.users (session_token);

-- 2. SUBMISSIONS TABLE (Daily Coding Solutions & Quiz Scores)
CREATE TABLE IF NOT EXISTS public.submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  prn TEXT NOT NULL,
  student_name TEXT NOT NULL,
  day INTEGER NOT NULL CHECK (day >= 1 AND day <= 9),
  language TEXT DEFAULT 'Python',
  track TEXT DEFAULT 'Python',
  code TEXT DEFAULT '',
  variant TEXT DEFAULT 'A',
  github_repo TEXT DEFAULT '',
  solution_note TEXT DEFAULT '',
  demo_link TEXT DEFAULT '',
  program_score NUMERIC(5,2) DEFAULT 0,
  quiz_score NUMERIC(5,2) DEFAULT 0,
  quiz_correct INTEGER DEFAULT 0,
  quiz_total INTEGER DEFAULT 8,
  quiz_submitted BOOLEAN DEFAULT FALSE,
  quiz_disqualified BOOLEAN DEFAULT FALSE,
  quiz_disqualification_reason TEXT,
  points NUMERIC(5,2) DEFAULT 0,
  raw_total NUMERIC(5,2) DEFAULT 0,
  is_catchup BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 1,
  test_results JSONB,
  tab_switches INTEGER DEFAULT 0,
  full_screen_exits INTEGER DEFAULT 0,
  proctoring_flags_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'approved',
  exit_reason TEXT,
  exited_at TIMESTAMPTZ,
  viva_required BOOLEAN DEFAULT FALSE,
  needs_viva BOOLEAN DEFAULT FALSE,
  failed_viva BOOLEAN DEFAULT FALSE,
  viva_notes TEXT DEFAULT '',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (prn, day)
);

CREATE INDEX IF NOT EXISTS idx_submissions_prn ON public.submissions (UPPER(prn));
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_day ON public.submissions (day);

-- 3. CERTIFICATES TABLE (Verified Certificates for 50+ Points)
CREATE TABLE IF NOT EXISTS public.certificates (
  certificate_id TEXT PRIMARY KEY,
  user_id TEXT,
  prn TEXT NOT NULL,
  student_name TEXT NOT NULL,
  email TEXT,
  language TEXT DEFAULT 'Python',
  track TEXT DEFAULT 'Python',
  score NUMERIC(5,2) DEFAULT 0,
  rank INTEGER,
  type TEXT DEFAULT 'Participation',
  start_date TEXT DEFAULT '14 Oct 2026',
  end_date TEXT DEFAULT '22 Oct 2026',
  issue_date TEXT DEFAULT '23 Oct 2026',
  status TEXT DEFAULT 'valid',
  revoked_reason TEXT,
  revoked_at TIMESTAMPTZ,
  verification_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificates_prn ON public.certificates (UPPER(prn));

-- 4. APP STATE TABLE (Shared Settings, Overrides, Consents & Audit State)
CREATE TABLE IF NOT EXISTS public.app_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (Server API accesses via Service Role or Anon Policy)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

-- Policies allowing the backend API to read/write shared state
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'allow_all_users_api') THEN
    CREATE POLICY allow_all_users_api ON public.users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'submissions' AND policyname = 'allow_all_submissions_api') THEN
    CREATE POLICY allow_all_submissions_api ON public.submissions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'certificates' AND policyname = 'allow_all_certificates_api') THEN
    CREATE POLICY allow_all_certificates_api ON public.certificates FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_state' AND policyname = 'allow_all_app_state_api') THEN
    CREATE POLICY allow_all_app_state_api ON public.app_state FOR ALL USING (true) WITH CHECK (true);
  END IF;
END
$$;
