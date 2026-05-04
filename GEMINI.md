# MovieTime PTY - Project Context

## Project Overview
MovieTime PTY is a comprehensive subscription management system for streaming services in Panama. It is designed to manage clients, resellers, services (e.g., Netflix, Disney+), sales, categories, payment methods, and automated expiration notifications.

### Tech Stack
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **UI:** React, Tailwind CSS, shadcn/ui, Radix UI
- **State Management:** Zustand
- **Forms & Validation:** React Hook Form + Zod
- **Backend:** Firebase (Authentication, Firestore, Analytics)
- **Testing:** Vitest

## Building and Running

### Prerequisites
- Node.js 20+
- A Firebase project with Firestore enabled (Spark plan is sufficient).
- A `.env.local` file with Firebase credentials.

### Key Commands
- `npm install`: Install dependencies.
- `npm run dev`: Start the development server (runs on `http://localhost:3000`).
- `npm run build`: Build the application for production.
- `npm start`: Start the production server.
- `npm run lint`: Run ESLint.
- `npm test`: Run tests using Vitest.
- `npm run test:coverage`: Run tests and generate coverage report.

### Firebase Commands
- `firebase deploy --only firestore:rules`: Deploy Firestore rules.
- `firebase deploy --only firestore:indexes`: Deploy Firestore indexes.
- `firebase deploy`: Full Firebase deployment.

## Development Conventions & Architecture
- **State Management:** Zustand is used for state management, employing a 5-minute TTL cache and optimistic deletions with rollback capabilities.
- **Database & Data Fetching:** 
  - Uses Firebase Firestore for data storage.
  - Implements cursor-based server pagination (`useServerPagination`) for large datasets to optimize reads.
  - Utilizes `getCount()` for metrics to minimize document reads.
- **Key Features:**
  - Multi-currency support with aggregated totals in USD.
  - Automated expiration notifications with daily synchronization.
  - Customizable WhatsApp message templates with dynamic placeholders.
- **Directory Structure Overview:**
  - `src/app`: Next.js App Router structure (modules like dashboard, usuarios, servicios, etc.).
  - `src/components`: Reusable UI components organized by feature and generic shared/ui components.
  - `src/hooks`: Custom React hooks for logic and data fetching.
  - `src/lib`: Core utilities, Firebase configuration, services, and security.
  - `src/store`: Zustand stores for global state.
  - `src/types`: TypeScript type definitions.
  - `docs/`: Extensive project documentation and runbooks.
