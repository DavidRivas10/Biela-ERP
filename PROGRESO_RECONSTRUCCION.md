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
6. ✅ **Fase 1 — Pulido de identidad visual.** Auditoría real (no solo
   supuesta): recorrido en claro y oscuro por Inicio, Punto de venta, Ventas
   (con las pestañas y campos nuevos), Compras (con el aviso reconocido/
   nuevo), Vehículos, Roles, login. Conclusión honesta: **el sistema ya tiene
   identidad sólida** de las sesiones anteriores (petróleo/latón, IBM Plex,
   login temático, densidad del Inicio, tema claro/oscuro) y de lo que se
   construyó en esta sesión (pestañas, `<details>` de línea, aviso de
   producto nuevo) — todo se ve coherente en ambos temas, sin restos de
   plantilla ni texto en inglés. No hizo falta ningún cambio visual nuevo;
   forzar cambios sin un problema real habría sido ruido, no pulido. Ver
   detalle abajo.
7. ✅ **Fase 3 — Verificación final.** Suite completa en verde en las 4
   piezas (frontend + los 3 servicios backend). Ver detalle abajo.

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

## Detalle — Fase 1: pulido de identidad visual

**Auditoría hecha (no solo revisada de memoria):** recorrido real en el
navegador, en modo claro y oscuro, por Panel de inicio, Punto de venta,
Ventas (lista + "Nueva venta" con las pestañas de cuentas abiertas y los
campos de línea colapsados), Vehículos (vacío + filtro plegado), Roles
(tabla de permisos), Recepción de facturas (aviso reconocido/nuevo), y
login. Además, barrido del código fuente buscando restos típicos de un
trabajo a medias: `TODO`/`FIXME`/texto de relleno, y literales en inglés
como "Submit"/"Cancel"/"Active" en JSX — **cero coincidencias**.

**Conclusión:** el sistema ya tiene identidad propia y consistente de las
sesiones anteriores (tema petróleo/latón con claro/oscuro, IBM Plex, login
temático con el engranaje de marca, densidad del Panel de inicio) y de lo
construido en esta sesión (pestañas de cuentas, campos de línea colapsados,
pistas de pasillo/estante, aviso de producto nuevo) — todo usa las mismas
variables de tema (`var(--...)`) y se ve bien en ambos modos, sin restos de
plantilla genérica ni texto sin traducir.

**Decisión:** no se hizo ningún cambio visual adicional en esta fase.
Introducir cambios de diseño sin un problema concreto detectado habría sido
ruido — no "pulido" — y contradice la decisión ya tomada de no perseguir una
migración de plantilla. Si al ver el sistema en persona el dueño encuentra
algo puntual que no le guste, es más rápido corregirlo dirigido que
adivinarlo ahora.

**Nota aparte (dato, no bug de UI):** en Roles aparecen filas de prueba de
las suites e2e del backend (`func12-...`, `phase11-reader-...`,
`phase12-reader-...`) — quedaron de antes, no las tocué (no es un problema
de diseño y no me corresponde borrar datos sin que lo pidas). Si querés que
las desactive o limpie antes de la presentación, decímelo.

## Detalle — Fase 3: verificación final

Suite completa corrida de punta a punta, sin cambios pendientes:

- **Frontend:** `tsc -b` OK · `eslint` 0 warnings · **`vitest` 176/176** ·
  `vite build` OK.
- **`ms-autorepuesto`:** e2e completo, **125/125**, 17 suites (incluye el
  rollback atómico de inventario de 2.4).
- **`ms-users`:** e2e, **1/1**.
- **`api-gateway`:** e2e, **21/21**.

Nada de esto tocó `schema.prisma` ni corrió migraciones — todo lo de esta
sesión (Fase 14.2) fue frontend, salvo lectura de auditoría en el backend
para 2.4 y 2.5.

## Estado y pendientes para David

- **Todo commiteado en `redesign/producto-ux`** en 5 commits pequeños (uno
  por punto de la Fase 2) más este archivo. **Sin push** — a la espera de tu
  confirmación, igual que las sesiones anteriores.
- **Pendiente de tu decisión:** limpiar los roles de prueba (`func12-…`,
  `phase11-reader-…`, `phase12-reader-…`) que quedaron de las suites e2e del
  backend — no los toqué.
- **P4 / escáner:** ya lo confirmaste funcionando en tu teléfono la sesión
  pasada; sin cambios nuevos ahí.
- Recorré vos mismo Ventas (cuentas simultáneas), Compras (producto nuevo) e
  Inventario/Ubicaciones (pasillo/estante) antes de la presentación — son los
  tres flujos con más cambio de comportamiento esta ronda.

## Fase 15 — Prioridad crítica: velocidad de captura (2026-09-11)

David reportó que cargar un solo producto en Ventas o Compras toma cerca de
3 minutos, y pidió, por encima de cualquier ajuste visual: colapsar todo
campo secundario por defecto, autoseleccionar cuando hay una sola opción
posible, foco automático en el siguiente campo útil, y Guardar como una sola
acción sin campos obligatorios sin sentido — aplicado de forma uniforme en
Ventas (las 3 modalidades), Compras e Inventario. Pidió cronometrar el
resultado yo mismo.

### Regla 1 — Campos secundarios colapsados por defecto

- **Ventas** (`SalesPages.tsx`, las 3 modalidades comparten el mismo editor
  de línea): además de Precio unitario y Descuento/Impuesto (ya colapsados
  en la ronda anterior), ahora **Ubicación origen** también queda detrás de
  un resumen compacto ("Ubicación: BOD-01 · Bodega principal", editable con
  un clic). Solo **Producto** y **Cantidad** quedan siempre visibles por
  línea.
- **Compras** (`PurchasePages.tsx`): **Costo unitario** pasa al mismo patrón
  compacto — se precarga con el costo de referencia del producto
  (`referenceCost`, ya existía en el catálogo pero no se usaba acá) y se
  cierra solo; si el producto no tiene costo de referencia, queda abierto
  para pedirlo (nunca esconde un dato que hace falta). **Descuento/Impuesto**
  colapsados igual que en Ventas.
- **Inventario**: el formulario de movimiento manual ya era acotado (Tipo,
  Producto, Ubicación, Cantidad, Motivo) — no tiene una línea que se repite
  por producto como Ventas/Compras, así que no había "descuento/impuesto"
  que esconder ahí. Sí se beneficia de la regla 2 (ubicación) y 3 (foco).

### Regla 2 — Autoseleccionar cuando hay una sola opción posible

- Nuevo hook `useAutoSelectSoleOption` (`hooks/use-auto-select-sole-option.ts`):
  cuando una búsqueda sin término activo resuelve en exactamente un
  resultado total y nada está elegido todavía, lo selecciona solo — sin
  pedirle al usuario que confirme una lista de uno. Se queda quieto mientras
  hay un término de búsqueda activo (no le gana a una búsqueda deliberada).
- Conectado en **`LocationSelector`** y **`SupplierSelector`**
  (`EntitySelectors.tsx` / `PurchasingSelectors.tsx`) — beneficia de
  inmediato a Ventas, Compras (proveedor, una sola vez por factura, no por
  línea), Inventario (movimientos y transferencias) sin tocar esas pantallas
  para nada; es un cambio en el componente compartido.
- **Cero cambios de backend**: los endpoints de ubicaciones/proveedores ya
  devuelven `meta.total`, que es todo lo que hace falta para saber si hay
  una sola opción activa.

### Regla 3 — Foco en el siguiente campo útil

- Nuevo hook `useFocusFieldById` (`hooks/use-focus-field.ts`): enfoca y
  selecciona el texto del campo indicado apenas cambia el id objetivo.
