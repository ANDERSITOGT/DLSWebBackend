# DLS Backend – Contexto rápido de la API

Backend de inventarios agrícola (Node + Express + TypeScript + Prisma/PostgreSQL). Solo API, sin frontend.

- **Base URL:** `http://localhost:3001` (o `PORT` en producción). Prefijo `/api`.
- **Formato:** JSON (`Content-Type: application/json`). CORS abierto (`*`).
- **Auth:** `POST /api/auth/login` devuelve un JWT (expira en 150 días). Enviarlo en `Authorization: Bearer <token>`.
  Marcado con 🔒 = requiere token. 👑 = además solo ADMIN. Sin marca = ruta pública (sin token).
- **Roles:** `ADMIN`, `BODEGUERO`, `SOLICITANTE`, `VISOR`.
- **Enums:** estado_solicitud `PENDIENTE|APROBADA|RECHAZADA|ENTREGADA` · tipo_solicitud `DESPACHO|DEVOLUCION` · tipo_documento `INGRESO|SALIDA|TRANSFERENCIA|AJUSTE|DEVOLUCION|SOLICITUD` · estado_documento `BORRADOR|APROBADO|ANULADO` · estado_lote `ABIERTO|CERRADO`.
- **Errores:** `{ "message": "..." }` con 400/401/403/404/500.

## Salud
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Verifica servidor/BD. |

## Auth – `/api/auth`
| Método | Ruta | Body | Descripción |
|---|---|---|---|
| POST | `/login` | `{ email, password }` | Devuelve token y datos del usuario (incluye `rol`). |

## Dashboard – `/api/inicio` (sin token)
| GET | `/bodeguero` | Resumen para bodeguero |
|---|---|---|
| GET | `/solicitante` | Resumen para solicitante |
| GET | `/admin` | Resumen para admin |

## Usuarios – `/api/usuarios` 🔒
| Método | Ruta | Body | Descripción |
|---|---|---|---|
| POST | `/verificar-acceso` | `{ password }` | Valida la contraseña del usuario actual. |
| GET | `/` 👑 | – | Lista usuarios. |
| POST | `/` 👑 | `{ nombre, email, password, rol }` | Crea usuario. |
| PATCH | `/:id/toggle-status` 👑 | – | Activa/desactiva (no a otros ADMIN). |
| PATCH | `/:id/reset-password` 👑 | `{ newPassword }` | Resetea contraseña. |
| GET | `/solicitantes-asignacion` 👑 | – | Solicitantes con lotes asignados. |
| POST | `/:id/asignar-lotes` 👑 | `{ lotesIds: string[] }` | Asigna lotes a un solicitante. |

## Inventario – `/api/inventario` (sin token)
| Método | Ruta | Query | Descripción |
|---|---|---|---|
| GET | `/` | `limit`, `search`, `categoria` | Stock de productos. |
| GET | `/categorias` | – | Categorías para filtros. |
| GET | `/bodegas` | – | Bodegas. |
| GET | `/pdf` | (filtros) | Reporte de inventario en PDF. |
| GET | `/:id` | – | Detalle de un producto en inventario. |

## Categorías – `/api/categorias`
| GET | `/` | Lista de categorías. |
|---|---|---|

## Productos – `/api/productos`
| Método | Ruta | Body / Query | Descripción |
|---|---|---|---|
| POST 🔒 | `/` | `{ nombre, categoriaid, unidadid, ingredienteactivo?, precioref? }` | Crea producto (código automático). |
| PATCH 🔒 | `/:id` | `{ nombre?, codigo?, categoriaid?, unidadid?, ingredienteactivo?, precioref?, activo? }` | Edita producto. |
| GET | `/categorias` | – | Categorías. |
| GET | `/unidades` | – | Unidades de medida. |
| GET | `/productos-busqueda` | `q` | Búsqueda de productos. |
| GET | `/productos/buscar` | `q` | Búsqueda alterna. |

## Proveedores – `/api/proveedores`
Roles permitidos en escritura: ADMIN, BODEGUERO.
| Método | Ruta | Body | Descripción |
|---|---|---|---|
| GET 🔒 | `/` | – | Lista proveedores con contactos. |
| GET | `/catalogo` | – | Catálogo liviano (selects). |
| POST 🔒 | `/` | `{ nombre, nit, notas }` | Crea proveedor. |
| PATCH 🔒 | `/:id` | `{ nit, notas }` | Edita proveedor. |
| POST 🔒 | `/:id/contactos` | `{ nombre, telefono, email, puesto, notas }` | Agrega contacto. |
| DELETE 🔒 | `/contactos/:contactoId` | – | Elimina contacto. |

