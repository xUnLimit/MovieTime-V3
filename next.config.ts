import type { NextConfig } from 'next';

type FirebaseWebAppConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
};

function parseFirebaseWebAppConfig(raw: string | undefined): FirebaseWebAppConfig {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as FirebaseWebAppConfig;
  } catch {
    return {};
  }
}

const firebaseWebAppConfig = parseFirebaseWebAppConfig(process.env.FIREBASE_WEBAPP_CONFIG);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY:
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? firebaseWebAppConfig.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? firebaseWebAppConfig.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? firebaseWebAppConfig.projectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? firebaseWebAppConfig.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? firebaseWebAppConfig.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID:
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? firebaseWebAppConfig.appId,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? firebaseWebAppConfig.measurementId,
  },
};

export default nextConfig;