- Conectado en Ventas, Compras e Inventario: apenas un producto entra a una
  línea (escaneado o elegido a mano), el cursor salta solo a **Cantidad**
  (con el valor ya seleccionado, listo para sobrescribir con un número, o
  para seguir escaneando si se deja en "1").

### Regla 4 — Guardar como una sola acción sin campos sin sentido

- Auditado: Ventas y Compras ya no piden "Fecha de vencimiento" salvo en
  los modos donde tiene sentido (crédito), y no era obligatoria en ningún
  caso. **Encontrado y corregido:** Compras pedía "Fecha del documento" en
  blanco por defecto (Ventas ya la precargaba con hoy) — ahora Compras
  también arranca con la fecha de hoy.

### Verificación cronometrada (navegador real, no simulada)

Con exactamente un producto, una ubicación y un proveedor activos (el caso
típico de un negocio con un solo mostrador/bodega), midiendo con
`performance.now()` dentro del propio navegador de principio a fin:

| Pantalla | Desde escribir el código hasta Cantidad enfocada | Guardar → confirmado |
|---|---|---|
| Ventas (mostrador) | **1.37 s** | 0.30 s |
| Compras | **1.86 s** (con costo de referencia precargado) | 1.00 s |
| Inventario (movimiento) | **1.86 s** | *(no se completó — ver nota)* |

En los tres casos, la ubicación (y en Compras, el proveedor) ya estaban
elegidos solos antes de que el operador tocara nada más que el código del
producto. De "cerca de 3 minutos" a **menos de 3 segundos** de principio a
fin por línea, incluyendo Guardar.

Nota: no completé el movimiento de Inventario de la prueba (los movimientos
son inmutables, no se pueden borrar — completar uno real habría dejado un
registro permanente y un saldo de stock solo para esta verificación).
Cancelé el formulario antes del último paso; el tiempo hasta "listo para
cargar la cantidad" ya quedó medido igual.

Producto/ubicación/proveedor de prueba desactivados al terminar; las 4
ventas/compras de prueba creadas en esta sesión quedaron canceladas — nada
de esto queda activo en la base para la presentación.

**Archivos:** `src/hooks/use-auto-select-sole-option.ts` (nuevo),
`src/hooks/use-focus-field.ts` (nuevo), `src/components/EntitySelectors.tsx`,
`src/components/PurchasingSelectors.tsx`, `src/sales/SalesPages.tsx`,
`src/purchasing/PurchasePages.tsx`, `src/inventory/InventoryPages.tsx`,
CSS (`.line-field` generalizado, antes `.line-price`). Tests nuevos: 2 en
`EntitySelectors.test.tsx`, 1 en `PurchasingSelectors.test.tsx`, 3 en
`SaleEditor.test.tsx`, 1 en `PurchasingPages.test.tsx`, 1 archivo nuevo
`InventoryMovementsPage.test.tsx`.

Técnica: `tsc -b` OK · `eslint` 0 warnings · `vitest` **182/182** (+9 nuevos)
· `vite build` OK · e2e de rollback atómico (backend, no tocado) re-verificado
en verde.

## Fase 16 — Bug crítico de activar producto, cierre de cuenta, tabla de
## productos y ajustes de Clientes (2026-09-11/12)

Prompt de David para esta ronda, en orden de prioridad: (1) el toggle de
activar/desactivar producto no funciona — queda inactivo aunque se intenta
activar; (2) agregar el paso cerrar cuenta → cobrar a una cuenta abierta;
(3) rediseñar "Productos" en Ventas y Compras como tabla; (4) confirmar si
una cuenta abierta se guarda en el servidor al instante o solo en el
navegador. Más tres ajustes puntuales en Clientes (prefijo `CLI`, RTN de 14
dígitos, teléfono más largo).

### 1 — Bug crítico: activar producto

**El botón dedicado "Activar/Desactivar" de la ficha del producto (el
`ConfirmDialog` que llama `PATCH /products/:id/activate|deactivate`) en
realidad SÍ funciona** — probado en navegador real activando y desactivando
`FILT-001` varias veces, con las llamadas de red devolviendo 200 y el estado
cambiando en la UI cada vez. No era ahí el bug.

**El bug real estaba en el formulario de edición** (`Editar` → tildar/destildar
"Producto activo" → "Guardar producto"), que es el camino más natural para
alguien que piensa en "activar/desactivar" como un campo del formulario, no
como un botón aparte. `ProductsService.update()` llamaba
`requireCategory(dto.categoryId, true)` / `requireBrand(dto.brandId, true)`
**cada vez que el body traía `categoryId`/`brandId`** — y el frontend los
manda siempre, en cada guardado, aunque no se estén cambiando. Si la
categoría o la marca del producto había sido desactivada después (encontré
exactamente este caso en los datos de prueba de la Fase 15: `Filtros de
aceite` y `Bosch` quedaron inactivos pero `FILT-001` activo), **cualquier
guardado del producto pasaba a fallar con 400 "Product category is invalid
or inactive"** — incluyendo el intento de reactivarlo desde el formulario,
que es exactamente "queda inactivo aunque se intenta activar".

**Corrección:** en `ProductsService.update()`, solo exigir que la categoría o
la marca estén activas cuando **de verdad se están reasignando** (`dto.categoryId
!== existing.categoryId`), no cuando el formulario reenvía la misma que ya
tenía. Coherente con la regla general del sistema de nunca invalidar una
referencia histórica por la desactivación de otra cosa.

**Archivos:** `services/ms-autorepuesto/src/products/products.service.ts`.
Test nuevo en `test/products.e2e-spec.ts`: desactiva la categoría y la marca
de un producto ya creado, confirma que igual se puede editar el nombre,
tildar/destildar `active` (incluido el mismo body que manda el formulario:
`categoryId`/`brandId` sin cambiar + `active`), y que el botón dedicado
`/activate`/`/deactivate` sigue funcionando — pero que reasignar a una
categoría *distinta* e inactiva sigue rechazándose.

**Verificado en navegador:** reproduje el 400 exacto editando `FILT-001` con
su categoría/marca inactivas, apliqué el fix, reinicié `ms-autorepuesto`, y
repetí el mismo flujo (destildar → guardar → volver a tildar → guardar):
ambos guardados funcionan y el estado queda correcto en la ficha. Reactivé
`Filtros de aceite` y `Bosch` al terminar para no dejar la categoría/marca de
un producto real inconsistente.

Técnica: `test/products.e2e-spec.ts` 10/10 (+1 nuevo) · suite completa de
`ms-autorepuesto` **126/126** (`--runInBand`, igual que el script oficial;
corrida en paralelo sin esa bandera muestra fallos de contención de conflictos
de transacción pre-existentes, no relacionados con este cambio).

### 2 — Cierre de cuenta abierta → cobrar

**Esto ya estaba construido de punta a punta** — lo verifiqué en el
navegador antes de tocar nada, para no duplicar trabajo:
- `SaleDetailPage` ya tiene, para una cuenta `DRAFT`: "Agregar productos"
  (bloqueado apenas se cierra), "Cerrar cuenta" (llama al mismo endpoint de
  confirmar venta — descuenta inventario, pasa a `POSTED`, ya no admite más
  líneas) y, una vez cerrada, "Cobrar".
- "Cobrar" abre `SalePaymentsPage`: método Efectivo (pide una sesión de caja
  **ABIERTA** del turno actual, calcula el cambio si el monto recibido es
  mayor) o Tarjeta; el saldo no cobrado queda como pendiente en la venta y,
  si es un cliente registrado, aparece solo en Cuentas por cobrar (ya
  existía, sin tocar).

Probé el flujo real: abrí una cuenta de prueba, la cerré (tuve que cargar
stock de prueba primero porque el producto de prueba no tenía existencia —
el backend correctamente rechazó el cierre con "Insufficient stock" hasta
que hubo stock), cobré en efectivo con monto recibido mayor al total, y
confirmé en Sesiones de caja que el efectivo entró al turno abierto
("Cobros de venta en efectivo" subió exactamente lo cobrado). Cuenta de
prueba cerrada/cobrada, sin dejar datos reales afectados.

