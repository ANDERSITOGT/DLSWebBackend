# DLS Backend – Contrato de la API (para el frontend)

Backend de inventarios agrícola (Node + Express + TypeScript + Prisma/PostgreSQL). Solo API, sin frontend.

- **Base URL:** `http://localhost:3001` (o `PORT` en producción). Prefijo `/api`.
- **Formato:** JSON (`Content-Type: application/json`). CORS abierto (`*`).
- **Auth:** `POST /api/auth/login` devuelve un JWT (expira en **150 días**). Enviarlo en `Authorization: Bearer <token>`.
- **Roles:** `ADMIN`, `BODEGUERO`, `SOLICITANTE`, `VISOR`, `COSECHA`.
- **Errores:** `{ "message": "..." }` con 400/401/403/404/500.

## Convenciones de esta documentación

- 🔒 = la ruta exige `Authorization: Bearer <token>`. Sin token responde **401** `{ message: "Acceso denegado: Token no proporcionado" }`.
- 🔑 = token inválido/expirado → **403** `{ message: "Token inválido o expirado" }`.
- 🛑 = cuenta desactivada (el middleware revalida el usuario en BD en cada petición) → **403** `{ message: "Su cuenta ha sido desactivada. Acceso revocado." }`.
- 👑 = además **solo rol ADMIN** (403 si no).
- Sin marca = ruta **pública**, no necesita token.
- ⚠️ **Shapes:** algunas rutas devuelven un **array plano** y otras un **objeto envuelto**. Siempre se indica en la columna "Respuesta". No asumir.

## Enums

- `rol`: `ADMIN | BODEGUERO | SOLICITANTE | VISOR | COSECHA`
- `estado_solicitud`: `PENDIENTE | APROBADA | RECHAZADA | ENTREGADA`
- `tipo_solicitud`: `DESPACHO | DEVOLUCION`
- `tipo_documento`: `INGRESO | SALIDA | TRANSFERENCIA | AJUSTE | DEVOLUCION | SOLICITUD`
- `estado_documento`: `BORRADOR | APROBADO | ANULADO`
- `estado_lote`: `ABIERTO | CERRADO`

> ⚠️ **Cosechas** es un módulo separado de Bodega: el rol `COSECHA` no accede al módulo de bodega/inventario y viceversa.

---

## Salud

| Método | Ruta | Auth | Descripción | Respuesta |
|---|---|---|---|---|
| GET | `/api/health` | – | Verifica servidor/BD. | `{ ok, db, server }` |

---

## Auth – `/api/auth`

| Método | Ruta | Auth | Body | Descripción | Respuesta |
|---|---|---|---|---|---|
| POST | `/login` | – | `{ email, password }` | Inicia sesión. | `{ token, user: { id, email, nombre, rol } }` |

- Credenciales inválidas → **401** `{ message: "Credenciales inválidas" }`.
- Usuario inactivo → **403** `{ message: "Usuario inactivo. Contacte al administrador." }`.

---

## Dashboard – `/api/dashboard` 🔒

Fuente oficial del home. (Las antiguas `/api/inicio/bodeguero` y `/api/inicio/admin` fueron **eliminadas**.)

| Método | Ruta | Query | Descripción |
|---|---|---|---|
| GET | `/` | `modulo` = `BODEGA` \| `COSECHAS` (default `BODEGA`), `dias` (default `7`, recortado a 1–90) | Dashboard unificado. |

Respuesta:
```ts
{
  modulo: "BODEGA" | "COSECHAS",
  generadoEn: string,            // ISO
  kpis: { id, label, value, formato, descripcion, variacionPct, tendencia, icono? }[],
  graficas: { id, titulo, tipo: "barras" | "lineas", series, datos }[],
  resumenDia: { id, label, value, total, formato }[],
  alertas: { id, nivel: "info" | "warning" | "danger", titulo, descripcion, cantidad, ruta }[]
}
```

Acceso por rol (`modulo`):
- `BODEGA`: `ADMIN`, `BODEGUERO` (completo) · `SOLICITANTE`, `VISOR` (modo simple: sin stock, sin dinero, sin top de despachos y sin alertas).
- `COSECHAS`: `ADMIN`, `COSECHA` únicamente.
- Otro rol en ese módulo → **403** `{ message: "No tiene permisos para ver este módulo" }`.

> Legacy: `GET /api/inicio/solicitante` 🔒 (`ADMIN`, `SOLICITANTE`, `VISOR`) sigue vivo pero **`@deprecated`**. Migrar a `/api/dashboard`.

---

## Usuarios – `/api/usuarios` 🔒

| Método | Ruta | Rol | Body | Descripción | Respuesta |
|---|---|---|---|---|---|
| POST | `/verificar-acceso` | autenticado | `{ password }` | Valida la contraseña del usuario actual. | `{ ok: true }` |
| GET | `/` | 👑 | – | Lista usuarios. | **array plano** `[{ id, nombre, email, rol, activo, createdat }]` |
| POST | `/` | 👑 | `{ nombre, email, password, rol }` | Crea usuario. | `{ ok: true, usuario }` |
| PATCH | `/:id/toggle-status` | 👑 | – | Activa/desactiva. **No** a otros ADMIN. | `{ ok: true, message }` |
| PATCH | `/:id/reset-password` | 👑 | `{ newPassword }` | Resetea contraseña. No a otros ADMIN. | `{ ok: true, message }` |
| GET | `/solicitantes-asignacion` | 👑 | – | Solicitantes con sus lotes asignados. | objeto del servicio |
| POST | `/:id/asignar-lotes` | 👑 | `{ lotesIds: string[] }` | Asigna lotes a un solicitante. | `{ ok: true, message }` |

---

## Inventario – `/api/inventario` 🔒 (toda la sección requiere token)

