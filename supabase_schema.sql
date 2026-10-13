-- =============================================================================
-- TECHNOVA CODE SPRINT: 9 DAYS TO BUILD (14 OCT - 22 OCT 2026)
-- SUPABASE POSTGRESQL SCHEMA — SINGLE SOURCE OF TRUTH + OTP VERIFICATION
-- Sir Visvesvaraya Institute of Technology (SVIT), Nashik
-- =============================================================================
-- Instructions:
-- 1. Open your Supabase project -> SQL Editor -> New Query.
-- 2. Paste this entire file and click "Run".
-- 3. Copy your Project URL (SUPABASE_URL) and Service Role Key (SUPABASE_SERVICE_ROLE_KEY)
--    from Project Settings -> API into your Vercel Environment Variables.
-- =============================================================================

-- 1. USERS (STUDENTS) TABLE WITH STRICT UNIQUE CONSTRAINTS
CREATE TABLE IF NOT EXISTS public.users (
  uid TEXT PRIMARY KEY,
  prn TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  normalized_email TEXT UNIQUE,
  phone TEXT UNIQUE,
  year TEXT NOT NULL DEFAULT 'First Year (FE)',
  branch TEXT NOT NULL DEFAULT 'Computer Engineering',
  division TEXT NOT NULL DEFAULT 'A',
  language TEXT NOT NULL DEFAULT 'Python',
  track TEXT NOT NULL DEFAULT 'Python',
  role TEXT NOT NULL DEFAULT 'student',
  genuine_consent BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  account_status TEXT NOT NULL DEFAULT 'unverified', -- 'verified' | 'unverified' | 'suspended' | 'flagged'
  suspended_reason TEXT,
  needs_legacy_verification BOOLEAN NOT NULL DEFAULT FALSE,
  session_token TEXT,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns safely if upgrading from an earlier schema
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS normalized_email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS division TEXT DEFAULT 'A';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS genuine_consent BOOLEAN DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'unverified';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS needs_legacy_verification BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ DEFAULT NOW();

-- Database Unique Indexes: One account per verified/normalized email, one per mobile number, one per roll number
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_prn_unique ON public.users (UPPER(prn));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_normalized_email_unique ON public.users (normalized_email) WHERE normalized_email IS NOT NULL AND normalized_email <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON public.users (phone) WHERE phone IS NOT NULL AND phone <> '';
CREATE INDEX IF NOT EXISTS idx_users_track ON public.users (track);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON public.users (account_status);

-- 2. OTP VERIFICATIONS TABLE (Stores ONLY salted SHA-256 hash of OTP, never plain OTP)
CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,             -- normalized_email or +91XXXXXXXXXX
  channel TEXT NOT NULL DEFAULT 'email',-- 'email' | 'phone'
  otp_hash TEXT NOT NULL,               -- HMAC-SHA256 hash of 6-digit OTP
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_identifier_channel ON public.otp_verifications (identifier, channel);

-- 3. SUBMISSIONS & QUIZ RESULTS TABLE
CREATE TABLE IF NOT EXISTS public.submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  prn TEXT NOT NULL,
  student_name TEXT NOT NULL,
  day INTEGER NOT NULL CHECK (day >= 1 AND day <= 9),
  language TEXT NOT NULL DEFAULT 'Python',
  track TEXT NOT NULL DEFAULT 'Python',
  code TEXT DEFAULT '',
  variant TEXT DEFAULT 'A',
  github_repo TEXT DEFAULT '',
  solution_note TEXT DEFAULT '',
  demo_link TEXT DEFAULT '',
  tab_switches INTEGER DEFAULT 0,
  full_screen_exits INTEGER DEFAULT 0,
  proctoring_flags_count INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 1,
  test_results JSONB,
  program_score NUMERIC(6,2) DEFAULT 0,
  quiz_score NUMERIC(6,2) DEFAULT 0,
  quiz_correct INTEGER DEFAULT 0,
  quiz_submitted BOOLEAN DEFAULT FALSE,
  quiz_disqualified BOOLEAN DEFAULT FALSE,
  quiz_disqualification_reason TEXT,
  points NUMERIC(6,2) DEFAULT 0,
  raw_total NUMERIC(6,2) DEFAULT 0,
  is_catchup BOOLEAN DEFAULT FALSE,
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

-- 4. CERTIFICATES TABLE
CREATE TABLE IF NOT EXISTS public.certificates (
  certificate_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  prn TEXT NOT NULL,
  student_name TEXT NOT NULL,
  email TEXT,
  language TEXT DEFAULT 'Python',
  track TEXT DEFAULT 'Python',
  score NUMERIC(6,2) DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  issued_date TEXT,
  status TEXT DEFAULT 'valid',
  revoked_reason TEXT,
  revoked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificates_prn ON public.certificates (UPPER(prn));

-- 5. APP STATE KV STORE (For Admin Settings, Registration Config, Consents, Proctoring Logs)
CREATE TABLE IF NOT EXISTS public.app_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

-- Service Role / API Backend Full Access Policies
DROP POLICY IF EXISTS "Backend service role full access users" ON public.users;
CREATE POLICY "Backend service role full access users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Backend service role full access otp" ON public.otp_verifications;
CREATE POLICY "Backend service role full access otp" ON public.otp_verifications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Backend service role full access submissions" ON public.submissions;
CREATE POLICY "Backend service role full access submissions" ON public.submissions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Backend service role full access certificates" ON public.certificates;
CREATE POLICY "Backend service role full access certificates" ON public.certificates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Backend service role full access app_state" ON public.app_state;
CREATE POLICY "Backend service role full access app_state" ON public.app_state FOR ALL USING (true) WITH CHECK (true);