**Lo único que agregué:** el diálogo de confirmar "Cerrar cuenta"/"Confirmar
venta" no mostraba el total — lo pedía explícitamente el prompt ("muestra
total final"). Ahora el texto del diálogo empieza con
`Total final: L XXX.XX.` antes de la descripción de qué hace el botón.

**Archivo:** `src/sales/SalesPages.tsx` (`SaleDetailPage`, texto del
`ConfirmDialog` de post/cancelar).

**Nota de datos:** durante esta verificación encontré una sesión de caja
("Low Cash") y una venta de mostrador (`Venta #39`) que quedaron abiertas/sin
cobrar de una sesión anterior — no las toqué, no me correspondía limpiar
datos que no generé yo mismo esta noche; quedan para que decidas si cerrarlas
antes de la demo. También hay dos métodos de pago con nombre mixto ("Card ·
Tarjeta", "Cash · Efectivo") en vez de los 3 originales
(Efectivo/Tarjeta/Transferencia) que la Fase 14 dejó anotado como wipeados —
ver [[phone-access-https-tunnel]] y la nota de "Ambos local DBs wiped" en la
memoria del proyecto. Te lo señalo por si querés que los renombre/reemplace
antes de la presentación; no lo hice porque no formaba parte de lo pedido
esta noche.

### 4 — Respuesta: ¿la cuenta abierta se guarda en tiempo real?

**No.** Confirmado leyendo el código: `SaleEditor` tiene una sola mutación
(`salesApi.update`/`.create`), que solo se dispara al presionar "Guardar
cuenta". Agregar productos mientras tanto solo cambia estado de React más un
borrador en `localStorage` (autoguardado local de la Fase 14.2, para
recuperarse de un cierre accidental de pestaña) — nada llega al servidor
hasta el guardado explícito. Un administrador **no puede** ver el avance de
una cuenta en otra pantalla/terminal mientras el vendedor sigue cargando
piezas sin guardar. Para eso haría falta guardado incremental al servidor
(cada línea) o un mecanismo de sondeo/tiempo real — un cambio de arquitectura
más grande, fuera del pedido concreto de esta noche; quedó documentado para
que decidas si lo priorizás en una próxima ronda.

### 3 — Rediseño de "Productos": tabla en vez de formulario repetido

**Antes:** cada línea de Ventas (mostrador/cliente/cuenta, un solo
`SaleEditor` compartido) y de Compras era un `<ProductSelector>` completo
(buscador + `<select>` + paginación) apilado uno debajo del otro por
producto, con Ubicación/Precio (o Costo) colapsados detrás de un
`<details>` por línea — funcional pero no la "tabla que crece con cada
escaneo, una fila por producto, con el total recalculándose abajo" que pedía
David.

**Diseño nuevo:**
- **Un solo buscador de "Agregar producto"**, fuera de la tabla, en vez de un
  `<ProductSelector>` repetido por línea. Escanear (cámara o lector físico) o
  elegir ahí agrega una fila a la tabla; el buscador queda listo para el
  siguiente producto.
- **Escanear/elegir el mismo producto de nuevo suma la cantidad en la fila
  existente en vez de crear una fila duplicada** — antes esto directamente
  fallaba al guardar ("solo puede aparecer una vez"), forzando a borrar la
  línea y sumar la cantidad a mano. Es una mejora real, no solo visual: la
  tabla se comporta como espera un vendedor escaneando varias unidades de la
  misma pieza.
- **Tabla real** (`<table>`, no una grilla de `<div>`): columnas Producto
  (código + nombre; la ubicación de origen queda como un detalle colapsado
  debajo, heredada de la línea anterior igual que antes — nunca se vuelve a
  pedir para un producto conocido salvo que haga falta cambiarla), Cantidad,
  Precio unitario (Compras: Costo unitario, precargado del costo de
  referencia) — ambos editables directamente, sin toggle, porque el pedido
  fue "solo se pide cantidad y, si hace falta, ajustar el precio" —,
  Descuento/Impuesto (sigue colapsado, sin cambios de comportamiento), Total
  por línea, y Quitar. Un `<tfoot>` con el Total general, recalculado en cada
  tecla.
- **Costo de referencia y margen siguen sin aparecer en la venta** — ya era
  así (la línea de venta nunca tuvo esos campos); no hizo falta ningún
  cambio ahí, solo confirmar que el rediseño no los introdujera.
- Validaciones que antes venían gratis de los `required` de HTML por línea
  (al menos un producto, ubicación elegida, precio/costo elegido) pasan a
  chequearse explícitamente en `submit()`, con el mismo texto de error de
  siempre.

**Archivos:** `src/sales/SalesPages.tsx` (tipo `Line` con `productCode`/
`productName`, `addScannedProduct` reescrito, tabla nueva), `src/purchasing/
PurchasePages.tsx` (mismo patrón, tipo `PurchaseLineForm`), CSS nuevo en
`global.css` (`.line-items-table` y afines). Tests reescritos para el nuevo
patrón de interacción (un buscador de agregar en vez de un selector por
línea) en `SaleEditor.test.tsx` y `PurchasingPages.test.tsx` — mismas
garantías que antes (precio sugerido puesto solo, descuento/impuesto
colapsado salvo que ya traiga un ajuste, ubicación heredada de la línea
anterior, foco en Cantidad) más un test nuevo por archivo para el
comportamiento de "escanear de nuevo suma cantidad".

**Verificado en navegador:** en Ventas (mostrador) y en Compras, agregué
`FILT-001` desde el buscador → aparece la fila con precio/costo precargado
→ lo agregué una segunda vez → la cantidad subió a 2 en la misma fila (no
se duplicó) → el total de la fila y el total general se recalcularon solos
→ "Guardar venta" guardó las 2 unidades correctamente. Venta de prueba
cancelada al terminar.

Técnica: `tsc -b` OK · `eslint` 0 warnings · `vitest` **183/183** (+2 nuevos,
netos tras reescribir 6 tests obsoletos) · `vite build` OK.

### Clientes: prefijo CLI, RTN de 14 dígitos, teléfono más largo

- **Código:** el formulario de cliente nuevo ahora precarga `CLI-` (antes
  vacío, con un ejemplo genérico "TALLER-PROGRESO" en el hint). Sigue siendo
  texto libre editable — no se fuerza por validación de backend, igual que
  ningún otro módulo de este sistema fuerza un prefijo de código — para no
  romper clientes ya cargados con otro esquema.
- **RTN:** antes era texto libre de hasta 40 caracteres. Ahora el campo
  limpia guiones/espacios mientras se escribe y limita a 14 dígitos
  (`inputMode="numeric"`); el backend (`CreateCustomerDto.taxId`) exige
  exactamente 14 dígitos numéricos cuando se manda un valor (sigue
  opcional). Actualicé el único test e2e que creaba un cliente con un RTN
  corto de prueba (`"0801"` → `"08011990123456"`).
- **Teléfono:** el límite de 40 caracteres no alcanzaba para un negocio que
  da dos números ("9999-9999 / 8888-8888") o uno con extensión. Subido a 60
  en el formulario, el DTO **y la columna real de PostgreSQL** — migración
  aditiva nueva `20260912022748_phase_14_customer_phone_length`
  (`VARCHAR(40)` → `VARCHAR(60)`, sin pérdida de datos). Solo se tocó
  Clientes, no Proveedores, que comparte el mismo límite pero no se pidió.

**Archivos:** `services/ms-autorepuesto/src/customers/dto/customer.dto.ts`,
`services/ms-autorepuesto/prisma/schema.prisma`, migración nueva,
`src/sales/CustomerPages.tsx`, `test/sales.e2e-spec.ts` (fixture de RTN).

**Verificado en navegador:** en "Nuevo cliente", el código ya trae `CLI-`;
escribiendo `0801-1990-12345-6` en RTN queda `08011990123456` (guiones
eliminados, 14 dígitos) solo.

Técnica: `tsc -b` OK · `eslint` 0 warnings (frontend y `ms-autorepuesto`) ·
`vitest` **183/183** · `vite build` OK · `nest build` OK · e2e
`ms-autorepuesto` **126/126** · e2e `api-gateway` **21/21** (sin cambios,
re-verificado por tocar un contrato compartido).

## Fase 17 — Rediseño de Ventas en tres columnas + principios de UX
## transversales (2026-09-12)

Prompt de David: encontró, probando en vivo y comparando contra Treinta, que
la pantalla de Ventas tiene un bug de estado cruzado entre modalidades y una
estructura de formulario único que no se explica sola. Pidió, en orden: (1)
el bug; (2) un cobro de un solo paso para Venta rápida (mostrador); (3)
reorganizar Ventas en tres columnas independientes; (4) aplicar en todo el
sistema paginación real de a 10, menos controles visibles por defecto, y cero
dependencia de texto de ayuda; más una revisión de Cajas/Sesiones de caja con
ese mismo criterio.

### 1 — Bug: estado cruzado entre modalidades de venta

**Causa real:** `SaleEditor` era un único componente para las tres
modalidades, con un solo estado `lines` compartido y un `<input type="radio">`
que solo cambiaba una variable `mode` — nunca vaciaba la tabla de productos
al cambiar de radio button. Cargar algo bajo "Cuenta abierta" y después tocar
"Venta rápida" dejaba la tabla intacta porque, para el código, seguía siendo
la misma sesión de edición.

**Corrección de raíz, no un parche:** en vez de vaciar el estado al detectar
un cambio de modo (lo que David pidió como mínimo, con una confirmación
antes), se eliminó el selector de modo por completo. Ahora **cada modalidad
es su propio componente con su propio estado** (`QuickSalePanel`,
`CustomerSalePanel`, `OpenAccountColumn` en el nuevo
`src/sales/SalesWorkspace.tsx`), montados los tres a la vez, lado a lado. No
existe ningún estado compartido que pueda "cruzarse" — la pregunta "¿hace
falta confirmar antes de perder lo cargado?" ya no aplica porque cambiar de
columna nunca toca las otras dos.

**Verificado en navegador:** cargué `FILT-001` en Mostrador → Cliente
registrado y Cuentas abiertas siguieron mostrando "Todavía no agregaste
ningún producto." Test de regresión nuevo (`SalesWorkspace.test.tsx`) cubre
exactamente este escenario.

### 2 — Venta rápida (mostrador): cobrar en un solo paso

Nuevo botón **"Cobrar y confirmar"** en la columna Mostrador que hace, en una
sola mutación encadenada, lo que antes eran tres pantallas: `POST /sales`
(crea) → `POST /sales/:id/post` (confirma, descuenta inventario) →
`POST /sales/:id/payments` (cobra). Método de pago y monto se eligen en la
misma columna:

- El **monto a cobrar se precarga con el total de la tabla** y se mantiene
  sincronizado mientras el vendedor no lo edite a mano (patrón de "estado
  derivado ajustado en el render", no en un efecto, siguiendo la guía oficial
  de React para evitar un render de más).
- Si el método es efectivo, aparecen **Sesión de caja ABIERTA** y **Monto
  recibido** (para el cambio) — ambos con auto-selección cuando hay una sola
  opción activa (ver más abajo).
- **Cuenta abierta y Cliente registrado a crédito no se tocaron** — siguen
  con el flujo de varios pasos (guardar borrador → confirmar → cobrar
  después) porque genuinamente quedan abiertas en el tiempo.
- Manejo de fallo parcial: si la venta se crea pero falla al confirmar o al
  cobrar, no se pierde el rastro — el mensaje de error dice que la venta #N
  quedó creada/confirmada y hay que completarla desde Ventas, en vez de un
  error genérico.
- Permisos: si al usuario le falta `sales.post` o `payments.create`, la
  columna cae a un simple "Guardar venta" (crear borrador, como antes) en vez
  de desaparecer la función.

**Auto-selección agregada a `PaymentMethodSelector` y `OpenCashSessionSelector`**
(`src/components/PurchasingSelectors.tsx`) reusando el hook
`useAutoSelectSoleOption` ya construido en la Fase 15 — un negocio con una
sola caja y un solo turno abierto no vuelve a elegir nada, coherente con el
mismo criterio ya aplicado a Ubicación y Proveedor.

**Verificado en navegador:** agregué `FILT-001`, el método "Cash · Efectivo"
disparó la sesión de caja auto-elegida, el monto ya traía `L 85.00`, y
"Cobrar y confirmar" mostró "Venta #144 lista — cobrada L 85.00. Podés seguir
con el próximo cliente." con la tabla vacía otra vez, lista para el
siguiente cliente. Venta de prueba conciliada al terminar (devolución del
producto + reingreso del pago, ver nota de datos más abajo).

### 3 — Ventas en tres columnas

`src/sales/SalesWorkspace.tsx` (nuevo) reemplaza el `SaleEditor` compartido.
La lógica de la tabla de productos (antes toda dentro de `SalesPages.tsx`) se
extrajo a `src/sales/SaleLineItems.tsx` como un hook (`useSaleLineItems`) y
un componente (`ProductLinesEditor`) reutilizados por las tres columnas —
para no repetir la tabla tres veces, no para volver a compartir estado.

- **Columna izquierda — Venta rápida (mostrador):** el flujo de un paso del
  punto 2.
- **Columna central — Cliente registrado:** buscador de cliente (obligatorio
  para esta columna) + tabla + "A crédito / notas" colapsado (fecha de
  vencimiento y notas, antes siempre visibles). Guarda como borrador y va al
  detalle, igual que antes.
- **Columna derecha — Cuentas abiertas:** reutiliza `OpenAccountsBar` (Fase
  14.2) — no se reconstruyó. Se le agregaron props `onSelect`/`onNew` para
  que, dentro del workspace, cambiar de pestaña actualice un parámetro de
  búsqueda (`?account=<id>`) **sin cambiar de ruta**, así las otras dos
  columnas nunca pierden lo que tenían cargado. Fuera del workspace (si
  alguien más la usara) sigue navegando como antes.
- **Compatibilidad de enlaces:** `/app/sales/:id/edit` (usado antes desde
  varios lugares) sigue existiendo como una redirección (`SaleEditRedirect`)
  hacia `/app/sales/new?account=<id>` o `?customerSale=<id>` según el tipo de
  venta, para no romper enlaces existentes. Los enlaces internos
  (`OpenAccountsBar`, `SaleDetailPage`, `PosPage`) se actualizaron para ir
  directo al esquema nuevo.
- **Detalle no trivial:** el lector físico USB/Bluetooth (`useKeyboardWedge`)
  escucha `keydown` en `window`, no en el elemento enfocado — con las tres
  columnas montadas a la vez, un mismo escaneo habría llegado a las tres
  simultáneamente. Se agregó una noción de "columna activa" (la última que
  recibió foco o clic) y cada columna solo arma su lector físico cuando es la
  activa. Mostrador es la activa por defecto al entrar. Cubierto con un test
  que dispara un escaneo simulado y confirma que solo llega a la columna
  correcta antes y después de cambiar el foco.

**Archivos:** `src/sales/SalesWorkspace.tsx` (nuevo), `src/sales/SaleLineItems.tsx`
(nuevo), `src/sales/SalesPages.tsx` (se le quita `SaleEditor`/`SaleFormPage`,
queda con la lista y el detalle), `src/components/OpenAccountsBar.tsx`
(props nuevas), `src/pos/PosPage.tsx` y `src/app/AppRoutes.tsx` (enlaces),
CSS `.sales-workspace` en `global.css`. Test nuevo
`src/sales/SalesWorkspace.test.tsx` (4 casos) reemplaza al viejo
`SaleEditor.test.tsx` (arquitectura de interacción distinta: un solo buscador
de "Agregar producto" por columna en vez de un selector por línea).

**Verificado en navegador:** las tres columnas conviven en una sola pantalla
sin ayuda contextual encima; guardé una cuenta abierta, la pestaña apareció,
"+ Nueva cuenta" volvió al formulario en blanco sin tocar Mostrador (que
seguía mostrando el mensaje de venta cobrada) ni Cliente registrado.

### 4a — Paginación real de a 10, en todo el sistema

`useUrlFilters` (usado por casi todas las pantallas de lista vía
`page`/`limit`, ya 100% servidor desde las Fases 10/11 — no había paginación
falsa en el cliente para corregir) tenía un límite por defecto de 20. Bajado
a **10**, y alineados a 10 todos los `limit: 20`/`PAGE_SIZE`/
`SELECTOR_PAGE_SIZE` sueltos que quedaban en selectores y sub-listas
(Proveedor, Método de pago, Sesión de caja, Producto/Ubicación de los
selectores compartidos, movimientos de caja, pagos, devoluciones, bandeja de
compras, etc.). Dos tests de paginación de detalle (`DetailPagination.test.tsx`)
tenían el tamaño de página escrito a mano y se actualizaron.

### 4b/4c — Menos controles visibles, cero texto de ayuda

Aplicado de lleno en el rediseño de Ventas (punto 3): la pantalla nueva no
lleva ningún párrafo explicando "cómo es esta venta" — el propósito de cada
columna lo dice el título de la columna. `documentDate` se dejó de mostrar en
las tres columnas (se sigue guardando, con hoy como valor implícito, o el
valor original si se está editando una cuenta/venta existente — nunca se
pisa a mano) porque nadie carga una venta que está pasando ahora con una
fecha distinta a hoy en el 90% de los casos. Mostrador además dejó de pedir
notas (no aporta en un cobro de mostrador de segundos). Cliente registrado y
Cuentas abiertas colapsaron vencimiento/cliente asociado/notas detrás de un
solo `<details>` "opcional".

**Alcance real de este punto:** no se hizo una auditoría exhaustiva de cada
pantalla del sistema esta noche — el tiempo se concentró en Ventas (el pedido
explícito) y en Cajas (pedido explícito, ver 5). El resto de los módulos
(Inventario, Productos, Compras, Clientes, Proveedores, Vehículos,
Administración) no se tocaron con este criterio. Si David quiere que se
aplique ahí también, es un buen alcance para una próxima ronda dedicada.

### 5 — Revisión de Cajas / Sesiones de caja

Encontré un problema real, no solo estético: **dos formularios distintos
para cerrar el turno, con distinto nivel de seguridad**. `PosPage` ("Cerrar
la caja", acceso rápido desde Punto de venta) cerraba la caja **al instante**
al enviar el formulario, sin ninguna confirmación — una acción que bloquea
toda venta/movimiento hasta abrir un turno nuevo. `CashSessionDetailPage`
("Cerrar sesión", en Cajas → Sesiones de caja → detalle) sí pedía confirmar
con un diálogo antes de cerrar. Dos caminos para la misma acción irreversible,
uno más peligroso que el otro, es exactamente el tipo de inconsistencia que
hace dudar a alguien nuevo ("¿esto cierra de una, o me van a preguntar?").

**Corrección:** `PosPage` ahora también pide confirmación
(`ConfirmDialog`, mismo patrón que el resto del sistema) antes de cerrar la
caja, con el mismo texto explicando la consecuencia ("ya no se pueden
registrar más movimientos ni ventas... hasta que se abra uno nuevo").

**Otras observaciones, sin cambios de código:** el color "tenue" de los
hints (`--muted`) es un teal desaturado del tema petróleo/latón — a primera
vista en una captura puede leerse como azul de enlace, pero no es un enlace
ni comparte el color real de `.table-link`; lo revisé de cerca y no es un
bug, es el tono del sistema de diseño. No encontré un "descuadre" numérico
real en la sección de cierre — los cálculos de efectivo esperado/diferencia
son siempre del servidor.

**Archivo:** `src/pos/PosPage.tsx`.

### Nota de datos importante: correr las suites e2e ensucia la base de
### desarrollo compartida

Verificando esta ronda encontré ventas de prueba (`#142`, `#143`) con saldo
pendiente en "Ventas por cobrar" de Punto de venta que **no las generé yo
manualmente** — vienen de correr las suites e2e de `ms-autorepuesto`
(`sales.e2e-spec.ts`, las de concurrencia, etc.) para verificar los cambios
de esta noche. `ConfigModule` del backend carga el `.env` de la raíz tanto en
producción como en los tests e2e — **no hay una base de datos separada para
tests**, así que cada corrida de `npm run test:e2e` escribe Ventas, Pagos,
Clientes, etc. reales en la misma Postgres que usa el navegador. Las reglas
del proyecto prohíben el borrado físico de historial, así que estos
registros de prueba se acumulan sesión tras sesión sin que ninguna suite los
limpie después.

No intenté rastrear ni limpiar corridas anteriores (impráctico y no era lo
pedido). Si te importa que la base quede prolija para una demo, lo más
simple es restaurar desde un backup limpio (`scripts/restore-local.sh`,
ver `backups/`) antes de mostrarla, o pedirme una limpieza dirigida de
`Sale`/`Payment`/`CashMovement` con prefijo de fecha de hoy.

**Venta #144 (mi propia prueba del cobro en un solo paso):** la dejé
conciliada — devolví el producto (stock de vuelta) y volví a registrar el
pago para que no quedara como pendiente de cobro — pero el rastro de auditoría
no es perfectamente limpio (pago → reversión → devolución → nuevo pago, todo
anotado en las notas). Preferí eso a dejarla visible como "Debe L85" en la
pantalla que ves todos los días.

Técnica: `tsc -b` OK · `eslint` 0 warnings · `vitest` **178/178** (reescribí
6 tests obsoletos de `SaleEditor.test.tsx` en `SalesWorkspace.test.tsx` con
4 casos nuevos, más 2 tests de paginación de detalle actualizados) ·
`vite build` OK.

## Estado al cierre de la Fase 17

- Todo commiteado en `redesign/producto-ux`, en commits pequeños por bloque.
  **Sin push** — a la espera de tu confirmación.
- **Pendiente de tu decisión:** limpieza de datos de prueba acumulados por
  las suites e2e en la base local (ver nota de arriba); si querés que
  "menos controles / cero ayuda" se aplique también al resto del sistema en
  una próxima ronda; el guardado en tiempo real de cuentas abiertas (Fase 16,
  punto 4) sigue pendiente si lo querés priorizar.
- Recorré vos mismo la pantalla de Ventas completa (las tres columnas, el
  cobro de un solo paso, las pestañas de cuentas abiertas) y el cierre de
  caja desde Punto de venta, antes de la presentación.

## Estado al cierre de la Fase 16

- **Todo commiteado en `redesign/producto-ux`**, en commits pequeños por
  bloque (uno por punto de esta fase) más este archivo. **Sin push** — a la
  espera de tu confirmación, mismo patrón que las rondas anteriores.
- **Migración nueva aplicada a la base local** (`phase_14_customer_phone_length`,
  aditiva, sin migraciones squash ni reset).
- **Pendiente de tu decisión** (no las toqué, no me correspondía sin que lo
  pidieras): la sesión de caja y la venta de mostrador sin cobrar que
  quedaron abiertas de una sesión anterior; los métodos de pago con nombre
  mixto en inglés/español; si querés que priorice el guardado en tiempo real
  de cuentas abiertas para que el administrador vea el avance (punto 4).
- Recorré vos mismo Ventas (las 3 modalidades) y Compras con la tabla nueva,
  y el ciclo completo cerrar cuenta → cobrar, antes de la presentación.

## Fase 18 — Cinco hallazgos de revisar Ventas y Punto de venta en vivo
## (2026-09-12)

David separó lo que encontró en dos partes: dos preguntas suyas que eran de
entendimiento (cómo se cobra en Mostrador, para qué es cada pantalla — ambas
ya funcionaban como se pidió, solo faltaba que la pantalla lo dijera) y cinco
cosas que sí eran bugs reales. Las cinco:

### 1 — Dos caminos para cobrar, uno solo corregido

**El bug:** el botón "Cobrar" de "Ventas por cobrar" en Punto de venta llevaba
a `/app/sales/:id/payments` (la pantalla vieja de pagos), cuyo campo Monto
arrancaba vacío — el mismo bug que ya se había corregido en "Cobrar y
confirmar" de Mostrador, pero en una implementación de código completamente
aparte que nunca recibió el arreglo.

**Corrección: un solo componente, no una copia arreglada.** Nuevo
`src/sales/SalePaymentFields.tsx`: un hook (`useSalePaymentFields`) que sabe
precargar el monto (del total de Mostrador o del saldo pendiente de la
pantalla vieja) y mantenerlo sincronizado salvo que el usuario lo edite a
mano, más un componente (`SalePaymentFieldset`) con método de pago + monto +
sesión de caja + monto recibido. Lo usan ahora **los dos lugares**:
`QuickSalePanel` (Mostrador) y `FinancialOperations` (la pantalla de
`/app/sales/:id/payments` y `/app/sales/returns/:id/refunds`, que comparten
el mismo componente desde antes). De regalo, el campo Monto del formulario de
reembolsos también quedó precargado con el reembolsable — mismo bug,
mismo arreglo, sin trabajo extra.

**Verificado en navegador:** entré a "Cobrar" de una venta pendiente real
(Venta #142, debía L 85.00) — el campo Monto ya traía "85" en vez de vacío.

### 2 — El cartel de "borrador sin guardar" decía "Operación completada"

**El bug:** en Cliente registrado y Cuentas abiertas, cuando hay un borrador
autoguardado de una sesión anterior, el aviso usaba `<FormFeedback
success="Hay cambios sin guardar de antes.">` — que renderiza el título fijo
"Operación completada" en estilo de éxito. Communicaba exactamente lo
contrario de lo que es: una alerta de recuperación, no una confirmación de
que algo salió bien. Era una regresión mía de esta misma noche, al mover este
aviso del `SaleEditor` viejo al nuevo `SalesWorkspace.tsx` lo simplifiqué mal.

**Corrección:** vuelve a usar `<Alert tone="warning" title="Hay cambios sin
guardar de antes">` con el párrafo explicativo, igual que el resto del
sistema para este mismo tipo de aviso.

**Verificado en navegador:** el cartel ahora aparece en ámbar/advertencia,
con el título correcto y el párrafo "Parece que se cerró la pestaña o hubo
un corte antes de guardar...".

### 3 — Pista corta en Mostrador

Se agregó una línea (`.sales-panel__hint`, chica, sin ser un párrafo de
ayuda) debajo del título de la columna: "Cargá todos los productos del
cliente y cobrá una sola vez al final con «Cobrar y confirmar»." Responde
justamente la pregunta que David tuvo que hacer.

### 4 — Ancho desperdiciado en pantallas operativas

**Diagnóstico correcto, causa distinta a la esperada.** Medí el layout real
en el navegador (no solo leí el CSS): `.page-stack` sin `grid-template-columns`
explícito ya estiraba sus paneles al 100% del contenedor — esa no era la
causa. La causa real: `.content` (el contenedor de toda página, en
`AppShell.tsx`) tenía `width: min(100rem, 100%)` — un tope de 1600px. En
cualquier monitor más ancho que eso (uno de 1920px, o el de David, de
2880px lógicos), el contenido queda centrado con una franja vacía real a los
costados — exactamente lo reportado, y no solo en Ventas: en **cualquier**
pantalla del sistema, porque `.content` envuelve todas.

**Corrección:** subido a `min(160rem, 100%)` (2560px) — sigue evitando que el
contenido se estire de forma absurda en un monitor ultra-wide, pero usa
mucho más del ancho real en cualquier pantalla normal o grande. Un cambio de
una línea en `global.css` que arregla el ancho **en todo el sistema a la
vez**, no pantalla por pantalla.

De paso, `.page-stack` quedó con `grid-template-columns: minmax(0, 1fr)`
explícito — no era la causa de este bug, pero es la práctica correcta para
que un hijo con contenido intrínsecamente ancho (una tabla larga, por
ejemplo) nunca fuerce un desborde en vez de usar su propio scroll interno.

**Verificado:** medido con `getBoundingClientRect()` en el navegador real
(no solo capturas de pantalla, que en este entorno de automatización no
reflejan el ancho real de la ventana): `.content` pasó de 1600px a 2560px de
ancho en una ventana de 2880px.

### 5 — Verificación: ¿una cuenta abierta suma a algún total antes de tiempo?

**No — verificado leyendo el código del backend, no solo probado a ojo.**
`CommercialService.summary()` (`services/ms-autorepuesto/src/commercial/commercial.service.ts`)
calcula "Vendido hoy" con
`WHERE "status" = 'POSTED' AND "documentDate" = businessDate` — una cuenta
abierta es una venta en estado `DRAFT`, así que queda afuera hasta que se
cierra. La misma función que arma Cuentas por cobrar (`receivableQuery`)
parte de `s."status" = 'POSTED'` también. El propio texto del panel del
Panel de inicio ya lo dice: "N ventas **confirmadas** hoy" — nunca cuenta
borradores. No hizo falta ningún cambio de código; quedó documentado acá
para que quede registrado que se verificó y no es un bug.

Técnica: `tsc -b` OK · `eslint` 0 warnings · `vitest` 178/178 (un test
actualizado por el cambio de label "Monto a cobrar" → "Monto" al unificar el
componente) · `vite build` OK.

## Estado al cierre de la Fase 18

- Todo commiteado en `redesign/producto-ux`, en commits pequeños por bloque.
  **Sin push** — a la espera de tu confirmación.
- Creé un cliente de prueba (`CLI-PRUEBA-001 · Cliente de Prueba`) para
  verificar la columna Cliente registrado de punta a punta (agregar
  producto, Guardar venta, queda como borrador #150) — cancelado al
  terminar, no queda en la base.
- Nada pendiente nuevo de esta ronda; los pendientes de las Fases 16/17
  (limpieza de datos de prueba de las suites e2e, guardado en tiempo real de
  cuentas abiertas) siguen igual.

## Fase 19 — Ventas: de tres columnas a tres pestañas (2026-09-12)

Cambio de layout pedido por David, no un bug: las computadoras del mostrador
tienen monitores angostos, y las tres columnas simultáneas de la Fase 17
(pensadas para una pantalla ancha) desperdiciaban espacio ahí — cada columna
terminaba comprimida. La instrucción fue explícita en que **no** es un
cambio de arquitectura de estado: las tres columnas ya eran tres drafts
totalmente independientes (Fase 17); esto es solo un cambio de qué tanto de
la pantalla ocupa cada una y cómo se navega entre ellas.

### El cambio

`SaleFormPage` (`apps/frontend/src/sales/SalesWorkspace.tsx`) ahora renderiza
una barra de pestañas (`role="tablist"`, `Venta rápida | Cliente registrado
| Cuentas abiertas`) seguida de un único área de contenido a ancho completo.
Los tres paneles (`QuickSalePanel`, `CustomerSalePanel`, `OpenAccountColumn`)
siguen **montados los tres, todo el tiempo** — la pestaña activa solo
controla cuál de las tres `<section>` no tiene el atributo `hidden`. Cambiar
de pestaña es puramente un cambio de vista: no se desmonta ni se reinicia
ningún componente, así que no hay forma de que perder productos cargados,
cliente elegido o cuenta activa sea siquiera posible — el estado de React
que lo sostiene nunca deja de existir.

Esto es una simplificación, no una construcción nueva: el estado
`activePanel` que decide qué panel arma la barra de pestañas es el mismo que
ya existía desde la Fase 17 para la lógica de "qué panel escucha al lector
de código de barras" (`scannerEnabled`/`active`). Antes ese estado decidía
además el estilo de foco visual entre tres columnas visibles a la vez; ahora
decide, con el mismo mecanismo, cuál sección lleva `hidden`. No hizo falta
tocar `SaleLineItems.tsx` ni la lógica de scanner-gating en absoluto.

Dentro de Cuentas abiertas, el selector de cuentas individuales
(`OpenAccountsBar`, las pestañas TOYOTA/CRV/+ Nueva cuenta) se dejó
exactamente como estaba — sigue siendo una sub-navegación de segundo nivel,
ahora simplemente dentro de una pestaña de primer nivel en lugar de dentro
de una columna.

### Totales y monto a cobrar, grandes y al final

Se agregó `.sale-totals-bar` (nueva franja al pie de cada uno de los tres
formularios, separada del resto por un borde superior) con el total en
`2.75rem`/peso 800 — antes el total solo aparecía chico, en el `<tfoot>` de
la tabla de productos, mezclado visualmente con las demás columnas. En
Venta rápida, el bloque de método de pago/monto a cobrar quedó dentro de
esta misma franja, justo antes del botón «Cobrar y confirmar» (también
agrandado, `.button--large`) — en vez de ser "un campo de formulario más"
entre otros. Cliente registrado y Cuentas abiertas no cobran en el momento,
pero también ganaron esta franja de total destacado antes de su botón
«Guardar», por consistencia visual entre las tres pestañas.

### Verificación

- `tsc -b`, `eslint --max-warnings=0`, `vite build`: los tres sin errores.
- `vitest`: reescribí los 4 tests de `SalesWorkspace.test.tsx` que asumían
  las tres columnas visibles a la vez (`within` sobre cada columna
  simultáneamente) al modelo de pestañas — ahora ubican cada panel por su
  `id` fijo (`sales-panel-mostrador/cliente/cuenta`, que no cambia estén o
  no ocultos) y usan `toBeInTheDocument()` en vez de `toBeVisible()` para
  aserciones sobre el contenido de una pestaña inactiva (correctamente no
  visible, pero debe seguir en el DOM). Sumé un test nuevo,
  específicamente para el requisito de "no reset al cambiar de pestaña":
  carga un producto en Mostrador, salta a Cliente y carga uno distinto,
  salta a Cuentas abiertas, vuelve a Mostrador y confirma que su línea
  sigue ahí, y que la de Cliente (todavía oculta) también. 179/179 en la
  suite completa.
- **Verificado en el navegador por mí mismo**, con el stack de desarrollo
  real (no la suite de tests): cargué `FILT-001` en Venta rápida (el total
  pasó a mostrarse grande, "L 85.00", con el monto a cobrar precargado),
  salté a Cliente registrado y cargué el mismo producto ahí también (línea
  y total propios, independientes), salté a Cuentas abiertas (con TOYOTA y
  CRV como sub-pestañas intactas), y volví a Venta rápida y a Cliente
  registrado en ese orden — ambos conservaban exactamente lo que tenían
  antes de saltar, sin ningún reseteo.

## Estado al cierre de la Fase 19

- Todo commiteado en `redesign/producto-ux`, en commits pequeños por bloque.
  **Sin push** — a la espera de tu confirmación.
- Nada pendiente nuevo de esta ronda.
- Siguiente paso, según lo conversado: revisar el módulo Dinero, que todavía
  no se validó en esta serie de rondas.

## Fase 20 — Dinero: método Transferencia y Resumen de solo lectura (2026-09-12)

Dos pedidos acotados sobre Dinero, el módulo que todavía no se había
revisado en esta serie.

### 1 — Método de pago "Transferencia" en Cuentas por pagar

**El código ya estaba bien** — no fue necesario tocar backend ni frontend.
`PaymentsService.resolveCash()` (`services/ms-autorepuesto/src/finance/payments.service.ts`)
ya exige `cashSessionId`/valida efectivo de la sesión únicamente cuando
`method.kind === 'CASH'`; para cualquier otro `kind` (incluido
`BANK_TRANSFER`) directamente rechaza que se mande `cashSessionId` o
`tenderedAmount`. Lo mismo del lado del frontend: tanto
`SalePaymentFieldset` (Ventas) como `PurchaseFinancePages.tsx` (Cuentas por
pagar) ya condicionan el campo de sesión de caja y el texto del diálogo de
confirmación ("Aumentará el efectivo esperado" / "No afectará efectivo
físico") exclusivamente a `method.kind === 'CASH'`.

**Lo que faltaba era el dato, no el código**: revisé la base de datos real
y el método "Transferencia" no existía — solo había dos métodos de prueba
dejados por una corrida de e2e (`CARD-1789178356225` / `CASH-1789178356225`,
el problema de contaminación de la base de dev por los tests, ya documentado
en rondas anteriores). Agregué el registro real: `PaymentMethod` con código
`TRANSFERENCIA`, nombre "Transferencia", `kind = BANK_TRANSFER`, activo.
Como `PaymentMethodSelector` no filtra por `kind`, ya aparece como tercera
opción en los selectores de método de pago de Ventas y Compras sin ningún
cambio de código.

### 2 — Resumen de Dinero (solo lectura)

Nueva pantalla en Dinero → **Resumen** (`/app/commercial/money-summary`),
con selector de rango de fechas (por defecto, hoy). Backend: un método
nuevo `CommercialService.moneySummary()` +
`GET /commercial/money-summary` (mismo permiso que el resumen del panel de
inicio, `commercial-summary.read`), agregado también al proxy del
api-gateway. Es una lectura agregada sobre `Payment` y `CashSession` que ya
existen — sin ninguna tabla, campo ni concepto contable nuevo.

**Un aviso que pediste explícitamente si aparecía, y apareció**: "Total
vendido hoy, desglosado por método de pago" tal como lo pediste **no se
puede calcular limpio** con lo que existe hoy. La razón: "Vendido hoy" en
este sistema (el mismo número que ya se muestra en el Panel de inicio) es
el total de una Venta confirmada (`Sale.total` con `status = POSTED` y
`documentDate = hoy`) — pero una Venta no tiene un único método de pago:
puede pagarse dividida entre efectivo y tarjeta, puede quedar total o
parcialmente a crédito (sin ningún pago todavía), y hasta puede cobrarse un
día distinto al de la venta. No hay forma honesta de repartir ese total
único entre métodos de pago sin inventar una regla arbitraria.

**Lo que sí se puede calcular limpio, y es lo que construí en su lugar**:
separé los pagos de venta (`Payment` con `type = SALE_PAYMENT`) en dos
grupos, usando la única distinción que el dato ya sostiene sin ambigüedad —
si la fecha del pago coincide con la fecha de la venta que salda, o es
posterior:
- **"Vendido y cobrado el mismo día"**: pagos cuya fecha coincide con la
  `documentDate` de la venta — el caso de mostrador, cobra en el momento.
- **"Cobrado de cuentas por cobrar"**: pagos de una fecha posterior a la
  venta que saldan — un abono contra un saldo que ya existía.

Ambos, desglosados por método de pago (esto sí es limpio: cada `Payment`
tiene exactamente un método). Igual para **"Pagado a proveedores"**
(`PURCHASE_PAYMENT`, por método, sin esta distinción porque no la pediste
para ese lado). Y **"Efectivo esperado por sesión de caja abierta"**: una
fila por cada `CashSession` con `status = OPEN`, con el mismo cálculo
(`movementDelta` sobre sus `CashMovement`) que ya usa
`CashSessionsService`/`CashLedgerService` para el cierre de caja — no es un
número nuevo, es el mismo, mostrado por sesión en vez de agregado. Esta
tabla no depende del rango de fechas elegido (es estado actual).

**Lo que esto significa para el control real del negocio**: hoy el sistema
sabe con certeza cuánto entró y de qué método, y cuánto efectivo debería
haber en cada caja — pero **no sabe "cuánto se vendió" como una cifra única
y repartible por método de pago**, porque una venta y su cobro son eventos
separados en el modelo de datos (correctamente, ya que así es como
funciona una cuenta por cobrar). Si en algún momento se quiere ese número
exacto iría a costa de una simplificación real del negocio (por ejemplo,
prohibir pagos divididos, o asumir que todo se cobra el mismo día) — no es
algo que se pueda resolver solo con una consulta distinta.

**Verificado en el navegador por mí mismo**: cargué el filtro con datos
reales de la sesión de trabajo de hoy — "Vendido y cobrado el mismo día"
mostró L 510.00 (Efectivo), "Cobrado de cuentas por cobrar" L 100.00
(Efectivo) — probé el rango de fechas ampliándolo hacia atrás (el total de
CxC subió a L 450.00 al incluir más abonos históricos) y luego a un rango
sin actividad (1–2 de enero de 2000), donde las tres tarjetas cayeron
correctamente a L 0.00 sin afectar la tabla de sesiones abiertas (que
mostró 2 sesiones con su efectivo esperado, ajeno al filtro). También
probé un rango inválido (desde > hasta) y el backend lo rechazó con el
mensaje correcto, propagado a la pantalla.

Técnica: `tsc -b`/`eslint`/build limpios en `ms-autorepuesto`,
`api-gateway` y frontend. `ms-autorepuesto`: 23 unit + 128 e2e (sumé un
caso a `commercial-finance.e2e-spec.ts` que crea una venta con
`documentDate` de hoy pagada hoy, y un abono hoy sobre una venta con
`documentDate` de hace más de un mes, y confirma por diferencia (antes/
después) que cada uno cae en el bucket correcto). `api-gateway`: sumé un
caso a `gateway.e2e-spec.ts` confirmando que reenvía `dateFrom`/`dateTo` tal
cual al upstream. Frontend: `MoneySummaryPage.test.tsx` nuevo (4 casos:
datos completos, sin sesiones abiertas, cambio de rango dispara la query
con los parámetros correctos, error con reintento) — 183/183 en la suite
completa.

## Estado al cierre de la Fase 20

- Todo commiteado en `redesign/producto-ux`, en commits pequeños por bloque.
  **Sin push** — a la espera de tu confirmación.
- Dato agregado a la base de datos de desarrollo (el `PaymentMethod`
  "Transferencia"): no es un cambio de código, así que no está en ningún
  commit — si se recrea la base de datos desde cero, hay que volver a
  crearlo (a mano, o vía un futuro script de datos iniciales, que todavía
  no existe para este módulo).
- Pendiente para vos, no para mí: decidir si "vendido hoy desglosado por
  método de pago" tal como se pidió originalmente amerita simplificar
  alguna regla de negocio (por ejemplo, no permitir pagos divididos en
  Venta rápida), o si la vista con la distinción "mismo día / cuentas por
  cobrar" que construí ya resuelve lo que necesitás ver día a día.

## Fase 21 — Dinero → Resumen: de tarjetas a pestañas (2026-09-12)

Rediseño visual pedido por David, reutilizando explícitamente el patrón de
pestañas de Ventas (Fase 19) en vez de construir uno nuevo — las tres
tarjetas chicas y apretadas de la Fase 20 se sentían con poco espacio para
un desglose que David quería ver con más claridad.

### El componente de pestañas ahora es compartido

Extraje el patrón de pestañas de `SalesWorkspace.tsx` a
`apps/frontend/src/components/WorkspaceTabs.tsx` — dos piezas, `TabBar`
(la fila de pestañas) y `TabPanel` (una sección que se muestra u oculta
con el atributo `hidden`, nunca desmontada). `SalesWorkspace.tsx` se migró
a este componente compartido sin ningún cambio de comportamiento — los 5
tests de `SalesWorkspace.test.tsx` pasan sin tocarlos, prueba de que la
extracción fue mecánica. La clase CSS que envuelve el contenido a ancho
completo se renombró de `.sales-workspace` (específica de Ventas) a
`.workspace-tab-content` (genérica), ya usada ahora por ambas pantallas.

### Dinero → Resumen, con cuatro pestañas

`MoneySummaryPage.tsx` pasó de "tres tarjetas + una tabla apretada al
final" a cuatro pestañas de ancho completo, con `TabBar`/`TabPanel`:

1. Vendido y cobrado el mismo día
2. Cobrado de cuentas por cobrar
3. Pagado a proveedores
4. Efectivo esperado por caja abierta

Las tres primeras mantienen su **propio** selector Desde/Hasta —
independiente entre sí, no uno compartido arriba de todas. Cada una guarda
su rango en la URL bajo un prefijo propio (`sameDayFrom`/`sameDayTo`,
`receivablesFrom`/`receivablesTo`, `purchasesFrom`/`purchasesTo`), así que
cambiar de pestaña nunca resetea el filtro de las otras dos — exactamente
la misma razón por la que Ventas mantiene sus tres pestañas montadas todo
el tiempo. El desglose por método de pago ahora se muestra con el mismo
patrón de "total grande" que ya usa Venta rápida (`.sale-totals-bar`,
reutilizado tal cual) seguido de una tabla Método/Monto a ancho completo,
en vez de una lista chica dentro de una tarjeta.

La cuarta pestaña (Efectivo esperado) no tiene selector de fechas — es
estado actual, como ya aclaraba el texto debajo del título — y ahora tiene
su propia pestaña a ancho completo en vez de aparecer apretada al pie de
la página.

### Verificación

- `tsc -b`, `eslint --max-warnings=0`, `vite build`: sin errores.
- Reescribí `MoneySummaryPage.test.tsx` para el modelo de 4 pestañas (5
  casos: la primera pestaña activa por defecto con las otras tres montadas
  pero ocultas, cambiar de pestaña no resetea el filtro de fecha de otra,
  la cuarta pestaña no tiene selector de fechas y muestra las cajas
  abiertas, sin cajas abiertas, y error con reintento por pestaña). 184/184
  en la suite completa del frontend.
- **Verificado en el navegador por mí mismo**: puse `Desde = 01/01/2020`
  en "Vendido y cobrado el mismo día" (el total pasó a incluir todo el
  historial), salté a "Cobrado de cuentas por cobrar" (su Desde seguía
  vacío, sin ningún efecto del filtro de la otra pestaña), salté a
  "Efectivo esperado por caja abierta" (sin selector de fechas, tabla a
  ancho completo con las 2 sesiones abiertas), y volví a "Vendido y
  cobrado el mismo día" — su `Desde = 01/01/2020` seguía exactamente donde
  lo dejé.

## Estado al cierre de la Fase 21

- Todo commiteado en `redesign/producto-ux`, en un commit por bloque.
  **Sin push** — a la espera de tu confirmación.
- Nada pendiente nuevo de esta ronda. Con esto, Dinero queda cerrado tanto
  en lógica (Fase 20) como en presentación (Fase 21).