> 🔒 `authenticateToken` se aplica a nivel de router: **todas** estas rutas exigen `Bearer`, incluidas `/`, `/categorias`, `/bodegas` y `/pdf`.

| Método | Ruta | Query | Descripción | Respuesta |
|---|---|---|---|---|
| GET | `/` | `limit` (`30` default, o `all`), `search`, `categoria` | Stock de productos. | **envuelto** `{ productos: [...] }` |
| GET | `/categorias` | – | Categorías para filtros. | **envuelto** `{ categorias: [...] }` |
| GET | `/bodegas` | – | Bodegas ordenadas por nombre. | **array plano** `[{ id, nombre }]` |
| GET | `/pdf` | (filtros) | Reporte de inventario en PDF. | `application/pdf` |
| GET | `/:id` | – | Detalle de un producto en inventario. | objeto detalle |

---

## Categorías – `/api/categorias`

| Método | Ruta | Auth | Descripción | Respuesta |
|---|---|---|---|---|
| GET | `/` | – (público) | Lista de categorías. | **envuelto** `{ categorias: [...] }` |

> Existen **dos** rutas de categorías: `GET /api/categorias` (envuelto, público) y `GET /api/productos/categorias` (array plano, público).

---

## Productos – `/api/productos`

| Método | Ruta | Auth | Body / Query | Descripción | Respuesta |
|---|---|---|---|---|---|
| POST | `/` | 🔒 | `{ nombre, categoriaid, unidadid, ingredienteactivo?, precioref? }` | Crea producto (código automático). | producto creado (201) |
| PATCH | `/:id` | 🔒 | `{ nombre?, codigo?, categoriaid?, unidadid?, ingredienteactivo?, precioref?, activo? }` | Edita producto. | producto |
| GET | `/categorias` | – | – | Categorías. | **array plano** `[{ id, nombre }]` |
| GET | `/unidades` | – | – | Unidades de medida. | **array plano** `[{ id, nombre, abreviatura }]` |
| GET | `/productos-busqueda` | – | `q` | Búsqueda de productos (máx 20). | **array plano** `[{ id, nombre, codigo, precioref, unidad, stockActual }]` |
| GET | `/productos/buscar` | – | `q` | Búsqueda alterna (máx 50, orden alfabético). | **array plano** (producto + `stockActual`) |

> `stockActual` = stock físico **menos** lo comprometido en solicitudes `PENDIENTE`/`APROBADA` (nunca negativo).

---

## Proveedores – `/api/proveedores`

Lectura de lista y escritura limitadas a `ADMIN` y `BODEGUERO`.

| Método | Ruta | Auth / Rol | Body / Query | Descripción | Respuesta |
|---|---|---|---|---|---|
| GET | `/` | 🔒 ADMIN/BODEGUERO | `page` (default `1`), `limit` (default `10`, **máx 100**), `q` (búsqueda opcional) | Lista proveedores **paginada** con contactos. `q` busca (case-insensitive) por `nombre` **o** `nit`. | **envuelto** `{ data: [{ ...proveedor, proveedor_contacto: [] }], meta: { total, page, limit, totalPages } }` |
| GET | `/catalogo` | – (público) | – | Catálogo liviano (selects). | **array plano** `[{ id, nombre, nit }]` |
| POST | `/` | 🔒 ADMIN/BODEGUERO | `{ nombre, nit, notas }` | Crea proveedor. | proveedor (201) |
| PATCH | `/:id` | 🔒 ADMIN/BODEGUERO | `{ nombre?, nit?, notas? }` | Edita proveedor. | proveedor |
| POST | `/:id/contactos` | 🔒 ADMIN/BODEGUERO | `{ nombre, telefono, email, puesto, notas }` | Agrega contacto. | contacto (201) |
| DELETE | `/contactos/:contactoId` | 🔒 ADMIN/BODEGUERO | – | Elimina contacto. | `{ success: true }` |

`GET /` — respuesta paginada:
```ts
{
  data: {
    id, nombre, nit, notas, createdat,
    proveedor_contacto: { id, proveedorid, nombre, telefono, email, puesto, notas, createdat }[]
  }[],
  meta: { total: number, page: number, limit: number, totalPages: number }
}
```

`PATCH /:id` — reglas de `nombre` (opcional):
- Si viene y queda vacío (tras `trim`) → **400** `{ message: "El nombre no puede estar vacío" }`.
- Si choca con otro proveedor (case-insensitive) → **409** `{ message: "Ya existe un proveedor con ese nombre" }`.
- `nit` y `notas` siguen siendo opcionales e independientes.

---

## Solicitudes – `/api/solicitudes`

Un `SOLICITANTE` solo ve las suyas (listado forzado a su `id`, detalle/export ajenos → **403**).
Todas las rutas exigen token 🔒 (incluido `/export`, que **ya no es pública**).

| Método | Ruta | Auth | Body / Query | Descripción | Respuesta |
|---|---|---|---|---|---|
| GET | `/` | 🔒 | `estado`, `tipo`, `bodegaId`, `q`, `page` (def. `1`), `limit` (def. `15`, **máx 100**) | Lista **paginada** y filtrada. | **envuelto** `{ ok: true, solicitudes: [...], meta }` |
| GET | `/:id` | 🔒 | – | Detalle completo (con `aprobador`, `costounit`, `subtotal`, `montoTotal`, `historial`). | objeto `SolicitudDetalleDTO` |
| POST | `/` | 🔒 | `{ tipo, solicitanteId?, bodegaid?, fecha?, productos\|items: [{ productoId, unidadId?, cantidad, loteId?, notas? }] }` | Crea solicitud (DESPACHO o DEVOLUCION). | `{ ok: true, solicitud }` (201) |
| PATCH | `/:id/estado` | 🔒 ADMIN/BODEGUERO | `{ estado, motivo? }` | Aprueba/rechaza (máquina de estados estricta). | detalle |
| POST | `/:id/entregar` | 🔒 ADMIN/BODEGUERO | – | Genera documento SALIDA/DEVOLUCION, mueve inventario y marca ENTREGADA. | `{ solicitud, documentoId, codigoDoc }` |
| GET | `/:id/export` | 🔒 | – | PDF del detalle de la solicitud. | `application/pdf` |

