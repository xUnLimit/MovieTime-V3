import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { auth } from './config';
import { User } from '@/types';

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string, rememberMe: boolean = false): Promise<FirebaseUser> {
  try {
    // Set Firebase persistence based on "Recordarme" option
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Error signing in:', error);
    const message = error instanceof Error ? error.message : 'Error al iniciar sesión';
    throw new Error(message);
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    const message = error instanceof Error ? error.message : 'Error al cerrar sesión';
    throw new Error(message);
  }
}

/**
 * Create a new user with email and password
 */
export async function createUser(
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseUser> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update user profile with display name
    await updateProfile(user, { displayName });

    return user;
  } catch (error) {
    console.error('Error creating user:', error);
    const message = error instanceof Error ? error.message : 'Error al crear usuario';
    throw new Error(message);
  }
}

/**
 * Listen to authentication state changes
 * Note: Now handles async role fetching internally if needed by the callback
 */
export function onAuthStateChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get current user
 */
export function getCurrentUser(): FirebaseUser | null {
  return auth.currentUser;
}

/**
 * Convert Firebase User to App User (Synchronous version)
 * Note: Use this only for initial UI state. The actual role should be verified via convertFirebaseUserAsync.
 */
export function convertFirebaseUser(firebaseUser: FirebaseUser): User {
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || firebaseUser.email || '',
    role: 'operador', // Default to restricted role in sync version
    active: true,
    createdAt: new Date(firebaseUser.metadata.creationTime || Date.now()),
    updatedAt: new Date(),
  };
}

/**
 * Convert Firebase User to App User (Asynchronous version - PREFERRED)
 * Extracts roles from Firebase Custom Claims for maximum security.
 * Access via email prefix is now disabled.
 */
export async function convertFirebaseUserAsync(firebaseUser: FirebaseUser): Promise<User> {
  // Force refresh token to get latest claims
  const tokenResult = await firebaseUser.getIdTokenResult(true);
  
  // Role based STRICTLY on custom claim 'admin'
  const isAdmin = tokenResult.claims.admin === true;

  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || firebaseUser.email || '',
    role: isAdmin ? 'admin' : 'operador',
    active: true,
    createdAt: new Date(firebaseUser.metadata.creationTime || Date.now()),
    updatedAt: new Date(),
  };
}
