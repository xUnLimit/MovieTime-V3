# MovieTime PTY - Quick Start Guide

## Installation (First Time)

```bash
cd movietime-pty
npm install
npm run dev
```

Open http://localhost:3000

## Implemented Modules Overview

### 1. Servicios (`/servicios`)
**Manage streaming service accounts**
- View all services with profile usage
- Add/edit/delete services
- Copy credentials to clipboard
- Track costs (individual vs familiar)
- Filter by category, type, status

**Key Components:**
- ServiciosMetrics - Shows active services, costs, profiles
- ServiciosTable - Progress bars for profile usage
- ServicioDialog - Auto-calculates total cost

### 2. Usuarios (`/usuarios`)
**Manage clients and resellers**
- Tab interface (Clientes | Revendedores)
- WhatsApp quick contact button
- Track balances and commissions
- Payment method integration

**Key Features:**
- ClientesTable - Shows balance and active services
- RevendedoresTable - Commission tracking
- WhatsApp integration (wa.me links)

### 3. Ventas (`/ventas`)
**Sales and subscription management**
- Create sales for clients/resellers
- Automatic date calculation
- Consumption tracking with progress bars
- Multiple actions: Renovar, Suspender, Activar
- Expiration warnings (color-coded)

**Key Features:**
- Most complex module
- Dropdown actions menu
- Progress bars for consumption
- Status badges (activa, suspendida, vencida)

### 4. Notificaciones (`/notificaciones`)
**Notification center**
- Timeline-style display
- Priority badges (baja, media, alta, crítica)
- Filter by type, priority, read status
- Mark as read / Mark all as read
- Integration with sales

### 5. Editor de Mensajes (`/editor-mensajes`)
**WhatsApp message templates**
- Create/edit message templates
- Live preview with placeholders
- Quick placeholder insertion
- 10 available placeholders
- 5 template types

**Placeholders:**
- {cliente}, {servicio}, {categoria}
- {monto}, {vencimiento}
- {correo}, {contrasena}
- {dias_retraso}, {fecha_inicio}, {ciclo_pago}

### 6. Log de Actividad (`/log-actividad`)
**Activity audit trail**
- Timeline visualization
- Filter by action, entity, user
- Color-coded actions
- User attribution
- Immutable logs

## Common Tasks

### Add a New Service
1. Go to `/servicios`
2. Click "Nuevo Servicio"
3. Select category
4. Choose type (individual/familiar)
5. Enter credentials and cost
6. Save

### Create a Sale
1. Go to `/ventas`
2. Click "Nueva Venta"
3. Select type (cliente/revendedor)
4. Choose user and service
5. Set amount and cycle
6. Payment method auto-populates
7. Save

### Create a Client
1. Go to `/usuarios`
2. Ensure "Clientes" tab is active
3. Click "Nuevo Cliente"
4. Enter name, phone, email
5. Select payment method
6. Save

### Create a Message Template
1. Go to `/editor-mensajes`
2. Click "Nuevo Template"
3. Enter name and select type
4. Write message content
5. Insert placeholders using buttons
6. Preview the message
7. Save

## Store Integration

All modules use Zustand stores:

```typescript
// In any component
import { useServiciosStore } from '@/stores/serviciosStore';

const { servicios, loading, fetchServicios, createServicio } = useServiciosStore();

useEffect(() => {
  fetchServicios();
}, [fetchServicios]);
```

## Form Patterns

All dialogs use React Hook Form + Zod:

```typescript
const schema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  // ... more fields
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
});
```

## File Structure Quick Reference

```
src/
├── app/(dashboard)/[module]/page.tsx    # Page components
├── components/[module]/                  # Module components
│   ├── [Module]Metrics.tsx              # KPI cards
│   ├── [Module]Filters.tsx              # Search & filters
│   ├── [Module]Table.tsx                # Data table
│   └── [Module]Dialog.tsx               # Create/edit form
└── stores/[entity]Store.ts              # Zustand store
```

## Reusable Components

### DataTable
```typescript
import { DataTable } from '@/components/shared/DataTable';

<DataTable
  data={items}
  columns={columns}
  actions={(item) => <Actions item={item} />}
/>
```

### ConfirmDialog
```typescript
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  onConfirm={handleDelete}
  title="Eliminar"
  description="¿Estás seguro?"
  variant="danger"
/>
```

### MetricCard
```typescript
import { MetricCard } from '@/components/shared/MetricCard';
import { Users } from 'lucide-react';

<MetricCard
  title="Total Users"
  value={150}
  icon={Users}
  description="Active users"
/>
```

## Key Patterns

### Progress Bars
```typescript
<Progress value={(current / total) * 100} className="h-2" />
```

### Status Badges
```typescript
<Badge variant={active ? 'success' : 'secondary'}>
  {active ? 'Activo' : 'Inactivo'}
</Badge>
```

### WhatsApp Button
```typescript
const handleWhatsApp = (phone: string) => {
  window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
};
```

## API Integration (TODO)

All stores have TODO markers for API integration:

```typescript
// TODO: Implement API call
// const response = await fetch('/api/servicios');
// const data = await response.json();
```

### Endpoints Needed:
- GET/POST/PUT/DELETE `/api/servicios`
- GET/POST/PUT/DELETE `/api/clientes`
- GET/POST/PUT/DELETE `/api/revendedores`
- GET/POST/PUT/DELETE `/api/ventas`
- PATCH `/api/ventas/:id/renovar`
- PATCH `/api/ventas/:id/suspender`
- GET/PATCH/DELETE `/api/notificaciones`
- GET/POST/PUT/DELETE `/api/templates-mensajes`
- GET `/api/activity-log`

## Development Commands

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Troubleshooting

### Build Errors
```bash
# Clear cache and reinstall
rm -rf .next node_modules
npm install
npm run dev
```

### Type Errors
Check `src/types/index.ts` for type definitions

### Store Not Updating
Make sure to call `fetch[Entity]()` in `useEffect`

### Form Not Validating
Check the zod schema in the dialog component

## Next Steps for Backend

1. **Set up API routes** in `src/app/api/`
2. **Replace TODO comments** in stores with actual API calls
3. **Add authentication** middleware
4. **Implement database** (Firebase/Supabase/PostgreSQL)
5. **Add error handling** and retry logic
6. **Set up WhatsApp API** for message sending
7. **Create cron jobs** for notifications

## Documentation

- **IMPLEMENTATION_SUMMARY.md** - Complete implementation details
- **DEVELOPER_GUIDE.md** - Development patterns and examples
- **README.md** - Project overview and setup
- **QUICK_START.md** - This file

## Support

For questions about the implementation, check the documentation files or examine the existing components for patterns.

---

**Current Status:** Frontend Complete, Ready for Backend Integration
**Version:** 2.0.0
**Last Updated:** January 28, 2026
