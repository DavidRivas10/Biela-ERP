# Progreso — Fase 14.2 (flujos de negocio reales + identidad visual)

Este archivo es el registro vivo pedido en el prompt raíz de esta fase. Para el
detalle de la reconstrucción de UX de los 12 módulos anteriores (ya completa y
pusheada) ver **`docs/RECONSTRUCCION-UX.md`** — no se duplica acá.

## Decisiones tomadas con el dueño (2026-09-10)

Antes de escribir código se hizo Fase 0 (recorrido + inventario) y se
confirmaron 3 decisiones:

1. **Base visual: pulir el sistema propio actual — NO migrar a shadcn-admin.**
   El frontend ya tiene identidad (petróleo/latón, IBM Plex, login temático,
   165 tests atados a la estructura actual). Migrar a Tailwind+shadcn/ui+Radix
   habría significado reescribir ~20 pantallas y ~165 tests días antes de la
   presentación. Se descartó por riesgo/tiempo.
2. **Prioridad: flujos de negocio nuevos primero, identidad visual después.**
3. **Pasillo/Estante (2.5): migración Prisma aditiva `phase_14_...` + UI**, no
   solo mock de frontend.

## Hallazgos de Fase 0 (qué ya existía antes de este prompt)

- `PosPage.tsx` ya separa "Punto de venta" (turno de caja, pendientes de
  cobro, cuentas abiertas) de "Ventas" (listado administrativo). **Pero** la
  edición de líneas de una venta (todos los modos, incluida "mostrador") vive
  en `SaleEditor` dentro de `SalesPages.tsx`, y ahí Ubicación/Cantidad/Precio/
  Descuento/Impuesto están **todos visibles por línea siempre** → 2.1 sigue
  pendiente de verdad, no es solo una percepción vieja del dueño.
- El backend **ya soporta** `GET /api/sales?status=DRAFT&hasAccountLabel=true`
  (para listar cuentas abiertas) — no hace falta tocar el backend para 2.2.
- `PurchaseChain.tsx` + `PurchaseInboxPage.tsx` ya dan la recepción como línea
  de tiempo (2.3 parcialmente hecho) — falta confirmar el mensaje explícito
  "producto reconocido / producto nuevo" en el escaneo de recepción.
- El escáner de cámara (`BarcodeCameraModal.tsx`) ya quedó corregido y probado
  en teléfono real la sesión pasada.

## Plan de ejecución (orden acordado)

1. ✅ **2.2 — Cuentas simultáneas por vehículo + autosave.** Hecho, verificado
   en navegador (con datos reales sembrados y luego desactivados/cancelados,
   no en la base final) y con tests nuevos. Ver detalle abajo. Commit
   `2.2-cuentas-simultaneas`.
2. ✅ **2.1 — Venta rápida de mostrador: colapsar campos secundarios por línea.**
   Ver detalle abajo. Commit `2.1-linea-colapsada`.
3. ✅ **2.5 — Pasillo → Estante → Nivel.** Hallazgo clave: el backend YA
   soportaba esto desde la Fase 3 (`Location.aisle/rack/shelf/bin`, DTOs
   completos) — **no hizo falta ninguna migración**. Era un vacío de
   frontend. Ver detalle abajo. Commit `2.5-pasillo-estante-nivel`.
4. ✅ **2.3 — Recepción: reconocido/nuevo explícito + revisar wizard.** El
   wizard de línea de tiempo ya existía (`PurchaseChain`); el vacío real era
   el mensaje reconocido/nuevo al escanear. Ver detalle abajo. Commit
   `2.3-producto-reconocido-nuevo`.
5. ✅ **2.4 — Auditoría del descuento atómico de inventario al confirmar
   venta.** El backend YA es atómico (probado); el hallazgo real fue de
   caché en el frontend. Ver detalle abajo. Commit `2.4-stock-al-dia`.
6. ⬜ **Fase 1 — Pulido de identidad visual** sobre el sistema propio (no
   shadcn), aplicado a todas las pantallas.
7. ⬜ **Fase 3 — Verificación final** (recorrido "perro guardián" + capturas +
   cierre de este archivo).

Reglas de datos que se respetan en todo momento: nada de borrado físico de
historial real; cualquier cambio de esquema es aditivo y prefijado
`phase_14_`; permisos siguen siendo por permiso, nunca por nombre de rol.

## Detalle — 2.2 Cuentas simultáneas + autosave

**Problema real (confirmado en el código, no solo dicho por el dueño):** para
seguir sumando piezas a una cuenta abierta ya existente, el flujo era Detalle
→ "Editar" → agregar → Guardar → vuelve a Detalle → "Editar" de nuevo. Para
alternar entre dos vehículos en reparación había que volver a Punto de venta
cada vez y no había ningún respaldo si el navegador se cerraba a mitad de
carga de productos.

