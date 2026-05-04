# MovieTime PTY - Developer Quick Reference Guide

## Common Development Patterns

### Adding a New Feature to an Existing Module

#### 1. Add Field to Type
**File:** `src/types/index.ts`
```typescript
export interface Servicio {
  // ... existing fields
  newField: string;  // Add your new field
}
```

#### 2. Update Store
**File:** `src/stores/serviciosStore.ts`
```typescript
createServicio: async (data) => {
  const newServicio: Servicio = {
    // ... existing fields
    newField: data.newField,  // Include new field
  };
}
```

#### 3. Update Form Schema
**File:** Component dialog file (e.g., `ServicioDialog.tsx`)
```typescript
const servicioSchema = z.object({
  // ... existing fields
  newField: z.string().min(1, 'Field is required'),
});
```

#### 4. Add to Form UI
```typescript
<div className="space-y-2">
  <Label htmlFor="newField">New Field</Label>
  <Input id="newField" {...register('newField')} />
  {errors.newField && (
    <p className="text-sm text-red-500">{errors.newField.message}</p>
  )}
</div>
```

#### 5. Update Table Display
**File:** Table component (e.g., `ServiciosTable.tsx`)
```typescript
{
  key: 'newField',
  header: 'New Field',
  sortable: true,
  render: (item) => <span>{item.newField}</span>,
}
```

---

## Store Usage Patterns

### Basic CRUD Operations
```typescript
// In component
const { items, loading, fetchItems, createItem, updateItem, deleteItem } = useStore();

useEffect(() => {
  fetchItems();
}, [fetchItems]);

// Create
const handleCreate = async (data) => {
  await createItem(data);
  toast.success('Item created');
};

// Update
const handleUpdate = async (id, data) => {
  await updateItem(id, data);
  toast.success('Item updated');
};

// Delete
const handleDelete = async (id) => {
  await deleteItem(id);
  toast.success('Item deleted');
};
```

### Custom Store Actions (Ventas Example)
```typescript
// Special operations beyond CRUD
const { renovarVenta, suspenderVenta, activarVenta } = useVentasStore();

// Renovar
await renovarVenta(ventaId);

// Suspend
await suspenderVenta(ventaId);

// Activate
await activarVenta(ventaId);
```

---

## Component Patterns

### Page Component Structure
```typescript
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
// Import components and stores

export default function ModulePage() {
  // Store hooks
  const { items, fetchItems } = useStore();

  // Local state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch data on mount
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Filtered data
  const filteredItems = useMemo(() => {
    return items.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  // Handlers
  const handleCreate = () => {
    setSelectedItem(null);
    setDialogOpen(true);
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      {/* Metrics */}
      {/* Filters */}
      {/* Table */}
      {/* Dialog */}
    </div>
  );
}
```

### Dialog Component Structure
```typescript
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
// Import UI components

const schema = z.object({
  // Define schema
});

type FormData = z.infer<typeof schema>;

export function ItemDialog({ open, onOpenChange, item }) {
  const { createItem, updateItem } = useStore();
  const { register, handleSubmit, setValue, watch, reset, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { /* ... */ },
  });

  // Reset form when item changes
  useEffect(() => {
    if (item) {
      reset({ /* populate from item */ });
    } else {
      reset({ /* default values */ });
    }
  }, [item, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      if (item) {
        await updateItem(item.id, data);
        toast.success('Updated');
      } else {
        await createItem(data);
        toast.success('Created');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error('Error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Dialog content */}
    </Dialog>
  );
}
```

---

## Common UI Patterns

### Status Badges
```typescript
// Color-coded status badges
<Badge variant={item.active ? 'success' : 'secondary'}>
  {item.active ? 'Activo' : 'Inactivo'}
</Badge>

// Custom colors
<Badge className="bg-red-100 text-red-800">
  Crítico
</Badge>
```

### Progress Bars
```typescript
<div className="w-32">
  <div className="flex justify-between text-sm mb-1">
    <span>{current}</span>
    <span className="text-muted-foreground">de {total}</span>
  </div>
  <Progress value={(current / total) * 100} className="h-2" />
</div>
```

### WhatsApp Integration
```typescript
const handleWhatsApp = (phone: string) => {
  const cleanPhone = phone.replace(/\D/g, '');
  window.open(`https://wa.me/${cleanPhone}`, '_blank');
};

<Button variant="ghost" size="icon" onClick={() => handleWhatsApp(item.telefono)}>
  <MessageCircle className="h-4 w-4 text-green-600" />
</Button>
```

### Dropdown Actions Menu
```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => handleEdit(item)}>
      <Edit className="mr-2 h-4 w-4" />
      Editar
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleDelete(item)}>
      <Trash2 className="mr-2 h-4 w-4" />
      Eliminar
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Form Validation Patterns

### Basic Validations
```typescript
const schema = z.object({
  // Required string
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),

  // Email
  email: z.string().email('Email inválido'),

  // Optional email
  email: z.string().email('Email inválido').optional().or(z.literal('')),

  // Number with range
  cantidad: z.number().min(1, 'Mínimo 1').max(100, 'Máximo 100'),

  // Enum
  tipo: z.enum(['cliente', 'revendedor']),

  // Boolean
  activo: z.boolean(),

  // Date
  fecha: z.date(),
});
```

