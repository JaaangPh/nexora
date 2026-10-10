-- ============================================================================
-- Nexora Technologies Database Schema
-- Compatible with PostgreSQL and SQLite
-- ============================================================================

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone_number VARCHAR(30) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'member' NOT NULL,
  invite_code_used VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

-- Invite Codes Table
CREATE TABLE IF NOT EXISTS invite_codes (
  id TEXT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  description VARCHAR(255),
  max_uses INTEGER DEFAULT 1, -- 0 or -1 indicates unlimited
  times_used INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1, -- 1 = active, 0 = disabled
  expires_at TIMESTAMP,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit / Login Activity Logs Table
CREATE TABLE IF NOT EXISTS auth_logs (
  id TEXT PRIMARY KEY,
  phone_number VARCHAR(30) NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'login_success', 'login_failed', 'register', 'logout'
  ip_address VARCHAR(50),
  user_agent TEXT,
  status VARCHAR(20) NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Data for Nexora Technologies
-- Default Invite Codes
INSERT OR IGNORE INTO invite_codes (id, code, description, max_uses, times_used, is_active)
VALUES 
  ('inv-001', 'NEXORA-2025', 'General Member Onboarding Pass (Unlimited)', -1, 0, 1),
  ('inv-002', 'VIP-ACCESS', 'Executive VIP Early Access', 25, 0, 1),
  ('inv-003', 'SECURITY-PASS', 'Security Protocol Tier 1', 10, 0, 1),
  ('inv-004', 'ALPHA-TESTER', 'Antigravity Mobile Quality Assurance Team', 10, 0, 1);
