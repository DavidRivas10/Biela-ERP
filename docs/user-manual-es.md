# Manual de usuario de BIELA

Este manual describe el uso operativo del ERP tradicional BIELA. Las opciones
visibles dependen de los permisos asignados a cada usuario.

## Ingreso, salida y navegación

Abra `http://localhost:5173`, escriba su correo y contraseña y seleccione
**Ingresar**. Si el servicio está temporalmente indisponible, use **Reintentar**;
no confunda ese caso con credenciales inválidas. Para terminar, seleccione
**Salir** en la aplicación. No comparta su sesión ni deje un equipo abierto.

El menú agrupa Inicio, Comercial, Catálogo, Vehículos, Almacén, Caja y
Administración. Un mensaje **401** indica que la sesión no es válida o expiró.
Un **403** significa que la sesión sigue siendo válida, pero no tiene permiso
para la acción solicitada.

## Panel general

El Panel general muestra salud del sistema y, con el permiso correspondiente,
el resumen operativo de cuentas por cobrar, cuentas por pagar y sesiones de
Caja abiertas. Son datos calculados por el servidor; no son estados financieros
ni contabilidad general.

## Productos, vehículos y compatibilidad

- En **Catálogo → Productos** busque, consulte, cree o edite Productos. El
  precio de venta predeterminado es una sugerencia actual; no modifica precios
  de Ventas históricas.
- Categorías, Marcas y Atributos mantienen los catálogos controlados.
- En **Vehículos** administre Marca, Modelo, año, motor, generación y versión.
- En **Compatibilidad** relacione un Producto con un Vehículo. La relación es
  explícita; si ya existe, BIELA responde con un conflicto y no la duplica.
- Desactivar un registro evita nuevo uso donde corresponda, pero conserva su
  historia.

## Búsqueda

Use **Almacén → Búsqueda** para encontrar Productos por código o nombre y,
cuando aplique, por Vehículo compatible y existencia. Los filtros se ejecutan
en el servidor y la paginación permite alcanzar registros fuera de la primera
página.

## Ubicaciones, Inventario y Transferencias

Una Ubicación identifica físicamente zona, pasillo, estante y contenedor. El
Inventario siempre pertenece a un Producto y una Ubicación; no se guarda dentro
del Producto.

En **Movimientos** puede consultar el historial. Según permisos, los comandos
permitidos son existencia inicial, entrada, salida, ajuste a una cantidad
objetivo y transferencia. Un ajuste requiere motivo. Una transferencia mueve
la misma cantidad entre Ubicaciones diferentes. BIELA rechaza una salida sin
existencia suficiente y nunca deja una cantidad negativa.

## Proveedores, Compras y Recepción

1. Registre o seleccione un Proveedor activo.
2. Cree una Compra en borrador con sus Productos y cantidades.
3. Revise y confirme la Compra.
4. Registre una Recepción parcial o total y, cuando esté correcta, publíquela.

Confirmar la Compra **no aumenta el Inventario**. Publicar la Recepción sí crea
las entradas de Inventario. Una Recepción publicada no se edita y BIELA rechaza
recibir más de lo pendiente.

## Devoluciones de Compra, pagos y cuentas por pagar

Cree la Devolución desde una Compra recibida, elija las cantidades y Ubicaciones
de origen y publíquela. El borrador no cambia existencias; publicar la
Devolución crea la salida de Inventario.

Los Pagos a Proveedor reducen la obligación. Un Reembolso del Proveedor aplica
dinero a una Devolución publicada. Si el método es EFECTIVO, seleccione una
Sesión de Caja ABIERTA. El historial y las reversiones conservan trazabilidad.
La Devolución afecta Inventario al publicarse; el Reembolso afecta finanzas, no
Inventario directamente. Consulte el resultado derivado en **Cuentas por
pagar** o en la cuenta del Proveedor.

## Clientes, Ventas y Venta de mostrador

1. Seleccione un Cliente activo o deje explícitamente la Venta sin Cliente para
   una Venta de mostrador.
2. Agregue Productos, Ubicaciones, cantidades y precios.
3. Guarde el borrador, revíselo y publíquelo.

Una Venta en borrador **no reduce el Inventario**. Publicar la Venta crea las
salidas atómicas de Inventario. Si una línea no tiene suficiente existencia,
no se publica parcialmente ninguna línea.

## Devoluciones de Venta, cobros y cuentas por cobrar

Desde una Venta publicada cree una Devolución dentro de las cantidades aún
elegibles. El borrador no cambia existencias; publicar la Devolución crea la
entrada de Inventario. Los Pagos del Cliente reducen lo pendiente. El Reembolso
al Cliente devuelve dinero elegible por una Devolución publicada. Con EFECTIVO
se requiere una Sesión ABIERTA. El Reembolso afecta finanzas, no Inventario.
Consulte el estado derivado en **Cuentas por cobrar** o en la cuenta del Cliente.

## Caja

- **Cajas** administra los puntos físicos de Caja.
- Una **Sesión** se abre con efectivo inicial; solo puede existir una ABIERTA
  por Caja.
- El efectivo esperado lo calcula BIELA a partir del monto inicial y el libro
  inmutable de movimientos.
- Los movimientos manuales de entrada o salida requieren motivo. Una salida que
  dejaría efectivo negativo se rechaza.
- Para cerrar, registre el efectivo contado. BIELA guarda esperado, contado y
  diferencia. Una Sesión cerrada ya no acepta movimientos.
- **Movimientos** ofrece filtros y páginas; no se limita a los primeros 100.

## Mensajes habituales

| Situación | Qué significa | Qué hacer |
| --- | --- | --- |
| Datos inválidos | Falta un campo o su formato/cantidad no es válido | Revise los campos marcados |
| No encontrado | El registro ya no existe o la dirección es incorrecta | Regrese al listado y busque de nuevo |
| Conflicto | La regla ya cambió: duplicado, acción repetida, saldo/existencia insuficiente | Actualice la pantalla y revise el estado actual |
| Sin autorización | La sesión expiró | Ingrese nuevamente |
| Sin permiso | Su rol no permite la operación | Solicite revisión a un administrador |
| Servicio no disponible | Hay una interrupción temporal | Conserve la sesión, espere y use Reintentar |

No repita una operación transaccional a ciegas después de una respuesta dudosa:
actualice primero el documento, Inventario o Sesión de Caja para confirmar si la
acción ya fue aplicada.
