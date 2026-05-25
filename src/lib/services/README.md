# Services

`src/lib/services` queda reservado para IO operacional y dependencias externas.

Debe vivir aqui:

- clientes de APIs externas;
- integraciones server/client con side effects operacionales;
- wrappers de infraestructura que no contienen reglas de dominio.

No debe vivir aqui:

- reglas de negocio de ventas, servicios, pagos o notificaciones;
- reacciones de cache/store;
- read models de UI;
- workflows de pantalla.

Esos flujos deben ir a `src/lib/use-cases`, `src/lib/store-reactions`, `src/lib/events` o al modulo de dominio correspondiente.