### Conditional Validation
```typescript
const schema = z.object({
  tipo: z.enum(['cliente', 'revendedor']),
  clienteId: z.string().optional(),
  revendedorId: z.string().optional(),
}).refine((data) => {
  if (data.tipo === 'cliente' && !data.clienteId) {
    return false;
  }
  if (data.tipo === 'revendedor' && !data.revendedorId) {
    return false;
  }
  return true;
}, {
  message: 'Debe seleccionar un cliente o revendedor',
  path: ['clienteId'],
});
```

---

## Filtering and Search Patterns

### Search Filter
```typescript
const filteredItems = useMemo(() => {
  return items.filter((item) => {
    const matchesSearch = item.nombre
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesSearch;
  });
}, [items, searchTerm]);
```

### Multiple Filters
```typescript
const filteredItems = useMemo(() => {
  return items.filter((item) => {
    const matchesSearch = item.nombre
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchesCategory =
      categoryFilter === 'all' ||
      item.categoriaId === categoryFilter;

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && item.active) ||
      (statusFilter === 'inactive' && !item.active);

    return matchesSearch && matchesCategory && matchesStatus;
  });
}, [items, searchTerm, categoryFilter, statusFilter]);
```

---

## Date Handling

### Formatting Dates
```typescript
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Simple format
format(new Date(item.createdAt), 'dd MMM yyyy', { locale: es })

// With time
format(new Date(item.createdAt), 'dd MMM yyyy, HH:mm', { locale: es })

// Relative time
differenceInDays(new Date(item.fechaVencimiento), new Date())
```

### Date Calculations
```typescript
import { addMonths, addYears } from 'date-fns';

// Add months
const vencimiento = addMonths(fechaInicio, 1);

// Add years
const vencimiento = addYears(fechaInicio, 1);
```

---

## Error Handling

### API Calls
```typescript
const handleAction = async () => {
  try {
    await someAction();
    toast.success('Operación exitosa');
  } catch (error) {
    console.error('Error:', error);
    toast.error('Error en la operación');
  }
};
```

### Form Submission
```typescript
const onSubmit = async (data: FormData) => {
  try {
    if (item) {
      await updateItem(item.id, data);
      toast.success('Actualizado');
    } else {
      await createItem(data);
      toast.success('Creado');
    }
    onOpenChange(false);
  } catch (error) {
    toast.error('Error al guardar');
  }
};
```

---

## Performance Optimization

### useMemo for Expensive Calculations
```typescript
const expensiveValue = useMemo(() => {
  return items.reduce((sum, item) => sum + item.value, 0);
}, [items]);
```

### useCallback for Event Handlers (when needed)
```typescript
const handleClick = useCallback((id: string) => {
  // Handler logic
}, [/* dependencies */]);
```

---

## Styling Patterns

### Responsive Grid
```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Content */}
</div>
```

### Conditional Styling
```typescript
<div className={cn(
  'base-classes',
  condition && 'conditional-classes',
  { 'class-1': condition1, 'class-2': condition2 }
)}>
  {/* Content */}
</div>
```

### Color Coding
```typescript
const getColor = (status: string) => {
  const colors = {
    active: 'text-green-600',
    suspended: 'text-yellow-600',
    inactive: 'text-gray-600',
    expired: 'text-red-600',
  };
  return colors[status];
};

<span className={getColor(item.status)}>{item.status}</span>
```

---

## Common Commands

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### File Generation
```bash
# Create new component
touch src/components/module/ComponentName.tsx

# Create new store
touch src/stores/entityStore.ts

# Create new page
mkdir -p src/app/\(dashboard\)/module-name
touch src/app/\(dashboard\)/module-name/page.tsx
```

---

## Debugging Tips

### Check Store State
```typescript
console.log('Store state:', { items, loading, error });
```

### Check Form Errors
```typescript
console.log('Form errors:', errors);
console.log('Form values:', watch());
```

### Check Filtered Data
```typescript
console.log('Original:', items);
console.log('Filtered:', filteredItems);
console.log('Filters:', { searchTerm, categoryFilter, statusFilter });
```

---

## Quick Checklist for New Features

- [ ] Update type definitions in `src/types/index.ts`
- [ ] Update store in `src/stores/`
- [ ] Update form schema in dialog component
- [ ] Add form fields to dialog UI
- [ ] Update table columns
- [ ] Update filters if needed
- [ ] Update metrics if needed
- [ ] Add validation rules
- [ ] Test create/edit/delete operations
- [ ] Test all filters and search
- [ ] Check responsive design
- [ ] Add error handling
- [ ] Add success toasts

---

## File Naming Conventions

- **Pages:** `page.tsx` (Next.js convention)
- **Components:** PascalCase (e.g., `UserTable.tsx`)
- **Stores:** camelCase with Store suffix (e.g., `usersStore.ts`)
- **Types:** Part of `types/index.ts`
- **Utils:** camelCase (e.g., `formatDate.ts`)

---

## Git Workflow

### Commit Message Format
```
feat: Add new feature
fix: Fix bug
refactor: Refactor code
style: Update styling
docs: Update documentation
test: Add tests
```

### Branch Naming
```
feature/feature-name
bugfix/bug-description
refactor/what-is-refactored
```

---

This guide provides quick reference patterns for common development tasks in the MovieTime PTY system. For more detailed information, refer to the main IMPLEMENTATION_SUMMARY.md document.