**Cambios:**
- `SaleEditor` ahora se remonta por `id`/modo (bug latente de antes: sin
  `key`, cambiar de `:id` en la misma ruta no reseteaba el estado local —
  React Router no remonta el componente solo porque cambie el param).
- Guardar una **cuenta** existente ya no navega al detalle: se queda en el
  formulario de edición (para seguir sumando piezas o saltar a otra cuenta).
  Crear una cuenta nueva navega a su edición (no al detalle). Mostrador y
  cliente registrado se comportan igual que antes (van al detalle, para
  cobrar).
- Nueva franja de pestañas de **cuentas abiertas** dentro del formulario
  cuando el modo es "cuenta": lista las demás cuentas DRAFT con etiqueta,
  resaltando la actual, con una pestaña "+ Nueva cuenta". Un clic alterna sin
  salir de la pantalla de venta.
- `PosPage`: el enlace "Abrir" de cada cuenta abierta ahora va directo a
  edición (antes iba al detalle de solo lectura).
- **Autosave a `localStorage`**, debounced (~600 ms), de todo el formulario
  mientras se edita (clave por `id` si es una cuenta existente; una clave fija
  para una cuenta nueva sin guardar todavía). Al detectar un borrador guardado
  al montar, se ofrece restaurar o descartar con un aviso simple (no bloquea
  la pantalla). Se borra el borrador local al guardar con éxito.

**Archivos:** `src/sales/SalesPages.tsx`, `src/pos/PosPage.tsx`,
`src/hooks/use-draft-autosave.ts` (nuevo), `src/components/OpenAccountsBar.tsx`
(nuevo), `src/sales/SaleEditor.test.tsx` (nuevo, 4 tests), CSS en `global.css`.

**Verificado en navegador (perro guardián):** sembré 2 cuentas reales por API
(Corolla azul – Juan / Sentra gris – María, mismo producto/ubicación) →
Punto de venta las muestra → "Seguir cargando" entra directo a edición → la
franja de pestañas muestra ambas, resaltando la activa → cambiar de pestaña
carga la otra cuenta sin arrastrar el estado de la anterior (el bug latente de
`SaleEditor` sin `key` ya no existe) → "Guardar cuenta" se queda en edición →
recargar la página con cambios sin guardar muestra el aviso de recuperación →
"Restaurar" repuebla el formulario. Datos de prueba cancelados/desactivados al
terminar (no quedan en la base para el demo real).
Técnica: `tsc -b` OK · `eslint` OK · `vitest` 169/169 (169 = 165 + 4 nuevos) ·
`vite build` OK.

## Detalle — 2.1 Venta rápida: campos secundarios de línea colapsados

**Problema real (confirmado en el código):** `SaleEditor` es el mismo
formulario para mostrador/cliente/cuenta, y cada línea de producto mostraba
siempre editables Ubicación origen, Cantidad, Precio unitario, Descuento e
Impuesto — inviable para un vendedor escaneando rápido en el mostrador.

**Cambios (en `SalesPages.tsx`, todas las modalidades de venta):**
- **Ubicación origen**: una línea nueva hereda automáticamente la ubicación de
  la última línea usada (`lastUsedLocation`), tanto al escanear un producto
  como al presionar "Agregar producto". La mayoría de las ventas sale de la
  misma ubicación/estante, así que rara vez hay que tocarlo — sigue siendo
  editable si hace falta.
- **Precio unitario**: pasa a un `<details>` compacto que muestra el precio ya
  elegido (`L 85.00`) y se abre solo si hace falta decidir uno (`elegí uno`)
  o si el usuario quiere cambiarlo. Se cierra solo apenas el producto trae un
  precio sugerido.
- **Descuento / Impuesto**: colapsados detrás de un `<details>` "Descuento /
  impuesto", cerrado por defecto en una línea nueva. Si la línea ya trae un
  descuento o impuesto distinto de cero (editando una venta existente), se
  abre solo — nunca esconde un ajuste de dinero que ya existía.
- Nada de esto cambia lo que se envía al backend ni las reglas de validación;
  es solo qué tan visible/editable es cada campo por defecto.

**Archivos:** `src/sales/SalesPages.tsx` (`newLine`, `lastUsedLocation`,
`hasMoneyAdjustment`, JSX de la línea), CSS `.line-price`/`.line-more` en
`global.css`. Tests nuevos en `SaleEditor.test.tsx` (3): cierre automático del
precio al llegar el sugerido y descuento/impuesto colapsado en una línea
nueva; una línea nueva hereda la ubicación de la anterior; una línea existente
con descuento no lo esconde.

