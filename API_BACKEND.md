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

| Método | Ruta | Auth / Rol | Body | Descripción | Respuesta |
|---|---|---|---|---|---|
| GET | `/` | 🔒 ADMIN/BODEGUERO | – | Lista proveedores con contactos. | **array plano** `[{ ...proveedor, proveedor_contacto: [] }]` |
| GET | `/catalogo` | – (público) | – | Catálogo liviano (selects). | **array plano** `[{ id, nombre, nit }]` |
| POST | `/` | 🔒 ADMIN/BODEGUERO | `{ nombre, nit, notas }` | Crea proveedor. | proveedor (201) |
| PATCH | `/:id` | 🔒 ADMIN/BODEGUERO | `{ nit, notas }` | Edita proveedor. | proveedor |
| POST | `/:id/contactos` | 🔒 ADMIN/BODEGUERO | `{ nombre, telefono, email, puesto, notas }` | Agrega contacto. | contacto (201) |
| DELETE | `/contactos/:contactoId` | 🔒 ADMIN/BODEGUERO | – | Elimina contacto. | `{ success: true }` |

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
| POST | `/ingreso` | 🔒 | `{ bodegaId, proveedorId, fecha, tipoComprobante, factura, serie, uuid, observaciones, items: [{ productoId, cantidad, costo, loteId? }] }` | Ingreso de mercadería (recalcula `precioref` por moda). | `{ ok, documento, message }` |
| POST | `/ajuste` | 🔒 ADMIN/BODEGUERO | `{ productoId, cantidad, notas, tipo }` | Ajuste de inventario. | `{ ok, documento }` |
| POST | `/devolucion-proveedor` | 🔒 ADMIN/BODEGUERO | `{ proveedorId, bodegaId, items: [{ productoId, cantidad, notas? }], notas }` | Devolución a proveedor. | `{ ok, documento }` |
| GET | `/` | 🔒 | – | Lista de movimientos/documentos. | **envuelto** `{ movimientos: [...] }` |
| GET | `/export` | – (público) | – | Exporta listado. | PDF |
| GET | `/:id` | 🔒 | – | Detalle del movimiento. | objeto detalle |
| GET | `/:id/export` | – (público) | – | Exporta detalle. | PDF |

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

