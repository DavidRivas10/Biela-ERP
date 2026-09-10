# Reconstrucción total UX — BIELA ERP

Estado vivo del trabajo. **Una sesión que retoma esto lee este archivo primero** y sigue
desde "Siguiente" sin repetir lo ya marcado como hecho.

- Rama: `redesign/producto-ux`
- Fuente de verdad del problema: el documento de recorrido de David (pantalla por pantalla).
- Autorización: control total y continuo, sin pausas de aprobación por módulo.

---

## Principio rector (aplica a TODO)

**X1 — Nada se explica con texto de ayuda como sustituto de estructura.** El nombre de
cada botón, cada columna, cada grupo de campos comunica por sí mismo. `HelpNote` se
elimina de cada módulo al reconstruirlo; el componente se borra cuando cae el último uso.
Texto de ayuda solo como complemento puntual (placeholder, una línea bajo un campo), nunca
como la solución principal.

---

## Decisiones de arquitectura (tomadas, no sujetas a aprobación — corregibles al ver pantallas)

### D1 — Nueva arquitectura de información (menú lateral)

| Grupo | Ítems | Nota |
|---|---|---|
| **Inicio** | Panel general | Centro de mando, no página informativa |
| **Vender** | Punto de venta · Ventas · Clientes | "Punto de venta" = vista dedicada de quien cobra |
| **Comprar** | Compras · Proveedores · Recepción de facturas | "Recepción" = bandeja del administrador (AD1) |
| **Dinero** | Cuentas por cobrar · Cuentas por pagar · Cajas · Sesiones · Movimientos | |
| **Catálogo** | Productos · Vehículos · Compatibilidad | Solo lo operativo del catálogo |
| **Almacén** | Inventario | |
| **Mantenimientos** | Categorías · Marcas de producto · Atributos · Marcas de vehículo · Modelos de vehículo · Ubicaciones | Idea de David (MN1). Todo lo que alimenta selects. Carpeta con landing propia. |
| **Administración** | Usuarios · Roles | |

- Rutas nuevas `/app/mantenimientos/*` con landing `/app/mantenimientos` (la "carpeta").
  Rutas viejas (`/app/catalog/categories`, etc.) quedan como redirect.
- `/app/pos` = Punto de venta (CJ3). Separado de `/app/cash/*` (concepto contable).

### D2 — Ciclo de compra (CO2)
Pasos diferenciados y nombrados, no un formulario ambiguo:
1. **Pedido a proveedor** (qué le pido) → opcional, se puede omitir en compra directa.
2. **Recepción de mercadería** (qué llegó físicamente) → mueve inventario.
3. **Factura del proveedor** (el documento que cobra) → genera la cuenta por pagar.
La pantalla "Nueva compra" se parte en estos actos con lenguaje llano.

### D3 — Ventas (V9)
Se rediseña alrededor del acto de vender: elegir/crear cliente → agregar productos
(scanner o búsqueda con resultados claros) → cobrar. El selector de tipo de venta se
reemplaza por una decisión explicada en palabras ("¿Cobra ahora o queda a crédito?").

### D4 — Estados vacíos
`EmptyState` distingue "no hay nada cargado todavía" de "tu búsqueda no encontró nada"
(mensaje con el término buscado). Nunca una pantalla que parece rota (P1, AL4).

### D5 — Filtros sin opciones muertas (P2)
Los selects de filtro (marca, categoría, etc.) solo listan valores que tienen registros
reales asociados. Requiere soporte del backend (conteos) — se implementa por módulo.

### D6 — Reglas de datos reales
- Cambios de esquema: snapshot antes → aplicar → comparar. Mongo `biela_users`,
  Postgres `biela_autorepuesto`.
- No borrado físico de registros referenciados por venta/compra/movimiento: desactivar.
- Autorización sigue por permiso, no por nombre de rol.
- **Este incremento (fundamentos) es solo frontend: sin riesgo de datos.**

---

## Orden de trabajo

1. **Fundamentos** — IA/menú, carpeta Mantenimientos, Inicio, `EmptyState`. ✅
2. **Catálogo → Productos (P1–P4) + Mantenimientos de producto (M1–M2)** ✅
   (P4 pendiente E2E en teléfono)
3. **Vehículos (VH1–VH3) + Mantenimientos de vehículo** ✅
4. **Almacén / Inventario (AL1–AL4) + Ubicaciones (UB1–UB2)** ✅
5. **Clientes (C1–C2)** ✅
6. **Ventas (V1–V9)** ✅
7. **Punto de venta (CJ1–CJ3)** ✅
8. **Compras (CO1–CO2) + Recepción de facturas (AD1)** ✅
9. **Proveedores (PR1–PR3)** ✅
10. **Cuentas por cobrar / por pagar (F1–F4)** ✅
11. **Usuarios / Roles (US1)** ✅
12. **Pase final de verificación (Z1–Z5)** ✅ (P4 = escáner en móvil real: pendiente de David)

---

## Checklist contra cada queja de David

Leyenda: ⬜ pendiente · 🟨 en curso · ✅ hecho y verificado en navegador

### Inicio
- 🟨 I1 — Panel general deja de ser "una cabecita", se siente centro de mando
  (primer pase: acciones directas + métricas con enlace; falta densidad real
  cuando aterricen los módulos)
- 🟨 I2 — Tarjetas ventas/caja/CxC/CxP: ahora con etiqueta llana ("Te deben",
  "Debes") + enlace de acción. Revisar cifras/plural al reconstruir Dinero.
- 🟨 I3 — "Accesos rápidos" vagos reemplazados por "Qué puedes hacer ahora"
  (acciones con verbo, filtradas por permiso)
- ✅ I4 — Bloque "Estado técnico de la plataforma / API Gateway" eliminado del
  Inicio (se quitó también la consulta a `/api/system/health`)

### Ventas
- ✅ V1/V2 — "buscar cliente / buscar producto": los selectores ya responden
  (línea de estado, auto-selección por código, confirmación de lo elegido —
  arreglado en módulos 4–5). En la lista de ventas los filtros de cliente/
  producto se llaman "Cliente registrado" / "Producto vendido" con opción
  "Cualquiera".
- ✅ V3/V9 — La lista de Ventas ya no abre como un formulario de búsqueda: los
  6 filtros están plegados en `▸ Buscar o filtrar ventas` y la tabla se ve de
  una. Descripción llana de qué es la pantalla. Botones "Registrar una venta" /
  "Abrir una cuenta" arriba.