### Máquina de estados (estricta)

```
PENDIENTE  -> APROBADA | RECHAZADA
APROBADA   -> RECHAZADA          (ENTREGADA solo vía POST /:id/entregar)
RECHAZADA  -> (terminal)
ENTREGADA  -> (terminal)
```

- `PATCH /:id/estado` **no** acepta `ENTREGADA` (→ **400** `TRANSICION_INVALIDA`); solo `entregar` produce ese estado.
- Transición no permitida → **400** `{ message: "Transición no permitida: X → Y ...", codigo: "TRANSICION_INVALIDA" }`.
- `aprobador` se fija solo al APROBAR; un rechazo posterior no lo pisa.

### `GET /` — listado paginado

| Query | Tipo | Notas |
|---|---|---|
| `estado` | enum | `PENDIENTE \| APROBADA \| RECHAZADA \| ENTREGADA` (valor inválido → **400** `ESTADO_INVALIDO`). |
| `tipo` | enum | `DESPACHO \| DEVOLUCION` (valor inválido → **400** `TIPO_INVALIDO`). |
| `bodegaId` | uuid | Filtra por bodega. |
| `q` | string | Case-insensitive por `solicitud.id` (código `SOL-YYYY-NNNN`) **o** nombre/código de producto. |
| `page` | int | Default `1`. |
| `limit` | int | Default `15`, **máx 100**. |

Respuesta:
```ts
{
  ok: true,
  solicitudes: [{
    id: string,               // código, p. ej. "SOL-2026-0001"
    codigo: string,           // = id
    fecha: string | null,     // ISO
    estado: "PENDIENTE" | "APROBADA" | "RECHAZADA" | "ENTREGADA",
    tipo: "DESPACHO" | "DEVOLUCION",
    bodegaNombre: string,
    solicitanteNombre: string,
    totalProductos: number,
    yaDevuelta: boolean       // true si ya tiene una devolución activa
  }],
  meta: { total: number, page: number, limit: number, totalPages: number }
}
```

### `GET /:id` — detalle (`SolicitudDetalleDTO`)

```ts
{
  id: string,
  codigo: string,
  fecha: string | null,
  estado: "PENDIENTE" | "APROBADA" | "RECHAZADA" | "ENTREGADA",
  tipo: "DESPACHO" | "DEVOLUCION",
  solicitante: { id: string, nombre: string },
  aprobador: { id: string, nombre: string } | null,   // quién aprobó
  bodega: { id: string, nombre: string } | null,
  productos: [{
    itemId: string,
    productoId: string,
    productoObjId: string | undefined,
    nombre: string,
    codigo: string,
    cantidad: number,
    unidad: string,            // abreviatura
    unidadNombre: string,
    loteId: string | null,
    loteCodigo: string,
    cultivo: string,
    notas: string | null,
    costounit: number | null,  // null si el rol no ve costos o la línea no tiene costo
    subtotal: number | null    // cantidad * costounit (2 dec); null en las mismas condiciones
  }],
  documentoSalidaId: string | null,
  documentoSalidaConsecutivo: string | null,
  montoTotal: number | null,   // null si el rol no ve costos o no hay costos
  historial: [{                // eventos de auditoría (entidad SOLICITUD), orden ascendente
    accion: "CREAR" | "APROBAR" | "RECHAZAR" | "ENTREGAR",
    fecha: string | null,      // ISO
    usuario: { id: string, nombre: string } | null,
    payload: object | null
  }]
}
```

**Visibilidad de importes:** `costounit`, `subtotal` y `montoTotal` llegan como `null`
para roles **`SOLICITANTE`, `VISOR` y `COSECHA`**. Solo `ADMIN` y `BODEGUERO` ven importes
(aplica igual en el PDF de `/:id/export`). Los costos se congelan en `documento_item` al entregar.

### `PATCH /:id/estado`

- **Solo `ADMIN` o `BODEGUERO`** (otro rol → **403** `SIN_PERMISO`).
- Body: `{ estado, motivo? }`. `motivo` es texto libre (recomendado al rechazar) y queda en la auditoría.
- Un `SOLICITANTE` **no** puede usar esta ruta (no es aprobador → **403** `SIN_PERMISO`).

### `POST /:id/entregar`

- **Solo `ADMIN` o `BODEGUERO`** (otro rol → **403**).
- Solo se entrega una solicitud **APROBADA**:
  - Estado ≠ APROBADA y no procesada → **400** `SOLICITUD_NO_APROBADA`.
  - Ya `ENTREGADA`/`RECHAZADA` → **409** `SOLICITUD_YA_PROCESADA`.
- El paso a `ENTREGADA` es un `updateMany` condicionado (idempotente); si otra transacción ganó → **409** `SOLICITUD_YA_PROCESADA`.
- Genera documento `SALIDA` (DESPACHO) o `DEVOLUCION` (DEVOLUCIÓN) en estado `APROBADO` y mueve inventario.
- Valida stock al momento (solo DESPACHO) → **400** `STOCK_INSUFICIENTE`.
- `solicitud.aprobadorid` **no** se sobrescribe: conserva a quien aprobó. Quien entrega queda en `documento.creadorid` y en auditoría.
- Costeo congelado por línea: DESPACHO usa `producto.precioref` > 0 o, en su defecto, el último `costounit` de un INGRESO aprobado — si no hay ninguno responde **400 `PRODUCTO_SIN_COSTO`**. DEVOLUCIÓN hereda el costo del documento de salida de origen (o cae a `precioref`) y, al ser devolución interna, **recalcula el CPP** de los productos devueltos.

