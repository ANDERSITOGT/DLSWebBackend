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

Un `SOLICITANTE` solo ve las suyas (detalle ajeno → **403**).

| Método | Ruta | Auth | Body / Query | Descripción | Respuesta |
|---|---|---|---|---|---|
| GET | `/` | 🔒 | `estado`, `tipo` | Lista solicitudes (máx 50). | **envuelto** `{ solicitudes: [...] }` |
| GET | `/:id` | 🔒 | – | Detalle. | objeto detalle (`productos[]`, `bodega`, `solicitante`) |
| POST | `/` | 🔒 | `{ tipo, solicitanteId?, bodegaid?, fecha?, productos\|items: [{ productoId, unidadId?, cantidad, loteId?, notas? }] }` | Crea solicitud (DESPACHO o DEVOLUCION). | `{ ok: true, solicitud }` (201) |
| PATCH | `/:id/estado` | 🔒 | `{ estado }` | Aprueba/rechaza/etc. | detalle |
| POST | `/:id/entregar` | 🔒 | – | Genera documento SALIDA/DEVOLUCION, mueve inventario y marca ENTREGADA. | `{ solicitud, documentoId, codigoDoc }` |
| GET | `/:id/export` | – (público) | – | PDF de la solicitud. | `application/pdf` |

Notas del POST:
- Acepta tanto `productos` como `items` (mismo array).
- Acepta `productoId`/`productoid`, `unidadId`/`unidadid`, `loteId`/`loteid` (camelCase o minúsculas).
- Si falta `unidadId`, se toma la unidad del producto.
- `SOLICITANTE` con `loteId` sin asignación → **400** `"SEGURIDAD: No tienes permiso asignado para el lote ..."`.
- En DESPACHO se valida stock disponible → **400** `"Stock insuficiente para ..."`.
- No se puede duplicar una devolución activa para la misma solicitud origen.

---

## Movimientos – `/api/movimientos`

| Método | Ruta | Auth / Rol | Body | Descripción | Respuesta |
|---|---|---|---|---|---|
| POST | `/escanear` | 🔒 ADMIN/BODEGUERO | `multipart/form-data` (ver §4.1) | OCR de factura (tesseract.js `spa+eng`). | `200 { ok, escaneo }` |
| POST | `/ingreso` | 🔒 **ADMIN / BODEGUERO** | ver §4.2 | Ingreso de mercadería (recalcula `precioref` por moda). | `201 { ok, documento, message }` |
| POST | `/ajuste` | 🔒 ADMIN/BODEGUERO | `{ productoId, cantidad, notas, tipo }` | Ajuste de inventario. | `{ ok, documento }` |
| POST | `/devolucion-proveedor` | 🔒 ADMIN/BODEGUERO | `{ proveedorId, bodegaId, items: [{ productoId, cantidad, notas? }], notas }` | Devolución a proveedor. | `{ ok, documento }` |
| GET | `/` | 🔒 | – | Lista de movimientos/documentos. | **envuelto** `{ movimientos: [...] }` |
| GET | `/export` | – (público) | – | Exporta listado. | PDF |
| GET | `/:id` | 🔒 | – | Detalle del movimiento. | objeto detalle |
| GET | `/:id/export` | – (público) | – | Exporta detalle. | PDF |

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
      preciorefActualizado: number   // precio de referencia recalculado por moda (últimos 10 ingresos)
    }]
  }
}
```

**Comportamiento de `precioref`**

- Se recalcula por producto una sola vez por ingreso, con la **moda** de los últimos 10 costos de
  ingresos aprobados **más** el costo nuevo.
- Si **todas** las líneas de un producto llegaron sin costo, `precioref` **no** se sobrescribe
  (se conserva el vigente).

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
- `GET /api/solicitudes/:id/export`
- `GET /api/movimientos/export`, `/api/movimientos/:id/export`

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

