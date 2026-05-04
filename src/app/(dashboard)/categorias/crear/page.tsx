'use client';

import Link from 'next/link';
import { CategoriaForm } from '@/components/categorias/CategoriaForm';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

function CrearCategoriaPageContent() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/categorias">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Nueva Categoría</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            <Link href="/" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>{' '}
            /{' '}
            <Link href="/categorias" className="hover:text-foreground transition-colors">
              Categorías
            </Link>{' '}
            / <span className="text-foreground">Crear</span>
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-card border rounded-lg p-6">
        <CategoriaForm mode="create" />
      </div>
    </div>
  );
}

export default function CrearCategoriaPage() {
  return (
    <ModuleErrorBoundary moduleName="Nueva Categoría">
      <CrearCategoriaPageContent />
    </ModuleErrorBoundary>
  );
}