Respuesta:
```ts
{
  solicitud: { id, estado: "ENTREGADA", aprobadorid: string | null, documentosalidaid: string | null },
  documentoId: string,
  codigoDoc: string            // "SAL-2026-0001" | "DEV-2026-0001"
}
```

### Códigos de error del módulo (`{ message, codigo }`)

`SOLICITUD_NO_ENCONTRADA` (404), `SIN_PERMISO` (403), `ESTADO_INVALIDO` / `TIPO_INVALIDO` (400),
`TRANSICION_INVALIDA` (400), `SOLICITUD_NO_APROBADA` (400), `SOLICITUD_YA_PROCESADA` (409),
`SOLICITUD_SIN_ITEMS` (400), `STOCK_INSUFICIENTE` (400), `PRODUCTO_SIN_COSTO` (400), `DEVOLUCION_DUPLICADA` (409),
`LOTE_NO_ASIGNADO` (400), `SOLICITANTE_REQUERIDO` (400).

Notas del POST:
- Acepta tanto `productos` como `items` (mismo array).
- Acepta `productoId`/`productoid`, `unidadId`/`unidadid`, `loteId`/`loteid` (camelCase o minúsculas).
- Acepta `solicitudOrigenId`/`solicitud_origen_id`.
- Si falta `unidadId`, se toma la unidad del producto.
- `SOLICITANTE` con `loteId` sin asignación → **400** `"SEGURIDAD: No tienes permiso asignado para el lote ..."`.
- En DESPACHO se valida stock disponible → **400** `"Stock insuficiente para ..."`.
- No se puede duplicar una devolución activa para la misma solicitud origen → **409** `DEVOLUCION_DUPLICADA`.

---

## Movimientos – `/api/movimientos`

| Método | Ruta | Auth / Rol | Body | Descripción | Respuesta |
|---|---|---|---|---|---|
| POST | `/escanear` | 🔒 ADMIN/BODEGUERO | `multipart/form-data` (ver §4.1) | OCR de factura (tesseract.js `spa+eng`). | `200 { ok, escaneo }` |
| POST | `/ingreso` | 🔒 **ADMIN / BODEGUERO** | ver §4.2 | Ingreso de mercadería (recalcula `producto.precioref` por **CPP**). | `201 { ok, documento, message }` |
| POST | `/ajuste` | 🔒 ADMIN/BODEGUERO | `{ productoId, cantidad, tipo?, bodegaId?, loteId?, notas? }` | Ajuste **bidireccional**: `SALIDA`/`FALTANTE` resta (cantidad negativa) y `ENTRADA`/`SOBRANTE` suma. Congela `precioref`/`costounit` del producto. | `{ ok, documento }` |
| POST | `/devolucion-proveedor` | 🔒 ADMIN/BODEGUERO | `{ proveedorId, bodegaId, items: [{ productoId, cantidad, notas? }], notas }` | Devolución a proveedor (congela `precioref`/`costounit`). | `{ ok, documento }` |
| GET | `/` | 🔒 | `page`, `limit`, `tipo`, `estado`, `proveedorId`, `solicitanteId`, `bodegaId`, `q`, `fechaInicio`, `fechaFin` | Lista **paginada** de movimientos/documentos. | **envuelto** `{ data: [...], meta: { total, page, limit, totalPages } }` |
| GET | `/export` | 🔒 | los mismos filtros que `/` | Exporta el listado (máx. 500 filas). | PDF |
| GET | `/:id` | 🔒 | – | Detalle del movimiento (acepta `id` UUID o `consecutivo`). | objeto detalle |
| GET | `/:id/export` | 🔒 | – | Exporta detalle. | PDF |

**Filtros de `GET /`**

| Query | Tipo | Notas |
|---|---|---|
| `page` | int | Default `1`. |
| `limit` | int | Default `15`, **máx. 100**. |
| `tipo` | enum | `INGRESO \| SALIDA \| TRANSFERENCIA \| AJUSTE \| DEVOLUCION`. |
| `estado` | enum | `BORRADOR \| APROBADO \| ANULADO`. |
| `proveedorId` | uuid | |
| `solicitanteId` | uuid | Un `SOLICITANTE` **solo ve sus documentos**: el backend pisa este filtro con su propio `id`. |
| `bodegaId` | uuid | Coincide por bodega **origen o destino**. |
| `q` | string | Busca en `consecutivo`, número/serie del comprobante, o nombre/código de producto. |
| `fechaInicio` / `fechaFin` | `YYYY-MM-DD` o ISO | Se interpretan en **America/Guatemala**. Un `YYYY-MM-DD` en ambos extremos cubre el día completo. Rango máximo: **366 días**. |

Errores de validación de fechas → **400** `{ message, codigo }` con `codigo`:
`FECHA_INICIO_INVALIDA`, `FECHA_FIN_INVALIDA`, `RANGO_FECHAS_INVALIDO`, `RANGO_FECHAS_EXCEDIDO`.

**Visibilidad de importes**

`montoTotal` (listado y detalle) y `costounit` / `subtotal` (detalle) llegan como `null`
para los roles **`SOLICITANTE`, `VISOR` y `COSECHA`**. Solo `ADMIN` y `BODEGUERO` ven importes.
Aplica igual en los PDF de export.

**Formato de `productos[]` en el detalle (`GET /:id`)**

Cada ítem se serializa con tipos **primitivos** de JSON, nunca con objetos `Decimal` de Prisma:

