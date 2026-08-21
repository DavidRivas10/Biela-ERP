# Guion de demostración de BIELA (10–15 minutos)

Use solamente un ambiente local/controlado. No muestre `.env`, contraseñas,
tokens ni información personal. Los datos `FUNC12-` existentes pueden servir si
se confirma que pertenecen al ambiente de prueba; si no existen, genere nuevos
registros con un prefijo temporal desde la interfaz. No borre la base ni agregue
datos falsos al código de producción.

## Preparación

- Confirme salud agregada y una Sesión de Caja ABIERTA para operaciones en
  EFECTIVO.
- Seleccione un Producto con existencia conocida y un segundo Producto para
  mostrar búsqueda/compatibilidad.
- Tenga un Proveedor, Cliente, dos Ubicaciones y Métodos de Pago activos.
- Use montos y cantidades pequeñas; no reutilice documentos ya publicados.

## Narrativa

1. **Ingreso y Panel general (1 min).** Ingrese, explique navegación por
   permisos y muestre salud, cuentas operativas y Caja sin llamarlos
   contabilidad.
2. **Producto, Vehículo y Compatibilidad (1 min).** Abra un Producto, su
   Vehículo compatible y la relación explícita.
3. **Búsqueda (1 min).** Encuentre el Producto por código y por Vehículo con
   existencia; cambie de página o filtro para evidenciar consulta servidor.
4. **Inventario (1 min).** Muestre saldo por Ubicación e historial. Explique que
   Producto no almacena stock.
5. **Compra (1 min).** Cree/revise una Compra en borrador y confírmela. Verifique
   que confirmar no cambia Inventario.
6. **Recepción (1 min).** Publique una Recepción parcial y muestre el movimiento
   IN y el aumento de Inventario.
7. **Venta (1–2 min).** Cree una Venta registrada o de mostrador. Muestre que el
   borrador no cambia stock; publique y compruebe el movimiento OUT.
8. **Cobro y AR/AP (1 min).** Registre un Pago pequeño, muestre el historial y
   las cuentas por cobrar/pagar derivadas.
9. **Caja (1 min).** Abra la Sesión o use la existente, muestre efectivo
   esperado y el movimiento de Pago en el libro paginado.
10. **Devolución y Reembolso (1–2 min).** Publique una Devolución elegible para
    evidenciar Inventory IN/OUT según el lado y después registre el Reembolso;
    aclare que el Reembolso no cambia stock.
11. **Usuarios, Roles y RBAC (1 min).** Muestre el catálogo de permisos y cómo
    un Role limita menú/acciones mientras backend conserva autoridad.
12. **Cierre (1 min).** Regrese al Panel, resuma trazabilidad y mencione que
    contabilidad, fiscal, COGS, integraciones externas, offline, ampliaciones de
    taller/multisitio e IA están fuera de este release.

## Evidencia visual esperada

En cada comando transaccional muestre confirmación explícita, respuesta estable
y actualización de las vistas relacionadas. Evite improvisar doble envío: para
explicar protección de concurrencia use el reporte de Phase 12, no acciones
riesgosas durante la demostración.
