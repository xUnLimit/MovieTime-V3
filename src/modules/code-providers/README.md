# Proveedores de códigos

Una plataforma nueva es datos de categoría + un adaptador `CodeProvider` registrado en `index.ts`.
Netflix envuelve el API público de `modules/netflix`; sus parsers no se duplican.

## Esqueleto para Spotify, Disney+ o Prime Video (sin registrar proveedores ficticios)

1. Crear `<plataforma>-provider.ts` que implemente `CodeProvider`: clave estable, etiqueta,
   `mailboxConfigKey` lógico, tipos soportados, `parse`, `belongsTo`, `formatDelivery` y
   `parseTravelPage` (devolver null cuando no aplique).
2. Validar tamaño, URLs/dominios y contenido en el parser; nunca devolver enlaces arbitrarios.
   Asociar correo y perfil/venta sin depender del nombre visible de categoría o cuenta.
3. Registrar una instancia inmutable y agregar fixtures sintéticos y pruebas de aislamiento.
4. El administrador asigna `categorias.code_provider` por los casos de uso de categorías;
   puede habilitar `servicios.acceso_por_codigo` por cuenta. Las claves se validan contra el registro.
5. Conectar el mailbox en el composition root usando `mailboxConfigKey`, con secretos de servidor,
   timeout y errores controlados. Reutilizar la orquestación, ventanas, autorización y reclamos,
   sin copiar el flujo de Netflix.

En esta fase el bot publicado conserva sus acciones/eventos Netflix y su mailbox `NETFLIX_IMAP_*`.
Los reclamos Netflix siguen usando la tabla/RPC anterior para coexistir con versiones desplegadas;
`code_claims` recibe el backfill inicial. Migrar consumidores y sincronizar reclamos antes del contract.
No se añade todavía botón de solicitar código ni aviso masivo al cambiar el indicador.