```ts
productos: [{
  id: string,
  productoNombre: string,
  productoCodigo: string,
  cantidad: string,          // texto para pintar, p.ej. "12.5 L"
  cantidadNumero: number,    // SIEMPRE number puro (conversión explícita del Decimal)
  unidad: string,            // abreviatura, p.ej. "L"
  unidadId: string,
  loteCodigo: string | null,
  loteId: string | null,
  fincaNombre: string | null,
  notas: string | null,
  costounit: number | null,  // null si el rol no ve costos o la línea no tiene costo
  subtotal: number | null    // cantidadNumero * costounit, 2 decimales
}]
```

**Snapshot histórico de `precioref` en salidas / ajustes**

Las operaciones que **no** manejan costo unitario propio (SALIDA y DEVOLUCIÓN generadas desde
`POST /api/solicitudes/:id/entregar`, `POST /api/movimientos/ajuste` y
`POST /api/movimientos/devolucion-proveedor`) guardan el **costo congelado** del producto en
`documento_item.costounit` **y** `documento_item.precioref`. La fuente es `producto.precioref`
(CPP vigente, redondeado a 2 decimales); si el producto no tiene `precioref > 0` se responde
**400 `PRODUCTO_SIN_COSTO`** (no se crea movimiento sin costo).

**Valuación por Costo Promedio Ponderado (CPP)** — fuente única en `src/core/valuacion.ts`:

```
cppNuevo = ((stockPrevio * cppActual) + (cantidadEntrada * costounit))
           / (stockPrevio + cantidadEntrada)
```

- `POST /api/movimientos/ingreso`: `cantidadEntrada`/`costounit` son el promedio ponderado de las
  líneas con costo > 0; `stockPrevio` es el stock aprobado **antes** de insertar las líneas. Las
  líneas con costo 0 (bonificación/muestra) no diluyen el promedio. Si ninguna línea trae costo,
  `precioref` **no** se toca.
- `entregar` de una DEVOLUCIÓN interna (sin proveedor): pondera la cantidad devuelta al
  `costounit` heredado del documento de salida original.
- DESPACHO: **bloquea** (400 `PRODUCTO_SIN_COSTO`) si el producto no tiene `precioref > 0` ni
  costos históricos de ingreso.

> 🔒 **`/export` y `/:id/export` ahora exigen token** (antes eran públicas).

> ⚠️ **`POST /ingreso` pasó a exigir rol `ADMIN` o `BODEGUERO`.** Antes cualquier usuario autenticado
> podía dar de alta mercadería. `SOLICITANTE`, `VISOR` y `COSECHA` ahora reciben **403**.

### 4.1 `POST /api/movimientos/escanear` — OCR de factura

**Implementado** en `src/modules/movimientos/`:
- `movimientos.ts` → ruta, subida con `multer` (`memoryStorage()`, 10 MB) y guard de rol.
- `ocrService.ts` → extracción con `tesseract.js` (`spa+eng`), parser GT/FEL y match contra BD.

**Motor OCR:** `tesseract.js` v7 con idiomas `spa+eng`, ejecutado en memoria (no se escribe nada a disco).
La primera petición descarga y compila el modelo de idioma (~1–3 s); las siguientes reutilizan la caché local.

**Request** — `multipart/form-data` 🔒 ADMIN/BODEGUERO

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `archivo` | file | sí | Imagen de la factura. Máx. **10 MB**. Solo `image/jpeg`, `image/png`, `image/webp`. |
| `documento` | file | no | **Alias legacy** de `archivo` (compatibilidad temporal). Si llegan ambos, se usa `archivo`. |
| `proveedorId` | string (uuid) | no | Si se envía, el OCR se contrasta contra los datos del proveedor. |

> ⚠️ **PDF no soportado.** El contrato anterior listaba `application/pdf`; tesseract.js solo procesa
> mapas de bits. Los PDF se rechazan con `400 ARCHIVO_INVALIDO`. Si se necesita PDF, hay que
> rasterizarlo en el cliente (canvas) o agregar `pdf2pic`/`pdftoppm` en el servidor.

**Respuesta — `200`**

```ts
{
  ok: true,
  escaneo: {
    confianza: number,          // 0..1 — confianza global del OCR
    motor: string,              // p.ej. "tesseract", "google-vision", "mock"
    textoCrudo: string,         // texto completo detectado (para fallback manual)

    comprobante: {
      tipocomprobante: string | null,  // "FACTURA" | "RECIBO" | ...
      numero: string | null,           // número de factura
      serie: string | null,
      uuid: string | null,             // UUID de factura electrónica (FEL)
      fechaemision: string | null,     // ISO 8601 (YYYY-MM-DD o ISO completo)
      nit: string | null
    },

    proveedor: {
      id: string | null,               // match contra BD si se envió proveedorId
      nit: string | null,
      nombre: string | null,           // nombre detectado en el documento
      coincidenciaNit: boolean         // true si el NIT detectado == proveedorId enviado
    },

    items: [
      {
        // --- Campos para "autocompletar" el formulario de ingreso ---
        productoid: string | null,     // UUID si el OCR logró mapear contra la BD
        productocodigo: string | null, // código tal como aparece en la factura
        descripcion: string,           // texto crudo de la línea
        cantidad: number | null,
        costounit: number | null,
        unidad: string | null,         // abreviatura, p.ej. "L", "KG", "QQ"

        // --- Metadatos de mapeo ---
        nivelConfianza: number,        // 0..1 por línea
        requiereRevision: boolean,     // true => el usuario DEBE validar el item
        candidatos: [                  // alternativas de producto para el selector
          { id: string, nombre: string, codigo: string, precioref: number | null }
        ]
      }
    ],

    advertencias: string[],          // p.ej. "No se pudo leer el NIT", "Importe total no coincide"
    requiereRevisionManual: boolean  // true si confianza < umbral o hay ítems sin mapear
  }
}
```

**Errores**