- ✅ V4/V7 — "no sé a qué cliente le va a vender / si Taller El Progreso ya
  compró": columna **"Para quién"** ahora dice en dos líneas quién y de qué tipo
  ("Taller El Progreso" / "Cliente registrado · CLI-001"; "Mostrador" / "Sin
  cliente"; etiqueta / "Cuenta abierta").
- ✅ V5 — Estados vacíos claros: si hay filtros → "Ninguna venta coincide" +
  quitar filtros; si no → "Todavía no registraste ventas" + "Registrar la
  primera venta" con un renglón que explica el flujo.
- ✅ V6 — Sin jerga: filtro de Estado con "Borrador (empezada, sin confirmar) /
  Confirmada (ya descontó inventario) / Cancelada"; badge "Confirmada" en vez de
  "Registrado/POSTED". "Número" → "Número de venta" con ejemplo. Columnas
  "Venta N.º", "Para quién", "Vence el pago", "N productos".
- ✅ V8 — El selector de tipo de venta se replanteó: la pregunta pasó de "¿Para
  quién es?" a **"¿Cómo es esta venta?"**, y las tres opciones se nombran por la
  situación real: "Venta rápida (mostrador)", "A un cliente registrado",
  "Cuenta abierta" — cada una con una frase que dice qué significa (incl. qué es
  y para qué sirve "abrir cuenta"). "Postear venta" → "Confirmar venta".
- ✅ (extra) `HelpNote` de "Cuenta abierta" en la ficha de venta → renglón de
  próximo paso. Deep-link `?customerId=` desde Clientes abre la venta ya en modo
  "cliente" con ese cliente. Textos "atómico / verdad histórica / postear"
  reescritos en palabras.

### Clientes
- ✅ C1 — "no sé si es crear un código de cliente": el form ahora abre con
  **Nombre** (placeholder "Taller El Progreso"), luego **Código** con nota
  "Identificador corto y único para encontrarlo rápido… si no usás códigos, algo
  simple sirve". La descripción dice qué es un cliente registrado (guarda datos,
  historial y estado de cuenta). Razón social con nota de cuándo usarla.
- ✅ C2 — Crear vs vender, separado y con puente explícito:
  - Descripción (lista, form y detalle): "Registrás un cliente cuando le vas a
    fiar (venta a crédito) o querés llevar su historial y su estado de cuenta.
    Para una venta de mostrador que se paga en el momento, no hace falta."
  - Columna **"Ventas"** por cliente ("2 ventas" / "Sin ventas aún") — backend
    `_count.sales` aditivo.
  - Acción **"Vender a este cliente"** en cada fila → `/app/sales/new?customerId=`.
  - Botón **"Registrar una venta"** en la ficha del cliente.
  - Ficha: métricas "Te debe / Vencido / Ventas"; columna "Liquidación" →
    "Estado del pago".
  - `CustomerSelector` (en el form de venta): sin jerga, con línea de estado que
    aclara "dejalo vacío para venta de mostrador" / "no hay cliente registrado
    con «X»"; `emptyLabel` → "Sin cliente (venta de mostrador)".

### Compras
- ✅ CO1 — "no sé si es producto o la factura": la pantalla "Registrar una
  factura de proveedor" lo dice en la descripción ("cargá la factura o remisión
  que te manda el proveedor: su número, la fecha y los productos que trae"), el
  campo se llama "Número de la factura o remisión", y la sección de líneas es
  "Productos que trae la factura". La recepción es una pantalla aparte
  ("Recibir la mercadería · marcá cuánto llegó y a qué ubicación").
- ✅ CO2 — El ciclo se ve como una tira de pasos (`PurchaseChain`, reusa
  `.chain-nav` del módulo 3) en la lista, el form y la ficha:
  **1. Registrar la factura › 2. Confirmar › 3. Recibir la mercadería › 4. Pagar**,
  con el paso actual resaltado según el estado. Estados sin jerga en el filtro
  ("Borrador (sin confirmar) / Confirmada (falta recibir) / Recibida en parte /
  …"). Botones de la ficha: "Recibir mercadería", "Pagar" (antes "Recibir",
  "Pagos"). Textos "Inventory IN", "avanzará a CONFIRMED", "liquidación",
  "derivados por el backend" reescritos en palabras.

### Administrador que recibe facturas
- ✅ AD1 — **Nueva pantalla `/app/purchasing/inbox` "Recepción de facturas"**
  (`src/purchasing/PurchaseInboxPage.tsx`), entrada de menú propia en el grupo
  "Comprar" (`anyPermission: purchases.receive | purchases.pay`). Bandeja del
  administrador: tres bloques con la acción directa en cada fila —
  **Por confirmar** (compras DRAFT → "Revisar y confirmar"),
  **Esperando mercadería** (CONFIRMED/parcial → "Recibir mercadería"),
  **Por pagar** (payables con saldo → "Pagar"). Cada bloque con su estado vacío.

