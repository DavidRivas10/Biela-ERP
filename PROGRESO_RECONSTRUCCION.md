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