| Status | Cuándo | Body |
|---|---|---|
| 400 | Falta `archivo` (y `documento`) | `{ message: "El archivo de factura es obligatorio.", codigo: "ARCHIVO_REQUERIDO" }` |
| 400 | MIME no permitido (incluye PDF) | `{ message: "Formato no soportado. Use JPEG, PNG o WEBP.", codigo: "ARCHIVO_INVALIDO" }` |
| 400 | Archivo > 10 MB | `{ message: "El archivo supera el límite de 10 MB.", codigo: "ARCHIVO_INVALIDO" }` |
| 401 | Sin token | `{ message: "Acceso denegado: Token no proporcionado" }` |
| 403 | Rol ≠ ADMIN/BODEGUERO | `{ message: "Acceso denegado: no tiene permisos para este recurso" }` |
| 422 | OCR no logró extraer texto útil (< 12 caracteres alfanuméricos) | `{ message: "No se pudo leer el documento.", codigo: "OCR_SIN_TEXTO", escaneo: { textoCrudo, confianza } }` |
| 500 | Fallo del motor OCR | `{ message: "Error interno al procesar el escaneo." }` |

**Comportamiento del parser (contrato de facto)**

*Comprobante:*
- `tipocomprobante`: detecta `FACTURA`, `RECIBO`, `NOTA DE CREDITO`.
- `numero` / `serie`: reconoce `No. FACTURA: A-4521`, `FACTURA No 4521`, `SERIE A`. Un formato `A-4521` se separa en serie `A` y número `4521`.
- `uuid`: primer UUID con formato FEL (8-4-4-4-12), en mayúsculas.
- `fechaemision`: **siempre** se normaliza a `YYYY-MM-DD` (acepta `dd/mm/yyyy`, `dd-mm-yy`, `yyyy-mm-dd`).
- `nit`: busca `NIT: 1234567-8`; fallback al primer número con formato NIT.

*Proveedor* — resolución en este orden:
1. `proveedorId` del FormData (si no existe → `proveedor: null` + advertencia).
2. NIT normalizado (solo dígitos, ignora guiones) contra `proveedor.nit`.
3. Similitud difusa de nombre en las primeras 18 líneas (umbral **0.72**).

`coincidenciaNit` = `true` solo cuando el NIT del documento coincide con el del proveedor resuelto.
Si el NIT no existe en BD se devuelve `{ id: null, nit, nombre: null, coincidenciaNit: false }`.

*Ítems* — cada línea se intenta parsear como:
`CANTIDAD CODIGO DESCRIPCION COSTO` → `CANTIDAD DESCRIPCION COSTO` → `DESCRIPCION CANTIDAD COSTO TOTAL`.
Se ignoran líneas de `SUBTOTAL`, `IVA`, `TOTAL`, `NIT`, cabeceras de tabla, etc.

Matching de producto, en orden de prioridad:
1. **Código exacto** (con o sin guiones) → `nivelConfianza ≥ 0.97`, `requiereRevision: false`.
2. Código embebido dentro de la descripción.
3. **Similitud de nombre / ingrediente activo** → umbral **0.62**, `requiereRevision: true`.

`requiereRevision: true` si: no hubo match exacto, `nivelConfianza < 0.75`, faltan cantidad/costo, o no se mapeó producto.
`candidatos`: hasta **3** sugerencias ordenadas por score para el selector del frontend.
`requiereRevisionManual` (nivel documento): `confianza < 0.6`, sin ítems, o cualquier ítem con `requiereRevision`.

**Contrato de integración con `/ingreso`** — el frontend **nunca** debe enviar el resultado del OCR
directo a `/ingreso`. Debe:

1. Mapear cada `escaneo.items[i]` a `{ productoId, cantidad, costo, loteId }`.
2. Bloquear el submit mientras algún item tenga `requiereRevision = true` o `productoid = null`.
3. Enviar `comprobante.numero` / `comprobante.serie` en `factura` / `serie` para que aplique la
   validación anti-duplicado (§4.2), que responde **409** si la factura ya existe.

### 4.2 `POST /api/movimientos/ingreso` — contrato vigente

🔒 **ADMIN `|` BODEGUERO** (403 para cualquier otro rol).

**Request**

```ts
{
  bodegaId: string,              // UUID existente — OBLIGATORIO
  proveedorId?: string | null,   // UUID existente si se envía
  fecha?: string,                // ISO 8601. Default: now(). Inválida => now()
  tipoComprobante?: string,      // Default "FACTURA"
  factura?: string,              // número de factura (comprobante_fiscal.numero)
  serie?: string | null,
  uuid?: string | null,          // UUID de factura electrónica
  observaciones?: string,

  items: [{                      // 1..200 líneas — OBLIGATORIO
    productoId: string,          // UUID existente
    cantidad: number,            // > 0  (acepta "1,5" con coma decimal)
    costo?: number | null,       // >= 0. Vacío/null => se guarda 0
    loteId?: string | null       // UUID existente si se envía
  }]
}
```

**Validaciones (todas devuelven `400`/`404` con `{ message, codigo }`)**

| Código | Status | Regla |
|---|---|---|
| `BODEGA_REQUERIDA` | 400 | Falta `bodegaId` |
| `BODEGA_NO_ENCONTRADA` | 404 | `bodegaId` no existe en BD |
| `ITEMS_VACIOS` | 400 | `items` vacío o no es array |
| `ITEMS_LIMITE` | 400 | Más de 200 líneas |
| `PRODUCTO_ID_REQUERIDO` | 400 | Falta `productoId` en una línea |
| `PRODUCTO_ID_INVALIDO` | 400 | `productoId` sin formato UUID |
| `PRODUCTO_NO_ENCONTRADO` | 404 | Uno o más `productoId` no existen (se listan todos) |
| `CANTIDAD_INVALIDA` | 400 | `cantidad` ausente o no numérica |
| `CANTIDAD_NO_POSITIVA` | 400 | `cantidad <= 0` |
| `COSTO_INVALIDO` | 400 | `costo` enviado pero no numérico |
| `COSTO_NEGATIVO` | 400 | `costo < 0` |
| `LOTE_NO_ENCONTRADO` | 404 | `loteId` no existe |
| `PROVEEDOR_ID_INVALIDO` | 400 | `proveedorId` sin formato UUID |
| `PROVEEDOR_NO_ENCONTRADO` | 404 | `proveedorId` no existe |

