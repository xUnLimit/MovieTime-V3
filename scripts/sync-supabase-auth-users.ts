import { randomBytes } from 'node:crypto';
import { config } from 'dotenv';
import { getFirestore, getSupabase } from './migrate-to-supabase/clients';
import { asString } from './migrate-to-supabase/helpers';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

type FirebaseAuthUser = {
  uid: string;
  email?: string;
  displayName?: string;
  disabled: boolean;
  customClaims?: Record<string, unknown>;
};

function parseArgs(argv: string[]) {
  return {
    apply: argv.includes('--apply'),
  };
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  getFirestore();
  const supabase = getSupabase();
  const firebaseUsers = await listFirebaseUsers();
  const supabaseUsers = await listSupabaseUsersByEmail(supabase);

  const planned = [];

  for (const firebaseUser of firebaseUsers) {
    if (!firebaseUser.email) continue;
    const email = firebaseUser.email.toLowerCase();
    const existing = supabaseUsers.get(email);
    const profile = resolveProfile(firebaseUser);

    planned.push({
      email,
      action: existing ? 'update' : 'create',
      role: profile.role,
      active: profile.active,
      displayName: profile.displayName,
    });

    if (!apply) continue;

    const userId = existing
      ? existing.id
      : await createSupabaseAuthUser(supabase, firebaseUser, profile.displayName);

    if (existing) {
      const { error } = await supabase.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
        user_metadata: {
          display_name: profile.displayName,
          firebase_uid: firebaseUser.uid,
        },
      });
      if (error) throw new Error(`Could not update auth user ${email}: ${error.message}`);
    }

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        display_name: profile.displayName,
        role: profile.role,
        active: profile.active,
      },
      { onConflict: 'id' }
    );
    if (profileError) throw new Error(`Could not upsert profile ${email}: ${profileError.message}`);
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        firebaseAuthUsers: firebaseUsers.length,
        planned,
      },
      null,
      2
    )
  );
}

async function listFirebaseUsers(): Promise<FirebaseAuthUser[]> {
  const admin = await import('firebase-admin');
  const users: FirebaseAuthUser[] = [];
  let pageToken: string | undefined;

  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    users.push(
      ...page.users.map((user) => ({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        disabled: user.disabled,
        customClaims: user.customClaims,
      }))
    );
    pageToken = page.pageToken;
  } while (pageToken);

  return users;
}

async function listSupabaseUsersByEmail(supabase: ReturnType<typeof getSupabase>) {
  const users = new Map<string, { id: string; email?: string }>();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list Supabase auth users: ${error.message}`);
    for (const user of data.users) {
      if (user.email) users.set(user.email.toLowerCase(), { id: user.id, email: user.email });
    }
    if (data.users.length < 1000) break;
    page += 1;
  }

  return users;
}

async function createSupabaseAuthUser(
  supabase: ReturnType<typeof getSupabase>,
  firebaseUser: FirebaseAuthUser,
  displayName: string
) {
  if (!firebaseUser.email) throw new Error(`Firebase user ${firebaseUser.uid} has no email`);
  const { data, error } = await supabase.auth.admin.createUser({
    email: firebaseUser.email,
    password: randomPassword(),
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      firebase_uid: firebaseUser.uid,
    },
  });
  if (error) throw new Error(`Could not create auth user ${firebaseUser.email}: ${error.message}`);
  if (!data.user) throw new Error(`Supabase did not return created user for ${firebaseUser.email}`);
  return data.user.id;
}

function resolveProfile(
  firebaseUser: FirebaseAuthUser
): { displayName: string; role: 'admin' | 'operador'; active: boolean } {
  const claimsRole = asString(firebaseUser.customClaims?.role);
  const role = claimsRole === 'admin' || firebaseUser.customClaims?.admin === true ? 'admin' : 'operador';

  return {
    displayName:
      firebaseUser.displayName ||
      firebaseUser.email?.split('@')[0] ||
      firebaseUser.uid,
    role,
    active: !firebaseUser.disabled,
  };
}

function randomPassword() {
  return `${randomBytes(24).toString('base64url')}aA1!`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
