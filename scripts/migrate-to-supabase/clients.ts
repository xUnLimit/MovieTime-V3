import { readFileSync } from 'node:fs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as admin from 'firebase-admin';
import type { Database } from '../../src/lib/supabase/database.types';

/**
 * Singletons for the migration scripts. These use service-role / admin
 * credentials and BYPASS RLS — never import from app code.
 */

let supabaseClient: SupabaseClient<Database> | null = null;
let firestoreApp: admin.app.App | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (supabaseClient) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!serviceRole) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (server-side only)');

  supabaseClient = createClient<Database>(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
  return supabaseClient;
}

export function getFirestore(): FirebaseFirestore.Firestore {
  if (!firestoreApp) {
    const raw = getServiceAccountJson();
    if (!raw) {
      throw new Error(
        'Missing Firebase Admin credentials. Set FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH ' +
        'to the service account JSON file path, or FIREBASE_ADMIN_SERVICE_ACCOUNT ' +
        'to the inline JSON string.'
      );
    }
    let parsed: admin.ServiceAccount;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error('FIREBASE_ADMIN_SERVICE_ACCOUNT is not valid JSON: ' + (e as Error).message);
    }
    firestoreApp = admin.apps.length
      ? admin.app()
      : admin.initializeApp({ credential: admin.credential.cert(parsed) });
  }
  return admin.firestore(firestoreApp!);
}

function getServiceAccountJson(): string | undefined {
  if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT) {
    return process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  }

  const path =
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path) return undefined;

  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(
      `Could not read Firebase Admin service account file at ${path}: ${(error as Error).message}`
    );
  }
}