> 📌 Los mensajes de línea incluyen el número de línea: `"Línea 2: la 'cantidad' debe ser mayor a 0."`

**Prevención de factura duplicada**

Si llegan `proveedorId` **y** `factura` (no vacía):

- Con `serie`: busca `comprobante_fiscal` cuyo `documento.proveedorid` = `proveedorId`
  **y** `numero` = `factura` **y** `serie` = `serie`.
- Sin `serie`: compara solo `(proveedorid, numero)`.

```http
409 Conflict
{ "message": "Esta factura ya fue registrada para este proveedor", "codigo": "FACTURA_DUPLICADA" }
```

**Respuesta — `201 Created`**

```ts
{
  ok: true,
  message: "Ingreso registrado correctamente",
  documento: {
    id: string,
    consecutivo: string,             // "ING-2026-0007"
    tipo: "INGRESO",
    estado: "APROBADO",              // nace aprobado: impacta stock de inmediato
    fecha: string,                   // ISO
    bodegaId: string,
    bodegaNombre: string,
    proveedorId: string | null,
    proveedorNombre: string | null,
    observaciones: string,
    creadorId: string,
    comprobanteFiscal: {             // null si no hubo proveedorId + factura
      id, tipocomprobante, numero, serie, nitemisor
    } | null,
    items: [{
      productoid: string,
      nombre: string,
      cantidad: number,
      costoUnitario: number,
      unidad: string,                // id de la unidad (compatibilidad: antes también era el id)
      loteId: string | null,
      preciorefActualizado: number   // producto.precioref (CPP) tras este ingreso, 2 decimales
    }]
  }
}
```

**Comportamiento de `precioref` — Costo Promedio Ponderado (CPP)**

- Por cada producto del ingreso se recalcula `producto.precioref` con:

  ```
  cppNuevo = ((stockPrevio * cppActual) + (cantidadIngreso * costounit))
             / (stockPrevio + cantidadIngreso)
  ```

  donde `stockPrevio` es el stock físico aprobado **antes** de insertar las líneas y
  `costounit` es el promedio ponderado de las líneas con costo > 0
  (`Σ cantidad_i * costo_i / Σ cantidad_i`).
- Si el mismo producto aparece en varias líneas, **todas** se ponderan en una sola pasada
  (a diferencia de la regla anterior del "último costo válido").
- Las líneas con costo `0`/omitido (bonificaciones, muestras) **no** diluyen el promedio.
- Si `stockPrevio <= 0` o el `precioref` actual es `null`/`0`, se arranca con `cppNuevo = costounit`.
- El resultado se redondea a 2 decimales (`Decimal(12, 2)`). Si excede la precisión de la columna,
  se conserva el `precioref` vigente.
- Si **todas** las líneas de un producto llegan con costo 0 (o sin costo), `precioref` **no** se
  sobrescribe. En ese caso `items[].preciorefActualizado` devuelve el `precioref` vigente.
- Ya **no** se calcula la **moda** de los últimos 10 ingresos aprobados (regla anterior, retirada).

**Otros errores**

| Status | Cuándo | Body |
|---|---|---|
| 401 | Sin token | `{ message: "Acceso denegado: Token no proporcionado" }` |
| 403 | Rol ≠ ADMIN/BODEGUERO | `{ message: "Acceso denegado: no tiene permisos para este recurso" }` |
| 400 | FK inválida detectada por Prisma (`P2003`) | `{ message: "Referencia inválida: ...", codigo: "REFERENCIA_INVALIDA" }` |
| 500 | Fallo inesperado | `{ message: "Error interno al registrar el ingreso." }` |

---

## Fincas y lotes – `/api/fincas` 🔒

> `authenticateToken` a nivel de router → **todas** requieren token.

| Método | Ruta | Rol escritura | Body | Descripción | Respuesta |
|---|---|---|---|---|---|
| GET | `/` | (autenticado) | – | Lista fincas con `stats` de lotes. | **array plano** `[{ id, nombre, ubicacion, stats }]` |
| POST | `/` | ADMIN/BODEGUERO/VISOR/COSECHA | `{ nombre, ubicacion }` | Crea finca. | finca |
| GET | `/:id/lotes` | (autenticado) | – | Lotes de una finca (incluye `cultivo` con `variedad`). | **array plano** |
| POST | `/:id/lotes` | ADMIN/BODEGUERO/VISOR/COSECHA | `{ codigo, cultivoid, areamanzanas, areametroslineales, areahectareas, estado }` | Crea lote. | lote |
| PATCH | `/lotes/:loteId` | ADMIN/BODEGUERO/VISOR/COSECHA | `areametroslineales` (recalcula áreas), `estado`, `descripcion`, `fechasiembra`, `fechacierre` | Edita lote. | lote |
| GET | `/fincas-lotes` | (autenticado) | – | Fincas con lotes **ABIERTOS** (filtrado: `SOLICITANTE` solo sus lotes asignados). Solo fincas con ≥1 lote. | **array plano** |

---

## Historial de lotes – `/api/lotes` 🔒

