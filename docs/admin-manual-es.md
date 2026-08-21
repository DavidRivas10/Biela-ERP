# Manual de administración de BIELA

Este manual está dirigido a responsables autorizados. La administración debe
seguir el principio de menor privilegio: cada persona recibe únicamente los
permisos necesarios para su trabajo.

## Usuarios

En **Administración → Usuarios** puede buscar y paginar Usuarios, crear uno,
editar nombre/correo/Roles y activar o desactivar. La contraseña solo se usa al
crear el Usuario: no se muestra, registra ni recupera después. Nunca comparta
credenciales ni use cuentas comunes para varias personas.

Desactivar impide autenticación y uso del token, sin eliminar historia. Para
reactivar, revise antes que sus Roles sigan siendo apropiados.

## Roles y permisos

En **Administración → Roles** cree o edite Roles con permisos del catálogo
controlado. Los identificadores internos de Role se obtienen del servidor y no
deben copiarse a código o documentación operativa.

Use Roles separados para lectura, operación y administración. Evite asignar
permisos de gestión de Caja, pagos, publicación de Ventas o movimientos de
Inventario a quien solo consulta. BIELA aplica los permisos en backend; ocultar
un botón en la interfaz no sustituye esa protección.

## Cajas y métodos de pago

Los permisos de gestión permiten crear, editar, activar y desactivar Cajas. Una
Caja inactiva conserva su historia y no acepta nuevas Sesiones. Antes de
desactivarla, verifique que no tenga una Sesión ABIERTA.

Los Métodos de Pago distinguen EFECTIVO, TARJETA, TRANSFERENCIA BANCARIA u OTRO.
EFECTIVO exige una Sesión ABIERTA y produce movimientos físicos. No cambie el
significado operativo de un método ya utilizado; desactívelo y cree otro cuando
corresponda.

## Salud y arranque local

- Aplicación: `http://localhost:5173`
- Salud del Gateway: `http://localhost:4000/health`
- Salud agregada: `http://localhost:4000/api/system/health`

El detalle técnico de arranque está en [operations-guide.md](operations-guide.md)
y la atención de fallos en [troubleshooting.md](troubleshooting.md).

## Interpretación segura de errores

- **401**: token ausente, inválido, vencido o Usuario inactivo. Inicie sesión de
  nuevo; no cambie permisos para corregir una contraseña equivocada.
- **403**: identidad válida sin el permiso requerido. Revise el Role aplicando
  menor privilegio.
- **409**: regla de negocio actual impide la acción; actualice y revise el
  documento, stock, pago o Sesión antes de repetir.
- **502/503**: dependencia temporalmente indisponible; no borre tokens, Usuarios
  ni datos para intentar corregirlo.

## Acciones prohibidas

No edite directamente MongoDB o PostgreSQL, no altere saldos, estados,
movimientos, hashes, Roles o migraciones mediante consola, y no use `prisma
migrate reset` contra datos compartidos. Las correcciones operativas deben usar
las APIs autorizadas. Los respaldos y restauraciones siguen
[backup-restore.md](backup-restore.md) y siempre separan MongoDB de PostgreSQL.