## Solicitudes – `/api/solicitudes`
Un SOLICITANTE solo ve las suyas.
| Método | Ruta | Body / Query | Descripción |
|---|---|---|---|
| GET 🔒 | `/` | `estado`, `tipo` | Lista solicitudes. |
| GET 🔒 | `/:id` | – | Detalle. |
| POST 🔒 | `/` | `{ tipo, solicitanteId?, productos\|items: [{ productoId, unidadId?, cantidad, loteId?, notas? }], ...}` | Crea solicitud (DESPACHO o DEVOLUCION). |
| PATCH 🔒 | `/:id/estado` | `{ estado }` | Aprueba/rechaza etc. |
| POST 🔒 | `/:id/entregar` | – | Entrega: genera documento SALIDA/DEVOLUCION con consecutivo, mueve inventario y marca ENTREGADA. |
| GET | `/:id/export` | – | PDF de la solicitud. |

## Movimientos – `/api/movimientos`
| Método | Ruta | Body | Descripción |
|---|---|---|---|
| POST 🔒 | `/ingreso` | `{ bodegaId, proveedorId, fecha, tipoComprobante, factura, serie, uuid, observaciones, items[] }` | Ingreso de mercadería. |
| POST 🔒 | `/ajuste` | `{ productoId, cantidad, notas, tipo }` | Ajuste de inventario (según rol). |
| POST 🔒 | `/devolucion-proveedor` | `{ proveedorId, bodegaId, items[], notas }` | Devolución a proveedor. |
| GET 🔒 | `/` | – | Lista de movimientos/documentos. |
| GET | `/export` | – | Exporta listado. |
| GET 🔒 | `/:id` | – | Detalle del movimiento. |
| GET | `/:id/export` | – | Exporta detalle (PDF). |

## Fincas y lotes – `/api/fincas` 🔒 (roles ADMIN, BODEGUERO, VISOR)
| Método | Ruta | Body | Descripción |
|---|---|---|---|
| GET | `/` | – | Lista fincas. |
| POST | `/` | `{ nombre, ubicacion }` | Crea finca. |
| GET | `/:id/lotes` | – | Lotes de una finca (con cultivo/variedad). |
| POST | `/:id/lotes` | `{ codigo, cultivoid, areamanzanas, areametroslineales, areahectareas, estado }` | Crea lote. |
| PATCH | `/lotes/:loteId` | campos del lote | Edita lote. |
| GET | `/fincas-lotes` | – | Fincas con lotes (filtrado según rol/asignación). |

## Historial de lotes – `/api/lotes` 🔒
| GET | `/` | Lista historial de lotes (según usuario/rol). |
|---|---|---|
| GET | `/catalogo` | Catálogo de lotes. |
| GET | `/:id` | Historial/consumos de un lote. |
| GET | `/:id/export` | Exporta historial. |

## Cosechas – `/api/cosechas` 🔒
| Método | Ruta | Body | Descripción |
|---|---|---|---|
| POST | `/` | `{ loteId, fecha, libras_campo, libras_rechazo?, libras_vendidas?, observaciones?, empacadoraId?, numero_boleta?, boletas?[] }` | Registra cosecha (`loteId`, `fecha`, `libras_campo` obligatorios). |
| GET | `/` | – | Lista cosechas. |
| GET | `/empacadoras` | – | Catálogo de empacadoras. |
| GET | `/cultivos` | – | Cultivos. |

## Edición crítica – `/api/edicion-critica` 🔒👑
| Método | Ruta | Body / Query | Descripción |
|---|---|---|---|
| POST | `/verificar-acceso` | `{ password }` | Reconfirma contraseña admin. |
| GET | `/documentos` | `page`, `limit`, `documentoId`, `tipo`, `productoId`, `fincaId`, `loteId`, `fechaInicio`, `fechaFin` | Busca documentos editables (paginado). |
| PATCH | `/documentos/:id` | `{ justificacion, cambios }` | Edita un documento con justificación (auditoría). |

## Notas
- Varias rutas GET de exportación/inventario/dashboard no exigen token actualmente.
- Los nombres de campos mezclan camelCase y minúsculas (`categoriaid`, `unidadid`); algunas rutas aceptan ambos.
- Detalle de modelos: `prisma/schema.prisma`. Estructura de carpetas: `ESTRUCTURA_PROYECTO.md`.