### Proveedores
- ✅ PR1 — `HelpNote` eliminado de `SupplierPages` (import fuera).
- ✅ PR2/PR3 — Propósito evidente por estructura:
  - Descripción llana ("A quién le comprás mercadería. Cada proveedor guarda
    sus datos, tu historial de compras y cuánto le debés…").
  - Columna **"Compras"** por proveedor ("1 compra" / "Sin compras aún") —
    backend `_count.purchases` aditivo.
  - Acción por fila **"Registrar una factura"** → `/app/purchasing/purchases/new
    ?supplierId=` (el form de compra ahora honra ese parámetro).
  - Ficha: métricas "Le debés / Vencido / Compras / A tu favor" (antes 12 spans
    con jerga "Compra bruta / Obligación neta / Crédito proveedor…"); columna
    "Liquidación" → "Estado del pago"; "Obligación neta" → "A pagar"; botón
    "Registrar una factura" arriba.
  - Form: Razón social primero, Código segundo con nota (paralelo a C1);
    "Contacto" → "Persona de contacto".
  - Buscador relabelado, "Aplicar" → "Buscar", estados "Activos e inactivos /
    Solo activos / Solo inactivos (ocultos)", estado vacío neutral vs búsqueda.

### Cuentas por cobrar / pagar
- ✅ F1 — "no sé qué son": la descripción lo dice en una línea ("Lo que tus
  clientes te deben" / "Lo que le debés a tus proveedores: compras confirmadas
  que todavía no pagaste por completo"). `HelpNote` eliminado — era el **último
  uso**, así que se borró `components/HelpNote.tsx`.
- ✅ F2 — "no sé qué es pendiente / vencido / fecha operativa": "Pendiente" →
  **"Te debe" / "Le debés"** con la fórmula explicada en la descripción; el
  badge de vencimiento dice **"Vencida hace N días"** (antes "Vencida · N días");
  "Fecha operativa" → renglón muted **"Datos al {fecha}."**.
- ✅ F3 — "no entiendo todos esos números": el resumen pasó de **12 spans** con
  jerga (Compra bruta / Obligación neta / Crédito proveedor / Reembolsado / …) a
  **3 tarjetas**: "Te deben en total / Vencido (+ N atrasadas) / Ventas con
  saldo" (y equivalentes en CxP). Filtros plegados en `▸ Buscar o filtrar`.
- ✅ F4 — herramienta financiera por diseño visual: columnas = **quién**
  (cliente/proveedor en negrita), **documento origen** (#N + fecha, enlace),
  **cuánto** ("Te debe" enfatizado, "de {total}"), **desde cuándo** (fecha +
  badge rojo si vencida), **estado del pago** (badge Sin pagar / Pago parcial /
  Pagada), **acción** (botón "Cobrar" / "Pagar" directo a la pantalla de pago).
  Las filas vencidas van **tintadas de rojo con borde izquierdo** (nuevo
  `rowClassName` en `ErpTable` + `.erp-row--overdue`). Filtros sin jerga
  ("Liquidación" → "Estado del pago"; opciones en palabras).
- ✅ (X1 completo) `HelpNote` ya no existe en toda la app.

### Catálogo — Productos
- ✅ P1 — Búsqueda sin resultados: `EmptyState tone="search"` nombra el término
  y los filtros aplicados ("No hay ningún producto con el texto «ZZZ999», de la
  marca "Bosch"…") + botones para quitar cada filtro y "Ver todos los productos".
- ✅ P2 — Filtros de categoría/marca muestran el conteo real ("Bosch (2)") y
  ocultan opciones con 0 productos (la seleccionada se mantiene). Backend:
  `_count` agregado a `listCategories/listBrands` (aditivo, sin esquema).
  Pendiente opcional: co-filtrado estricto categoría↔marca (endpoint de facetas).
- ✅ P3 — Filtro "Estado": "Activos e inactivos / Solo activos / Solo inactivos
  (ocultos)" + hint bajo el campo + `title` en el badge explicando que inactivo
  = sigue en historial pero no aparece para vender/comprar.
- 🟨 P4 — Botón "Cámara" + lector físico (keyboard wedge) presentes y cableados
  en el form de producto. **Falta E2E real en teléfono** (cámara + getUserMedia;
  no se puede validar desde esta sesión automatizada). Anotado para el pase Z1.

### Mantenimientos de catálogo (Categorías/Marcas/Atributos)
- ✅ M1 — `HelpNote` eliminado de las 3 pantallas. Descripción de una línea
  estructural. Columnas nuevas que muestran uso real: Categorías → "Productos" +
  "Atributos"; Marcas → "Productos"; Atributos → "En uso". Jerga fuera:
  "STRING/NUMBER/BOOLEAN" → "Texto/Número/Sí·No"; "Requerido" → "Obligatorio".
  Botón "Nuevo registro" → "Nueva categoría / Nueva marca / Nuevo atributo".
  Estados vacíos con texto claro. Eyebrow "Catálogo" → "Mantenimientos".
- ✅ M2 — Ya no están sueltos en el menú: una sola entrada "Mantenimientos"
  → hub con tarjetas. Rutas viejas redirigen a `/app/mantenimientos/*`.

### Vehículos
- ✅ VH1 — "no entiendo nuevo vehículo": la pantalla y el form dicen en una línea
  qué es ("una combinación exacta de marca, modelo, año y motor; con él marcás
  qué repuestos le quedan en Compatibilidad"). Estados vacíos explican el
  prerrequisito (marca + modelo cargados).
- ✅ VH2 — "selecciono la marca pero no sé de dónde viene": el campo Marca del
  form tiene la nota "Sale de tu lista de Marcas de vehículo. Si falta una,
  agregala ahí primero." con enlace. El campo Modelo se deshabilita hasta elegir
  marca ("Elegí una marca primero") y avisa si esa marca no tiene modelos.
  Se aclara "Motor" (tipo/cilindrada) vs "Número de motor" (grabado en bloque).
- ✅ VH3 — La cadena **Marca › Modelo › Vehículo › Compatibilidad** aparece como
  una tira de navegación ordenada (`components`… `VehicleChain`) en las 4
  pantallas (Marcas, Modelos, lista de Vehículos y form). Es navegación con
  enlaces reales + subtítulo de cada paso, no un párrafo de ayuda. Columnas de
  uso: Marcas→"Modelos", Modelos→"Vehículos", Vehículos→"Repuestos compatibles"
  (backend: `_count` aditivo en `listBrands/listModels/vehicleInclude`).

### Mantenimientos (idea de David)
- ✅ MN1 — Sección "Mantenimientos" creada: nav propio, landing `/app/mantenimientos`
  con los 6 catálogos agrupados (Productos / Vehículos / Almacén), cada uno
  editable e inactivable (ya lo eran). Separada de los módulos de operación
  diaria. Interiores de cada catálogo se pulen en módulos 2–4.

### Almacén / Inventario
- ✅ AL1/AL4 — El buscador de producto (y de ubicación) ya no queda mudo:
  línea de estado bajo el input — "Buscando…" / "N coincidencias" / **en rojo**
  "No se encontró ningún producto con «X». Revisá el código." Además, si tecleás
  el **código exacto** se selecciona solo, y lo elegido se confirma abajo
  ("Elegido: PRO-001 · …"). Cambio en `components/EntitySelectors.tsx`
  (afecta a inventario, movimientos, transferencias y donde más se use).
- ✅ AL2 — Mismo arreglo para "Buscar ubicación" + placeholder "Ej.: BOD-01 o
  «bodega»".
- ✅ AL3 — Formularios sin jerga: la línea "INITIAL, IN y ADJUSTMENT usan
  ubicación destino; OUT usa ubicación origen. El backend valida el saldo." se
  reemplazó por una explicación que cambia según el tipo elegido (qué es
  "Inicial", "Entrada", "Salida", "Ajuste" en palabras). Descripciones de
  Inventario / Movimientos / Transferencias reescritas sin "autoritativo",
  "atómico", "optimista", "mutación".
- ✅ (extra) Estados vacíos de Inventario: neutral ("Todavía no hay inventario
  cargado… empezá en Movimientos") vs búsqueda ("Ningún saldo coincide" +
  quitar filtros). Filtro de existencia: "Con y sin stock / Solo con stock /
  Solo en cero".

### Ubicaciones
- ✅ UB1/UB2 — `HelpNote` "Cómo llenarlo" fuera. La pantalla se explica sola:
  descripción "El lugar físico de tu bodega o mostrador donde está guardada una
  pieza. Le ponés un código corto (BOD-01, MOS-01) y lo usás en el inventario
  para saber dónde buscarla." + **columna "Productos aquí"** (BOD-01 → "6
  productos", MOS-01 → "Vacía") que hace tangible para qué sirve. Campos Código
  y Nombre con hint puntual de qué va en cada uno. Estado vacío que dice por qué
  crear la primera. eyebrow "Almacén" → "Mantenimientos". Backend: `_count`
  aditivo en `locations.findAll`.

### Cajas / Sesiones
- ✅ CJ3 — **Nueva pantalla `/app/pos` "Punto de venta"** (`src/pos/PosPage.tsx`),
  entrada de menú propia en el grupo "Vender", separada de la administración de
  cajas. Para quien cobra: elegís tu caja (se recuerda en localStorage), abrís
  el turno con el efectivo inicial, ves el efectivo esperado, y desde ahí:
  lista de **"Ventas por cobrar"** con botón "Cobrar" directo a la pantalla de
  pago; lista de **"Cuentas abiertas"**; botón "Nueva venta rápida"; y "Cerrar
  la caja" contando el efectivo, todo en un solo lugar.
- ✅ CJ1 — Esa pantalla ES la vista dedicada de quien vende/cobra; ya no tiene
  que entender la administración de cajas para trabajar.
- ✅ CJ2 — "no sé qué son sesiones": el POS lo explica en una frase ("Una sesión
  de caja es tu turno: la abrís contando el efectivo inicial y la cerrás
  contándolo al final. El sistema te dice si cuadra."). La pantalla de
  administración pasó a llamarse **"Sesiones de caja (turnos)"** con descripción
  llana; se reescribieron sin jerga las descripciones de Cajas, Movimientos de
  efectivo y los textos de apertura/cierre ("ledger inmutable", "paginado por el
  servidor", "una sola sesión abierta por caja" → palabras).

### Usuarios / Roles
- ✅ US1 — "se ve desordenado": `AdminPages.tsx` reescrito legible y con
  jerarquía. Formulario de **usuario** en dos secciones con título:
  `[ Datos de la persona ]` (nombre/apellido/correo/contraseña) y
  `[ ¿Qué puede hacer? (roles) ]`. `RoleSelector` pasó de un grid mono a
  checkboxes con **nombre + descripción** por rol. Formulario de **rol** en
  `[ Datos del rol ]` + `[ Permisos · N de 54 marcados ]` con **contador vivo**
  en el título; cada permiso muestra el nombre en español + una línea de qué
  hace, y el **código técnico se movió a un tooltip** (ya no ensucia cada
  renglón) — salvo en la ficha del rol, donde se mantiene visible (traza).
  Sin jerga: "Activo/Inactivo" de usuario → **"Puede entrar" / "Sin acceso"**;
  "Desactivar" → "Quitar acceso"; descripciones reescritas
  ("administradas por el servicio de usuarios", "emitidos por el backend"…).
  Estados vacíos accionables en ambas listas.

### Administrador que recibe facturas
- ⬜ AD1 — Experiencia dedicada (no solo acceso por permiso)

### Verificación final
- ⬜ Z1 — Recorrido como usuario sin conocimiento previo, pantalla por pantalla
- ⬜ Z2 — Cada queja verificada una por una
- ⬜ Z3 — tests / build / regresión de datos reales
- ⬜ Z4 — Capturas de navegador (en `docs/reconstruccion-ux/evidencia/`)
- ⬜ Z5 — Pendientes documentados

---

## Bitácora de sesiones

### Sesión 1 — 2026-09-08
- Diagnóstico previo (no parte de la reconstrucción): login "servicio no disponible" =
  CORS por `127.0.0.1` vs `localhost` en `CORS_ORIGINS`. **No tocado.** Para verificar
  en navegador se entra por `http://localhost:5173` (origin sí permitido).
- Mapeo completo del frontend (React 19 + Vite + React Query + RR7; backend NestJS
  microservicios: api-gateway 4000, ms-users 4001, ms-autorepuesto 4002).
- **Bloque 1 (Fundamentos) — hecho y verificado en navegador:**
  - `navigation.ts`: nueva IA (Inicio / Vender / Comprar / Dinero / Catálogo /
    Almacén / Mantenimientos / Administración). `NavigationItem.anyPermission` nuevo.
  - `maintenance/MaintenanceHubPage.tsx` nuevo + rutas `/app/mantenimientos` y
    `/app/mantenimientos/{categorias,marcas-producto,atributos,marcas-vehiculo,
    modelos,ubicaciones}`. Rutas viejas (`catalog/*`, `vehicles/brands|models`,
    `inventory/locations`) → redirect. Sin enlaces internos rotos (verificado por grep).
  - `DashboardPage.tsx` reescrito: fuera bloque de salud del sistema + su query;
    "Qué puedes hacer ahora" (acciones con verbo por permiso); métricas con
    etiqueta llana + enlace. Test reescrito.
  - `EmptyState.tsx`: props `icon`, `action`, `tone: neutral|search`.
  - `global.css`: bloque nuevo al final (maint-hub, action-chip, empty-state icon/action).
  - `navigation.test.ts`: 1 assert de label ("Sesiones" → "Sesiones de caja").
  - Verificación técnica: `tsc -b` OK · `eslint` OK · `vitest` 135/135 OK ·
    `vite build` OK. Sin cambios de esquema ni de datos.
  - Capturas: `docs/reconstruccion-ux/evidencia/s1-*.jpg`.
  - **Sin commit.** El árbol de trabajo ya traía cambios sin commitear del Bloque 11
    (tema oscuro: `index.html`, `main.tsx`, `AppShell.tsx`, `LoginPage.tsx`,
    `ThemeToggle.tsx`, `theme.ts`, parte de `global.css`, `package*.json`). Se dejan
    los cambios de esta reconstrucción en el árbol para que David los revise y
    agrupe junto al Bloque 11 como prefiera. Archivos tocados solo por la
    reconstrucción: `AppRoutes.tsx`, `navigation.ts(+test)`, `DashboardPage.tsx(+test)`,
    `EmptyState.tsx`, `maintenance/*`, `docs/*`; `global.css` recibió un bloque nuevo
    al final, encima de lo del Bloque 11.
- Pendientes detectados (anotar, no bloquean): copy "1 facturas ... vencidas" (plural);
  texto "Módulos operativos" al pie del sidebar quedó obsoleto; `.content` del shell
  deja mucho margen lateral → tratar en densidad de Inicio.

### Sesión 2 — 2026-09-08 — Módulo 2 (Catálogo/Productos + Mantenimientos de producto)
- **Backend (ms-autorepuesto), aditivo, sin cambio de esquema:**
  `product-catalogs.service.ts` → `listCategories` incluye
  `_count { products, attributeDefinitions }`; `listBrands` incluye
  `_count { products }`; `listAttributeDefinitions` incluye `_count { values }`.
  Verificado con `tsc --noEmit` OK, `products.e2e-spec` 9/9 OK, y curl real:
  CAT-FIL products:4 / CAT-ENC:1 / CAT-FRE:1, marcas Bosch:2 Brembo:1 Denso:2 NGK:1
  (datos reales intactos). El proceso `nest --watch` recompiló solo.
- **Frontend:**
  - `types/erp.ts`: `_count` opcional en ProductCategory / ProductBrand /
    ProductAttributeDefinition.
  - `components/ErpTable.tsx`: prop `emptyState?: ReactNode` (override del vacío).
  - `components/StatusBadge.tsx`: `title` explicativo + labels configurables.
  - `catalog/ProductsPages.tsx` (`ProductsPage`): P1/P2/P3 (ver checklist).
  - `catalog/CatalogPages.tsx`: M1 (ver checklist). `CatalogPage` ahora toma
    `createLabel`, `emptyDescription`, `usageColumns`; fuera prop `help` y `HelpNote`.
  - `catalog/ProductsPages.test.tsx` nuevo (4 casos: vacío con término, nombra
    categoría, oculta opciones con 0, vacío neutral).
  - `app/AppRoutes.test.tsx`: 1 assert ("No se encontraron productos" →
    "Todavía no hay productos").
  - Técnica: `tsc -b` OK · `eslint` OK · `vitest` 139/139 OK · `vite build` OK.
  - Capturas: `docs/reconstruccion-ux/evidencia/s2-*.jpg`.
- `HelpNote` sigue en uso en: SupplierPages, PayablesPage, ReceivablesPage,
  VehiclePages, SalesPages, LocationsPage → se quita en sus módulos. Componente
  se borra cuando caiga el último uso.
- **Sin commit** (mismo motivo que sesión 1: árbol con Bloque 11 sin commitear).

### Sesión 3 — 2026-09-08 — Módulo 3 (Vehículos + Mantenimientos de vehículo)
- **Backend (ms-autorepuesto), aditivo, sin esquema:**
  `vehicle-catalogs.service.ts` → `listBrands` incluye `_count { models }`,
  `listModels` incluye `_count { vehicles }`; `vehicles.service.ts` →
  `vehicleInclude` incluye `_count { compatibilities }` (afecta lista y detalle).
  `tsc --noEmit` OK · e2e `vehicles` + `compatibilities` 12/12 OK · curl real
  confirma conteos y datos intactos (Corolla 4 compatibilidades, etc.).
- **Frontend:**
  - `vehicles/VehicleChain.tsx` nuevo — tira de navegación Marca › Modelo ›
    Vehículo › Compatibilidad, con `current` para resaltar el paso.
  - `vehicles/VehiclePages.tsx`: HelpNote fuera; `VehicleChain` en las 4 vistas;
    descripciones llanas; form de vehículo con nota+enlace en Marca, Modelo
    deshabilitado hasta elegir marca, hint de Motor vs Número de motor; filtros
    con etiquetas claras y estado "Activos e inactivos / Solo…"; estados vacíos
    (neutral vs búsqueda); columnas de uso.
  - `components/Field.tsx`: `hint` ahora acepta `ReactNode` (para enlaces).
  - `types/erp.ts`: `_count` en VehicleBrand / VehicleModel / Vehicle.
  - `global.css`: bloque `.chain-nav`.
  - `vehicles/VehiclePages.test.tsx` nuevo (4 casos: cadena como nav, vacío
    neutral, vacío de búsqueda, conteo de modelos por marca).
  - Técnica: `tsc -b` OK · `eslint` OK · `vitest` 143/143 OK · `vite build` OK.
  - Capturas: `docs/reconstruccion-ux/evidencia/s3-*.jpg`.
- `HelpNote` sigue en: SupplierPages, PayablesPage, ReceivablesPage, SalesPages,
  LocationsPage.
- **Sin commit** (mismo motivo).

### Sesión 4 — 2026-09-08 — Módulo 4 (Almacén/Inventario + Ubicaciones)
- **Backend (ms-autorepuesto), aditivo, sin esquema:** `locations.service.ts`
  `findAll` incluye `_count { inventories }`. `tsc` OK · e2e `locations` +
  `inventory` 21/21 OK · curl: BOD-01 → 6, MOS-01 → 0 (datos intactos).
- **Frontend:**
  - `components/EntitySelectors.tsx`: `ProductSelector` y `LocationSelector` con
    línea de estado (`SearchStatus`), auto-selección por código exacto,
    confirmación de lo elegido; se quitó el hint jerga "Búsqueda del servidor…".
  - `components/Field.tsx`: ya aceptaba `ReactNode` en `hint` (módulo 3).
  - `inventory/InventoryPages.tsx`: descripciones sin jerga; `movementHelp` por
    tipo reemplaza el `<p>` técnico; estados vacíos de Inventario; filtro de
    existencia y de transferencias reescritos.
  - `inventory/LocationsPage.tsx`: HelpNote fuera; descripción estructural;
    columna "Productos aquí"; hints en Código/Nombre; estado vacío; eyebrow
    "Mantenimientos"; "Aplicar" → "Buscar".
  - `types/erp.ts`: `_count` en `Location`.
  - `global.css`: `.entity-selector__status`, `--empty`, `__chosen`.
  - `components/EntitySelectors.test.tsx`: +2 casos (mensaje de "no se encontró",
    auto-selección por código exacto).
  - Técnica: `tsc -b` OK · `eslint` OK · `vitest` 145/145 OK · `vite build` OK.
  - Capturas: `docs/reconstruccion-ux/evidencia/s4-*.jpg`.
- Nit visual anotado: en el form de movimiento manual el `<select>` "Tipo" se ve
  agrandado durante la carga (markup sin cambios; revisar CSS del select en ese
  layout).
- `HelpNote` queda en: SupplierPages, PayablesPage, ReceivablesPage, SalesPages.
- **Sin commit** (mismo motivo).

### Sesión 5 — 2026-09-08 — Módulo 5 (Clientes)
- **Backend (ms-autorepuesto), aditivo, sin esquema:** `customers.service.ts`
  `findAll` y `findOne` incluyen `_count { sales }`. `tsc` OK · e2e `sales` +
  `commercial-finance` 20/20 OK · curl: CLI-001 → 2 ventas (datos intactos).
- **Frontend:**
  - `sales/CustomerPages.tsx` reescrito (legible) con C1/C2 — ver checklist.
  - `components/SalesSelectors.tsx` (`CustomerSelector`): sin hint jerga, línea
    de estado, `emptyLabel` → "Sin cliente (venta de mostrador)".
  - `types/sales.ts`: `_count` en `Customer`.
  - `sales/CustomerPages.test.tsx` nuevo (explicación de cuándo registrar,
    columna de ventas + acción "Vender a este cliente").
  - Técnica: `tsc -b` OK · `eslint` OK · `vitest` 147/147 OK · `vite build` OK.
  - Capturas: `docs/reconstruccion-ux/evidencia/s5-*.jpg`.
- `HelpNote` queda en: SupplierPages, PayablesPage, ReceivablesPage, SalesPages.
- **Sin commit** (mismo motivo).

### Sesión 6 — 2026-09-08 — Módulo 6 (Ventas)
- **Sin cambios de backend** (solo frontend + copy).
- **Frontend — `sales/SalesPages.tsx`:**
  - `SalesPage`: filtros plegados en `<details>`; columnas y estados en palabras
    (`SALE_STATUS_LABELS`, `SALE_STATUS_FILTER_LABELS`, `SaleStatusChip`);
    componente `SaleParty` para la columna "Para quién"; estados vacíos
    neutral/búsqueda; descripción y botones llanos; eyebrow "Vender".
  - `SaleEditor`: legend "¿Cómo es esta venta?"; 3 modos renombrados por
    situación; textos de borrador/inventario/productos sin jerga; honra
    `?customerId=` (arranca en modo "cliente").
  - `SaleFormPage`: pasa `requestedCustomerId`.
  - `SaleDetailPage`: `HelpNote` → renglón de próximo paso; "Postear venta" →
    "Confirmar venta"; diálogo de confirmación sin "atómico".
  - `HelpNote` **eliminado del import** (ya no se usa en este archivo).
  - `sales/SalesPages.test.tsx` nuevo (estado vacío accionable, columna "Para
    quién" en palabras, filtro de estado sin DRAFT/POSTED crudos).
  - Técnica: `tsc -b` OK · `eslint` OK · `vitest` 150/150 OK · `vite build` OK.
  - Capturas: `docs/reconstruccion-ux/evidencia/s6-*.jpg`.
- Nit anotado: el grid de líneas de producto (`.purchase-line`) queda apretado
  en pantallas anchas — pulir densidad en el pase final o en Punto de venta.
- `HelpNote` queda solo en: **SupplierPages, PayablesPage, ReceivablesPage**
  (módulos 8–10). El componente se borra cuando caiga el último uso.
- **Sin commit** (mismo motivo).

### Sesión 7 — 2026-09-08 — Módulo 7 (Punto de venta)
- **Sin cambios de backend** (solo frontend). Reusa `cashApi.*`,
  `salesFinanceApi.receivables`, `salesApi.list`.
- **Frontend:**
  - `pos/PosPage.tsx` nuevo — turno de caja (abrir/cerrar inline), efectivo
    esperado, "Ventas por cobrar" con "Cobrar" directo, "Cuentas abiertas",
    "Nueva venta rápida". Explica "sesión de caja" en una frase. Caja recordada
    en `localStorage` (`biela.pos.register`), con try/catch.
  - `app/AppRoutes.tsx`: ruta `pos` (RequirePermission `sales.read`).
  - `layout/navigation.ts`: ítem "Punto de venta" en grupo "Vender"
    (`anyPermission: sales.create | cash-sessions.open | payments.create`).
  - `cash/CashPages.tsx`: descripciones sin jerga; "Sesiones" →
    "Sesiones de caja (turnos)"; eyebrow "Dinero".
  - `global.css`: bloque `.pos-*`.
  - `pos/PosPage.test.tsx` nuevo (3 casos: explicación de sesión, form de
    apertura cuando no hay turno, lista de ventas por cobrar con "Cobrar").
  - Técnica: `tsc -b` OK · `eslint` OK · `vitest` 153/153 OK · `vite build` OK ·
    backend `finance.e2e` 11/11 OK.
- **Captura de navegador pendiente:** el login por automatización del navegador
  dejó de funcionar en esta sesión (no dispara `POST /api/auth/login`; los
  inputs sintéticos no registran en el form React). El backend de login está OK
  (verificado por curl en la sesión 1) y `LoginPage` no lo toqué — no es un
  defecto de la reconstrucción. Ver `/app/pos` entrando normal → "Punto de
  venta". Reintentar captura la próxima sesión.
- `HelpNote` queda solo en: **SupplierPages, PayablesPage, ReceivablesPage**.
- **Sin commit** (mismo motivo).
- **Siguiente:** Módulo 8 — **Compras (CO1–CO2)** + **Recepción de facturas
  (AD1)**: partir "Nueva compra" en pasos nombrados (pedido → recepción de
  mercadería → factura del proveedor); diseñar una bandeja
  `/app/purchasing/inbox` para el administrador que recibe facturas.

### Sesión 8 — 2026-09-08 — Módulo 8 (Compras + Recepción de facturas)
- **Sin cambios de backend** (solo frontend). Reusa `purchasingApi.*`,
  `purchasingFinanceApi.payables`.
- **Frontend:**
  - `purchasing/PurchaseChain.tsx` nuevo — tira de pasos 1..4 con `current`
    derivado del estado (`purchaseStep()`).
  - `purchasing/PurchasePages.tsx`: chain en lista/form/ficha; textos y labels
    reescritos (ver checklist); `PURCHASE_STATUS_LABELS` para el filtro; estado
    vacío accionable; `EmptyState` importado.
  - `purchasing/ReceiptReturnPages.tsx`: descripciones de recepción y devolución
    en palabras.
  - `purchasing/PurchaseInboxPage.tsx` nuevo — bandeja AD1 (3 bloques).
  - `app/AppRoutes.tsx`: ruta `purchasing/inbox`.
  - `layout/navigation.ts`: ítem "Recepción de facturas" en grupo "Comprar".
  - `purchasing/PurchasingPages.test.tsx`: 1 assert de texto de diálogo
    (`/no modifica Inventario/` → `/Todavía no toca el inventario/`).
  - `purchasing/PurchaseInboxPage.test.tsx` nuevo (2 casos: bucketeo por acción
    siguiente; oculta "Por pagar" sin permiso).
  - Técnica: `tsc -b` OK · `eslint` OK · `vitest` 155/155 OK · `vite build` OK ·
    backend `purchasing.e2e` 8/8 OK.
- `HelpNote` queda solo en: **SupplierPages, PayablesPage, ReceivablesPage**.
- **Sin commit** (mismo motivo).

### Sesión 9 — 2026-09-08 — Módulo 9 (Proveedores) + capturas 7/8
- **Login por automatización**: se resolvió inyectando el token con
  `javascript_tool` — `fetch('/api/auth/login')` dentro de la página y
  `sessionStorage.setItem('biela.accessToken', …)`, luego navegar a `/app/...`.
  Con eso se verificaron en navegador **módulo 7 (Punto de venta)**, **módulo 8
  (Recepción de facturas + Registrar factura)** y **módulo 9 (Proveedores)**.
  Capturas: `docs/reconstruccion-ux/evidencia/s7-*.jpg`, `s8-*.jpg`, `s9-*.jpg`.
- **Backend (ms-autorepuesto), aditivo, sin esquema:** `suppliers.service.ts`
  `findAll` + `findOne` incluyen `_count { purchases }`. `tsc` OK · `suppliers.e2e`
  8/8 OK · curl: PRV-001 → 1 compra (datos intactos).
- **Frontend:**
  - `purchasing/SupplierPages.tsx`: `HelpNote` fuera; descripción/estructura
    (ver checklist); columna "Compras"; acción "Registrar una factura";
    `EmptyState` neutral/búsqueda; ficha con métricas trimmed; form reordenado.
  - `purchasing/PurchasePages.tsx`: `PurchaseFormPage` honra `?supplierId=`
    (`useSearchParams`, `requestedSupplierId`).
  - `types/purchasing.ts`: `_count` en `Supplier`.
  - `app/AppRoutes.test.tsx` + `purchasing/PurchasingPermissions.test.tsx`:
    1 assert de texto cada uno (empty state / heading de sección).
  - `purchasing/SupplierPages.test.tsx` nuevo (sin nota; columna de compras +
    acción por fila).
  - Técnica: `tsc -b` OK · `eslint` OK · `vitest` 157/157 OK · `vite build` OK.
- Nit anotado: `SupplierSelector` (en `PurchasingSelectors.tsx`, distinto de
  `EntitySelectors`) todavía tiene el hint jerga "Búsqueda paginada del
  servidor…" — limpiar en el pase final.
- `HelpNote` queda solo en: **PayablesPage, ReceivablesPage** (módulo 10).
- **Sin commit** (mismo motivo).

### Sesión 10 — 2026-09-08 — Módulo 10 (Cuentas por cobrar / por pagar)
- **Sin cambios de backend** (solo frontend). Reusa `salesFinanceApi.receivables`,
  `purchasingFinanceApi.payables`.
- **Frontend:**
  - `sales/ReceivablesPage.tsx` y `purchasing/PayablesPage.tsx` reescritos (ver
    checklist F1–F4): descripción estructural, 3 tarjetas en vez de 12 spans,
    filtros plegados, columnas quién/documento/cuánto/vence/estado/acción,
    filas vencidas tintadas, textos sin jerga.
  - `components/ErpTable.tsx`: prop `rowClassName?: (row) => string`.
  - `components/HelpNote.tsx` **BORRADO** — era el último uso. **X1 completo.**
  - `global.css`: `.erp-row--overdue`.
  - `sales/ReceivablesPage.test.tsx` nuevo (sin nota; totales; badge de
    vencimiento en palabras; acción "Cobrar").
  - `purchasing/PurchasingPages.test.tsx`: 2 asserts de texto (badge de
    vencimiento, label del filtro).
  - Técnica: `tsc -b` OK · `eslint` OK · `vitest` 159/159 OK · `vite build` OK ·
    backend `commercial-finance.e2e` 9/9 OK.
  - Verificado en navegador (token-injection): CxC y CxP con las 3 tarjetas,
    filas vencidas en rojo, botón "Cobrar"/"Pagar" por fila. Capturas
    `docs/reconstruccion-ux/evidencia/s10-*.jpg`.
- Nits anotados (para el pase final): plural "N venta(s) atrasada(s)" resuelto
  con ternarios feos — limpiar; `SupplierSelector` con hint jerga.
- **Sin commit** (mismo motivo).

### Sesión 11 — 2026-09-08 — Módulo 11 (Usuarios / Roles)
- **Sin cambios de backend** (solo frontend).
- **Frontend:**
  - `admin/AdminPages.tsx` reescrito legible + jerarquía (ver checklist US1).
  - `components/CashAdminSelectors.tsx` (`RoleSelector`): de grid mono a
    checkboxes con nombre + descripción por rol; legend/intro en palabras.
  - `admin/AdminPages.test.tsx`: 1 assert de botón ("Desactivar" →
    "Quitar acceso") + 2 casos nuevos (secciones nombradas del form de usuario;
    contador vivo de permisos en el form de rol).
  - Técnica: `tsc -b` OK · `eslint` OK · `vitest` 161/161 OK · `vite build` OK.
  - Verificado en navegador (token-injection): "Nuevo usuario" en 2 secciones;
    "Nuevo rol" con `[Datos del rol]` + `[Permisos · 0 de 54 marcados]` y código
    técnico movido a tooltip. Capturas `docs/reconstruccion-ux/evidencia/s11-*.jpg`.
- **Sin commit** (mismo motivo).
- **Siguiente:** Módulo 12 — **Pase final de verificación (Z1–Z5)**:
  - Z1: recorrer cada pantalla reconstruida como usuario sin conocimiento previo.
  - P4: probar el escáner E2E en un navegador móvil real (pendiente desde módulo 2).
  - Z2: repasar el checklist queja por queja.
  - Z3: `vitest` full + `vite build` + `tsc` en front y back + e2e backend +
    **regresión de datos reales** (comparar conteos Postgres/Mongo antes/después
    — recordar que todos los cambios de backend fueron `_count` aditivos, sin
    esquema).
  - Z4: capturas finales.
  - Z5: pendientes (nits acumulados: plural feo en CxC/CxP; `SupplierSelector`
    hint jerga; densidad de `.purchase-line`; I1/I2/I3 densidad del Inicio;
    texto "Módulos operativos" al pie del sidebar; `.help-note` CSS muerto).
  - **Y decidir con David si commitear** (el árbol tiene también el Bloque 11 de
    tema oscuro sin commitear).


### Sesión 12 — 2026-09-08 — Pase final de verificación (Z1–Z5)

**Z3 — Verificación técnica**
- Frontend: `tsc -b` OK · `eslint --max-warnings=0` OK · `vitest` **161/161** OK ·
  `vite build` OK.
- Backend `ms-autorepuesto`: `tsc --noEmit` OK · e2e **125/125** con `--runInBand`
  (en paralelo 12 fallan por estado compartido de la BD de test entre suites —
  característica preexistente de la infra, no de estos cambios: cada suite pasa
  aislada y todas pasan en serie).
- Backend `ms-users`: `tsc --noEmit` OK. **Cero cambios en `ms-users`.**
- **Regresión de datos reales (D6):**
  - `git status` de `services/*/prisma/` y migraciones: **vacío** — ningún cambio
    de esquema ni migración nueva.
  - `prisma migrate status`: *"Database schema is up to date!"* (sin drift, sin
    migraciones pendientes).
  - Los 6 cambios de backend son todos `include: { _count: … }` aditivos
    (28 inserciones), sin escrituras ni lógica nueva.
  - Snapshot de conteos (referencia, 2026-09-08):
    - Postgres `biela_autorepuesto`: Product 6 · ProductCategory 3 ·
      ProductBrand 4 · ProductAttributeDefinition 3 · Vehicle 3 · VehicleBrand 3 ·
      VehicleModel 3 · ProductCompatibility 8 · Location 2 · Inventory 6 ·
      InventoryMovement 16 · Customer 3 · Supplier 2 · Sale 4 · SaleItem 6 ·
      Purchase 2 · PurchaseItem 4 · PurchaseReceipt 2 · Payment 3 ·
      CashRegister 1 · CashSession 1 · CashMovement 2.
    - Mongo `biela_users`: users 39 · roles 8.
  - Coinciden con lo observado en cada módulo por curl. **Datos reales intactos.**

**Z1 / Z2 — Recorrido y checklist**
- Recorrido final en navegador (login por token-injection) de Inicio, Productos,
  Vehículos, Inventario además de las pantallas verificadas por módulo. Todas
  renderan con datos reales; nada regresó al aterrizar los módulos siguientes.
  Capturas `docs/reconstruccion-ux/evidencia/s12-*.jpg`.
- Checklist queja por queja — estado:
  - ✅ verificado en navegador: I4 · M1 · M2 · MN1 · P1 · P2 · P3 · VH1 · VH2 ·
    VH3 · AL1 · AL2 · AL3 · AL4 · UB1 · UB2 · C1 · C2 · V1 · V2 · V3 · V4 · V5 ·
    V6 · V7 · V8 · V9 · CJ1 · CJ2 · CJ3 · CO1 · CO2 · AD1 · PR1 · PR2 · PR3 ·
    F1 · F2 · F3 · F4 · US1 · X1(HelpNote borrado en toda la app).
  - 🟨 primer pase, falta densidad: I1 · I2 · I3 (Panel de inicio — acciones y
    métricas con enlace ya están; falta llenar el espacio vacío).
  - ⬜ pendiente de David: **P4** — probar el escáner de código de barras E2E en
    un teléfono real. Infra verificada: botón "Cámara" presente y cableado,
    `navigator.mediaDevices.getUserMedia` disponible, `isSecureContext` true,
    `@zxing/browser` empaquetado. No se puede validar la cámara desde esta
    sesión automatizada.

**Z5 — Pendientes (nits, no bloquean)**
1. **P4**: escáner en móvil real (arriba).
2. Panel de inicio (I1/I2/I3): densidad/uso del espacio vacío.
3. Copy "1 factura**s** de proveedor vencida**s**" (plural) en dashboard y CxC/CxP
   — el fix quedó con ternarios feos; unificar en un helper `plural()`.
4. `SupplierSelector` (`PurchasingSelectors.tsx`) todavía tiene el hint jerga
   "Búsqueda paginada del servidor…" (los otros selectores ya se limpiaron).
5. Descripción de Productos: "Datos maestros de producto…" — jerga leve; no
   estaba en la lista de David pero conviene ("El catálogo de piezas…").
6. Barra de filtros de Vehículos: no se plegó en `<details>` como Ventas/CxC/CxP.
7. Densidad de `.purchase-line` (líneas de producto en Ventas/Compras) apretada
   en pantallas anchas.
8. Texto "Módulos operativos" al pie del sidebar quedó obsoleto con la nueva IA.
9. CSS muerto de `.help-note*` en `global.css` (componente borrado).
10. eyebrow "Catálogo" en la lista/form de Vehículos (podría ser "Catálogo" ok, o
    unificar con el resto).

**Commit**
- **Todo el trabajo sigue sin commitear**, en el árbol, junto a los cambios del
  Bloque 11 (tema oscuro) que ya estaban sin commitear al empezar. Archivos de
  la reconstrucción vs. Bloque 11: ver `git diff --stat`. Los del Bloque 11 son
  `index.html`, `main.tsx`, `AppShell.tsx`, `LoginPage.tsx`, `package*.json` y
  parte de `global.css`; el resto es reconstrucción. **Decisión de David.**