Técnica: `tsc -b` OK · `eslint` OK · `vitest` 172/172 (+3 nuevos) ·
`vite build` OK. (La verificación interactiva en Chrome real, vía inyección
de eventos de bajo nivel en el DOM, resultó poco confiable para un `<select>`
controlado por React — se cambió a los tests de arriba, que ejercitan la
misma ruta que un usuario real mediante `@testing-library/user-event`.)

## Detalle — 2.5 Pasillo → Estante → Nivel

**Hallazgo antes de escribir nada:** el modelo `Location` de Prisma ya tiene
`zone/aisle/rack/shelf/bin` desde la Fase 3, y `CreateLocationDto`/
`UpdateLocationDto` ya los validan y exponen — confirmado leyendo
`schema.prisma` y el DTO, no solo la respuesta HTTP. **No hizo falta ninguna
migración.** El vacío real estaba en el frontend: `LocationsPage.tsx` ya
mostraba Pasillo/Estante en el form y la lista (de un módulo anterior), pero
esa etiqueta física no aparecía en ningún otro lado — ni al elegir una
ubicación en una venta/compra, ni en el listado de Inventario, que es
justamente donde más importa para encontrar la pieza físicamente.

**Cambios:**
- `utils/formatters.ts`: nuevo `locationPhysicalHint(location)` → "Pasillo de
  filtros · Estante 2 · Nivel 3" (o `null` si no hay nada cargado). Un solo
  lugar para el formato, reusado en los tres puntos de abajo.
- `LocationsPage.tsx`: se agrega el campo **"Nivel / posición (opcional)"**
  (mapeado a `bin`) al formulario, completando el tercer nivel que pedía el
  dueño; la columna de lista pasa a usar el helper (incluye el nivel).
- `EntitySelectors.tsx` (`LocationSelector`, usado en Ventas/Compras/
  Transferencias): cada opción y la línea "Elegida" ahora muestran el pasillo/
  estante/nivel junto al código y nombre.
- `InventoryPages.tsx`: la columna "Ubicación" del listado de Inventario
  ahora incluye la pista física — es la pantalla donde de verdad hace falta
  para no tener que buscar a ciegas.
- Sin tocar `schema.prisma`, sin migraciones, sin cambios de backend.

**Archivos:** `src/utils/formatters.ts` (+test), `src/inventory/LocationsPage.tsx`,
`src/components/EntitySelectors.tsx`, `src/inventory/InventoryPages.tsx`.

**Verificado en navegador:** creé una ubicación real (MOS-02 · Mostrador
trasero · Pasillo de filtros · Estante 2 · Nivel 3) desde el formulario →
aparece en la lista de Ubicaciones con los tres niveles → al elegir ubicación
en "Nueva venta" la opción del selector ya trae "MOS-02 · Mostrador trasero —
Pasillo de filtros · Estante 2 · Nivel 3". Ubicación de prueba desactivada al
terminar.

Técnica: `tsc -b` OK · `eslint` OK · `vitest` 174/174 (+2 nuevos) ·
`vite build` OK.

## Detalle — 2.4 Auditoría: stock que se ve disponible pero ya se vendió

**Auditoría del backend (sin tocar código, solo lectura):**
- `SalesService.post()` corre dentro de `prisma.runSerializable(...)` (aislamiento
  SERIALIZABLE): bloquea la venta, resuelve los productos/ubicaciones, crea un
  movimiento `OUT` por línea, y solo entonces pasa la venta a POSTED con un
  `updateMany` condicionado a `status: DRAFT` (compara-y-cambia, evita doble
  confirmación por carrera). Si cualquier línea falla, **toda la transacción
  se revierte** — nada queda a medias.
- `InventoryService.applyOut()` decrementa con `updateMany({ where: { id,
  quantity: { gte: cantidad } } })` — un compare-and-swap real a nivel de
  fila, no solo el aislamiento de la transacción. Si no alcanza el stock,
  lanza `ConflictException("Insufficient stock")`.
- Ya existe un test e2e que prueba exactamente esto:
  `sales.e2e-spec.ts` → **"rolls back every line when one Product has
  insufficient stock"** — dos productos en una venta, uno sin stock
  suficiente, confirma que **ninguno** de los dos se descuenta y la venta
  queda DRAFT. Lo corrí de nuevo ahora mismo: **pasa.**
- Guardar como DRAFT (`create`/`update`) no toca inventario en absoluto —
  confirmado leyendo el código, no solo la descripción de la pantalla.
