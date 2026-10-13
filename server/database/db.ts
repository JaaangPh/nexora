import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config/config.js';

// Ensure database directory exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(config.dbPath);

// Enable WAL mode for better concurrency and performance
db.pragma('journal_mode = WAL');

export function initDatabase() {
  console.log(`[DB] Initializing database at ${config.dbPath}...`);

  // Run schema creation
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone_number TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'member' NOT NULL,
      invite_code_used TEXT,
      status TEXT DEFAULT 'active' NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS invite_codes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      max_uses INTEGER DEFAULT 1,
      times_used INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      expires_at DATETIME,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auth_logs (
      id TEXT PRIMARY KEY,
      phone_number TEXT NOT NULL,
      action TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      status TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default invite codes
  const seedCodes = [
    { id: 'inv-001', code: 'NEXORA-2025', description: 'General Member Onboarding Pass (Unlimited)', max_uses: -1 },
    { id: 'inv-002', code: 'VIP-ACCESS', description: 'Executive VIP Access Pass', max_uses: 25 },
    { id: 'inv-003', code: 'SECURITY-PASS', description: 'Nexora Security Protocol Pass', max_uses: 10 },
    { id: 'inv-004', code: 'ALPHA-TESTER', description: 'Mobile QA Verification Pass', max_uses: 10 },
  ];

  const insertCodeStmt = db.prepare(`
    INSERT OR IGNORE INTO invite_codes (id, code, description, max_uses, times_used, is_active)
    VALUES (@id, @code, @description, @max_uses, 0, 1)
  `);

  for (const c of seedCodes) {
    insertCodeStmt.run(c);
  }

  // Disable any administrator account created by the legacy public-default seed.
  const adminPhone = '+18005550199';
  const disabledSeedAdmins = db.prepare(`
    UPDATE users
    SET status = 'suspended'
    WHERE phone_number = ? AND role = 'admin' AND invite_code_used = 'SYSTEM-SEED' AND status != 'suspended'
  `).run(adminPhone);
  if (disabledSeedAdmins.changes > 0) {
    console.warn(`[DB] Disabled ${disabledSeedAdmins.changes} legacy default administrator account(s).`);
  }

  console.log('[DB] Database tables and seed data ready.');
}
