# Diseno: Metodo de pago pendiente en usuarios

## Objetivo

Agregar un estado inicial `Pendiente` solo en el modulo de usuarios y sincronizar el metodo de pago del usuario cuando se cree una venta, se renueve una venta o se edite un pago de venta.

## Decision principal

- `Pendiente` sera una opcion virtual del formulario de usuarios.
- No se creara como metodo de pago real en la coleccion `metodosPago`.
- El modulo de ventas seguira exigiendo metodos de pago reales.

## Cambios previstos

1. Agregar helpers compartidos para:
   - identificar el estado `Pendiente`;
   - normalizar el nombre visible del metodo de pago del usuario;
   - sincronizar el metodo de pago del usuario desde ventas.
2. Actualizar `UsuarioForm` para usar `Pendiente` por defecto.
3. Mostrar `Pendiente` en tablas y detalle de usuarios cuando aplique.
4. Evitar que ventas precargue un metodo invalido desde usuarios.
5. Sincronizar el usuario desde:
   - creacion de venta;
   - renovacion desde detalle de venta;
   - renovacion desde notificaciones;
   - edicion de pago de venta.

## Riesgos controlados

- No mezclar `Pendiente` con el catalogo real de metodos de pago.
- No dejar un metodo anterior pegado en el formulario de ventas al cambiar de usuario.
- Mantener la UI de usuarios actualizada mediante evento local y refresco de paginas paginadas.