- **Conclusión: el backend nunca deja un descuento a medias.** No hacía
  falta ni se tocó ninguna lógica de negocio ahí.

**El hallazgo real — caché del frontend entre pestañas/terminales:**
`App.tsx` tenía `refetchOnWindowFocus: false` con `staleTime: 30_000`.
React Query invalida la caché **solo en el navegador donde ocurrió la
venta**. Si el mostrador tiene dos terminales (o el mismo vendedor con dos
pestañas), la pantalla de Inventario o Búsqueda abierta en la OTRA terminal
no se entera de que el stock cambió — ni al volver a esa pestaña (estaba
apagado el refetch-on-focus), ni sola (no había sondeo). Ahí es donde
"se ve disponible algo que ya se vendió" puede pasar de verdad, sin que el
dato en la base esté mal.

**Corrección (frontend, sin tocar el backend):**
- `App.tsx`: `refetchOnWindowFocus: true` — al volver a mirar una pantalla,
  se refresca si hace falta. Es el arreglo estándar y de menor riesgo para
  esta clase de problema.
- `InventoryPages.tsx` y `SearchPage.tsx` (las dos pantallas donde alguien
  decide "sí hay" antes de prometerle algo a un cliente): `refetchInterval:
  20_000` — se refrescan solas cada 20 s mientras están abiertas, sin
  necesidad de que alguien cambie de pestaña. No se agregó sondeo al resto
  de la app (catálogo, vehículos, roles, etc.) para no generar tráfico de
  más donde no hace falta.

**Archivos:** `src/app/App.tsx`, `src/inventory/InventoryPages.tsx`,
`src/search/SearchPage.tsx`.

Técnica: `tsc -b` OK · `eslint` OK · `vitest` 174/174 (sin tests nuevos —
cambio de configuración, cubierto por la suite existente) · `vite build` OK ·
e2e `sales.e2e-spec.ts` (rollback atómico) re-corrido y en verde.

## Detalle — 2.3 Recepción de facturas: reconocido vs. nuevo

**Lo que ya existía (verificado, no se tocó):** `PurchaseChain.tsx` ya
muestra "1. Registrar la factura → 2. Confirmar → 3. Recibir la mercadería →
4. Pagar" como una sola línea de tiempo (no secciones sueltas), resaltando el
paso actual según el estado real de la compra, y ya está presente en el
listado, el formulario y el detalle. El wizard que pedía el dueño **ya
estaba construido** en una sesión anterior.

**El vacío real:** al registrar la factura (paso 1) ya se podía escanear un
producto (`BarcodeScanButton` + `useScanToProduct`, igual que en Ventas), pero
un código que no existía en el catálogo solo daba un mensaje de error
("Ningún producto activo con el código «…»") sin ninguna salida — había que
abandonar la compra, ir a Catálogo → Productos → Nuevo, cargarlo a mano, y
volver a buscarlo. Nada distinguía "esto ya lo vendemos" de "esto es nuevo".

**Cambios:**
- `use-scan-to-product.ts`: nuevo tono `"new"` (antes solo `"ok" | "error"`),
  con `allowNew` opcional — una venta solo puede referenciar catálogo
  existente (ahí sigue siendo error), pero registrar una factura sí puede
  toparse con una pieza nunca comprada antes. Mensaje "Reconocido: CÓDIGO ·
  Nombre" (antes "Agregado:") cuando existe; "Producto nuevo: «código» no
  está en el catálogo todavía." cuando no.
- `PurchasePages.tsx`: activa `allowNew`; cuando el tono es "new" agrega un
  enlace **"Registrar producto nuevo →"** a
  `/app/catalog/products/new?code=<el código escaneado>`.
- `ProductsPages.tsx` (`ProductFormPage`): lee `?code=` y precarga el campo
  Código en un producto nuevo, para no volver a escribirlo.

**Archivos:** `src/hooks/use-scan-to-product.ts`, `src/purchasing/PurchasePages.tsx`,
`src/catalog/ProductsPages.tsx`, CSS `.scan-row__feedback--new` en
`global.css`. Tests nuevos: `PurchasingPages.test.tsx` (+1, escanea un código
reconocido y uno nuevo, revisa el enlace) y `ProductFormPage.test.tsx`
(nuevo, precarga del código).

**Verificado en navegador:** escaneado manual de "FILT-999-NUEVO" en
Registrar factura → aviso ámbar "Producto nuevo…" con el enlace → clic →
"Nuevo producto" ya trae el código cargado.

Técnica: `tsc -b` OK · `eslint` OK · `vitest` 176/176 (+2 nuevos) ·
`vite build` OK.