| Método | Ruta | Descripción | Respuesta |
|---|---|---|---|
| GET | `/` | Lista historial/dashboard de lotes (según usuario y rol). | objeto del servicio |
| GET | `/catalogo` | Catálogo de lotes (filtrado según usuario/rol). | **array plano** |
| GET | `/:id` | Historial/consumos de un lote. | detalle (403 permisos / 404 no encontrado) |
| GET | `/:id/export` | Exporta historial del lote. | PDF |

---

## Cosechas – `/api/cosechas` 🔒

> `POST /`, `GET /` y `GET /empacadoras` usan además el guard `soloCosechas` → **solo `ADMIN` y `COSECHA`** (403 en otro rol).
> `GET /cultivos` **no** aplica ese guard: cualquier usuario autenticado.

| Método | Ruta | Rol extra | Body | Descripción | Respuesta |
|---|---|---|---|---|---|
| POST | `/` | ADMIN/COSECHA | `{ loteId, fecha, libras_campo, libras_rechazo?, libras_vendidas?, observaciones?, empacadoraId?, numero_boleta?, boletas?: [{ empacadoraId, libras, numero_boleta? }] }` | Registra cosecha (`loteId`, `fecha`, `libras_campo` obligatorios). | `{ ok: true, cosecha }` (201) |
| GET | `/` | ADMIN/COSECHA | – | Lista cosechas. | **envuelto** `{ ok: true, cosechas: [...] }` |
| GET | `/empacadoras` | ADMIN/COSECHA | – | Catálogo de empacadoras activas. | **array plano** `[{ id, nombre }]` |
| GET | `/cultivos` | (autenticado) | – | Cultivos. | **array plano** `[{ id, nombre, variedad }]` |

---

## Edición crítica – `/api/edicion-critica` 🔒👑

| Método | Ruta | Body / Query | Descripción |
|---|---|---|---|
| POST | `/verificar-acceso` | `{ password }` | Reconfirma contraseña admin. |
| GET | `/documentos` | `page`, `limit`, `documentoId`, `tipo`, `productoId`, `fincaId`, `loteId`, `fechaInicio`, `fechaFin` | Busca documentos editables (paginado). |
| PATCH | `/documentos/:id` | `{ justificacion, cambios }` | Edita con justificación (auditoría). **`justificacion` mínimo 10 caracteres** (si no → 400). |

---

## Resumen de rutas públicas (sin token)

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/categorias`
- `GET /api/productos/categorias`, `/unidades`, `/productos-busqueda`, `/productos/buscar`
- `GET /api/proveedores/catalogo`

> 📌 `GET /api/movimientos/export`, `/api/movimientos/:id/export` **y** `GET /api/solicitudes/:id/export` **ya no son públicas**: ahora exigen token (🔒).

Todo lo demás requiere `Authorization: Bearer <token>`.

> ⚠️ **`/api/inventario/*` y `/api/fincas/*` completos son 🔒**, aunque algunas rutas de catálogo de otros módulos sean públicas. No hay un criterio uniforme histórico; guiarse por esta tabla.

---

## Notas para el frontend

1. **Login → guardar `{ token, user }`.** Enviar `Authorization: Bearer <token>` en todas las llamadas marcadas 🔒.
2. **Catálogos para selects** (recomendado):
   - Bodegas: `GET /api/inventario/bodegas` 🔒 → **array plano** `[{ id, nombre }]`. ⚠️ **Ya no existe** `/api/catalogos/bodegas`.
   - Fincas+lotes: `GET /api/fincas/fincas-lotes` 🔒 → **array plano**. ⚠️ **Ya no existe** `/api/catalogos/fincas-lotes`.
   - Empacadoras: `GET /api/cosechas/empacadoras` 🔒 (ADMIN/COSECHA) → array plano.
   - Cultivos: `GET /api/cosechas/cultivos` 🔒 → array plano.
   - Proveedores: `GET /api/proveedores/catalogo` → array plano.
   - Categorías: `GET /api/productos/categorias` → array plano.
   - Unidades: `GET /api/productos/unidades` → array plano.
3. **Rutas `/api/catalogos/*` eliminadas.** Reemplazos:

   | Ruta eliminada | Ruta actual |
   |---|---|
   | `GET /api/catalogos/fincas-lotes` | `GET /api/fincas/fincas-lotes` 🔒 |
   | `GET /api/catalogos/empacadoras` | `GET /api/cosechas/empacadoras` 🔒 |
   | `GET /api/catalogos/proveedores` | `GET /api/proveedores/catalogo` |
   | `GET /api/catalogos/bodegas` | `GET /api/inventario/bodegas` 🔒 |
   | `GET /api/catalogos/categorias` | `GET /api/productos/categorias` |
   | `GET /api/catalogos/unidades` | `GET /api/productos/unidades` |
   | `GET /api/catalogos/productos-busqueda` | `GET /api/productos/productos-busqueda` |
   | `GET /api/catalogos/productos/buscar` | `GET /api/productos/productos/buscar` |
   | `GET /api/catalogos/lotes` | `GET /api/lotes/catalogo` 🔒 |
   | `GET /api/catalogos/cultivos` | `GET /api/cosechas/cultivos` 🔒 |

4. **Array plano vs envuelto:** respetar el shape de la tabla de cada sección (p. ej. bodegas = array plano, inventario = `{ productos }`).
5. **401 vs 403:** sin token → 401; token inválido/expirado → 403; cuenta desactivada → 403.
6. **Nombres de campos:** se mezclan camelCase y minúsculas (`categoriaid`, `unidadid`, `loteid` vs `productoId`, `unidadId`). En solicitudes el backend acepta ambos.
7. **Sesiones:** el middleware revalida el usuario en BD en cada request (si lo desactivan, el token deja de servir aunque no haya expirado).

---

## Referencias

- Modelos y enums: `prisma/schema.prisma`.
- Estructura de carpetas y módulos: `ESTRUCTURA_PROYECTO.md`.

