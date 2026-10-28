# Estructura explicada del proyecto DLS

## Alcance actual

Este repositorio contiene el **backend** del sistema de inventarios DLS. Expone una API HTTP para consultar y modificar usuarios, productos, inventario, solicitudes, movimientos y la información de fincas, lotes y cosechas.

> **Frontend:** no se encontró un frontend en este repositorio. No existen aquí componentes visuales, páginas, estilos ni archivos como `index.html`. El frontend probablemente está en otro repositorio o todavía debe construirse.

## Arquitectura actual

El backend utiliza una organización modular orientada al dominio. Cada módulo contiene sus rutas HTTP y, cuando aplica, sus servicios de negocio. La infraestructura compartida vive en `src/core/`.

```text
DelasierraWeb2/
├── .env
├── .gitignore
├── package.json
├── package-lock.json
├── tsconfig.json
├── ESTRUCTURA_PROYECTO.md
│
├── SQL/
│   ├── Migracion1.sql
│   └── Productos.sql
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│       ├── migration_lock.toml
│       ├── 20260825221958_linea_base_inicial/
│       │   └── migration.sql
│       ├── 20260826164529_agregar_dosis_producto/
│       │   └── migration.sql
│       └── 20261028111800_integracion_cosechas/
│           └── migration.sql
│
└── src/
    ├── index.ts
    ├── core/
    │   ├── constants.ts
    │   ├── prisma.ts
    │   ├── test.ts
    │   └── middlewares/
    │       └── auth.ts
    └── modules/
        ├── admin/
        │   ├── edicionCritica.ts
        │   └── edicionCriticaService.ts
        ├── agricultura/
        │   ├── cosechas.ts
        │   ├── cosechasService.ts
        │   ├── fincas.ts
        │   ├── historialLotes.ts
        │   ├── historialLotesService.ts
        │   └── lotesService.ts
        ├── auth/
        │   └── auth.ts
        ├── catalogos/
        │   └── proveedores.ts
        ├── dashboard/
        │   ├── inicio.ts
        │   └── inicioService.ts
        ├── inventario/
        │   ├── categorias.ts
        │   ├── categoriaService.ts
        │   ├── inventario.ts
        │   ├── inventarioService.ts
        │   ├── productos.ts
        │   └── productosService.ts
        ├── movimientos/
        │   ├── movimientos.ts
        │   └── movimientosService.ts
        ├── solicitudes/
        │   ├── solicitudes.ts
        │   └── solicitudesService.ts
        └── usuarios/
            ├── usuarios.ts
            └── usuariosService.ts
```

`node_modules/` se omite porque contiene dependencias instaladas, no código propio del sistema.

## Flujo de una solicitud

```text
Frontend futuro
      │ solicitudes HTTP/JSON
      ▼
src/index.ts
      │ registra middleware y prefijos /api/*
      ▼
src/modules/*/*.ts
      │ valida acceso, parámetros y respuestas HTTP
      ▼
servicios del módulo
      │ reglas de negocio y consultas
      ▼
src/core/prisma.ts
      │
      ▼
PostgreSQL mediante Prisma
```

1. `src/index.ts` crea el servidor Express.
2. Express habilita CORS y lectura de JSON.
3. Cada archivo de ruta dentro de `src/modules/` publica un grupo de endpoints.
4. `src/core/middlewares/auth.ts` valida los tokens Bearer y carga el usuario actual.
5. Las rutas llaman a servicios del mismo módulo para concentrar reglas de negocio.
6. `src/core/prisma.ts` exporta la instancia compartida de `PrismaClient`.
7. Prisma traduce las consultas de TypeScript a PostgreSQL.
8. Los documentos y reportes pueden exportarse a PDF mediante `pdfkit`.

## Archivos de configuración y raíz

| Archivo | Para qué sirve |
|---|---|
| `.env` | Variables privadas de ejecución, como `DATABASE_URL`, `JWT_SECRET` y el puerto. No debe publicarse ni incluirse en documentación con sus valores. |
| `.gitignore` | Indica qué archivos locales o generados no deben entrar a Git. |
| `package.json` | Define el backend, dependencias y comandos `dev`, `build` y `start`. |
| `package-lock.json` | Fija las versiones exactas instaladas por npm. |
| `tsconfig.json` | Configura TypeScript: código fuente en `src/`, salida compilada en `dist/`, modo estricto y compatibilidad CommonJS/Node. |
| `ESTRUCTURA_PROYECTO.md` | Esta guía de contexto y documentación del árbol del backend. |

### Comandos disponibles

```bash
npm run dev    # Desarrollo con recarga automática
npm run build  # Genera el cliente Prisma y compila TypeScript en dist/
npm start      # Ejecuta el backend compilado
npx tsc --noEmit # Verifica tipos sin generar archivos
```

## Carpeta `src/`

### Archivos base

| Archivo | Responsabilidad |
|---|---|
| `src/index.ts` | Punto de entrada. Configura Express, CORS, JSON, los prefijos `/api/*`, el health check `/api/health` y el puerto. |
| `src/core/prisma.ts` | Crea y exporta la instancia compartida de `PrismaClient`; también contiene `connectDB()`. |
| `src/core/constants.ts` | Expone constantes compartidas para estados y tipos de solicitudes/documentos usados por los servicios. |
| `src/core/test.ts` | Script pequeño para probar una consulta a `unidad`. No es una suite automatizada de pruebas. |

### `src/core/middlewares/`

| Archivo | Responsabilidad |
|---|---|
| `auth.ts` | Lee el token Bearer, valida el JWT y vuelve a consultar al usuario en la base de datos. Guarda el usuario actual en `req.user`. |

## Módulos y endpoints

Los prefijos se registran en `src/index.ts`. Las rutas protegidas requieren:

```http
Authorization: Bearer <token>
```

| Archivo y prefijo | Qué administra | Endpoints principales |
|---|---|---|
| `auth/auth.ts` — `/api/auth` | Inicio de sesión y emisión de JWT. | `POST /login` |
| `dashboard/inicio.ts` — `/api/inicio` | Datos resumidos para tableros según el rol. | `GET /bodeguero`, `/solicitante`, `/admin` |
| `inventario/inventario.ts` — `/api/inventario` | Consulta del inventario, bodegas y exportación general. | `GET /`, `/bodegas`, `/categorias`, `/pdf`, `/:id` |
| `inventario/productos.ts` — `/api/productos` | Alta, edición, catálogos y búsquedas de productos. | `POST /`, `PATCH /:id`, `GET /categorias`, `/unidades`, `/productos-busqueda`, `/productos/buscar` |
| `inventario/categorias.ts` — `/api/categorias` | Consulta de categorías mediante `categoriaService`. | `GET /` |
| `movimientos/movimientos.ts` — `/api/movimientos` | Entradas, ajustes, devoluciones y documentos de inventario. | `POST /ingreso`, `/ajuste`, `/devolucion-proveedor`; `GET /`, `/export`, `/:id`, `/:id/export` |
| `solicitudes/solicitudes.ts` — `/api/solicitudes` | Solicitudes, estados, entregas y PDF. | `GET /`, `/:id`; `POST /`, `/:id/entregar`; `PATCH /:id/estado`; `GET /:id/export` |
| `catalogos/proveedores.ts` — `/api/proveedores` | Proveedores y contactos. | `GET /`, `/catalogo`; `POST /`, `PATCH /:id`, `POST /:id/contactos`, `DELETE /contactos/:contactoId` |
| `usuarios/usuarios.ts` — `/api/usuarios` | Administración de cuentas y asignación de lotes. | `GET /`, `POST /`, `PATCH /:id/toggle-status`, `PATCH /:id/reset-password`, `GET /solicitantes-asignacion`, `POST /:id/asignar-lotes` |
| `agricultura/fincas.ts` — `/api/fincas` | Fincas y lotes agrícolas. | `GET /`, `/fincas-lotes`; `POST /`, `GET /:id/lotes`, `POST /:id/lotes`, `PATCH /lotes/:loteId` |
| `agricultura/historialLotes.ts` — `/api/lotes` | Dashboard, catálogo, historial y exportación de lotes. | `GET /`, `/catalogo`, `/:id`, `/:id/export` |
| `agricultura/cosechas.ts` — `/api/cosechas` | Registro y consulta de cosechas, empacadoras y cultivos. | `POST /`, `GET /`, `/empacadoras`, `/cultivos` |
| `admin/edicionCritica.ts` — `/api/edicion-critica` | Operaciones administrativas sensibles sobre documentos. | `GET /documentos`, `POST /verificar-acceso`, `PATCH /documentos/:id` |

### Rutas trasladadas desde el módulo genérico de catálogos

El archivo `src/modules/catalogos/catalogos.ts` fue eliminado. Sus endpoints quedaron distribuidos por dominio:

| Ruta anterior | Ruta actual |
|---|---|
| `GET /api/catalogos/fincas-lotes` | `GET /api/fincas/fincas-lotes` |
| `GET /api/catalogos/empacadoras` | `GET /api/cosechas/empacadoras` |
| `GET /api/catalogos/proveedores` | `GET /api/proveedores/catalogo` |
| `GET /api/catalogos/bodegas` | `GET /api/inventario/bodegas` |
| `GET /api/catalogos/categorias` | `GET /api/productos/categorias` |
| `GET /api/catalogos/unidades` | `GET /api/productos/unidades` |
| `GET /api/catalogos/productos-busqueda` | `GET /api/productos/productos-busqueda` |
| `GET /api/catalogos/productos/buscar` | `GET /api/productos/productos/buscar` |
| `GET /api/catalogos/lotes` | `GET /api/lotes/catalogo` |
| `GET /api/catalogos/cultivos` | `GET /api/cosechas/cultivos` |

La ruta de proveedores usa `/catalogo` porque `GET /api/proveedores/` ya corresponde al listado administrativo completo de proveedores.

## Servicios por módulo

Los servicios viven junto a sus rutas y separan la lógica de negocio de la capa HTTP.

| Archivo | Responsabilidad |
|---|---|
| `modules/inventario/categoriaService.ts` | Consulta y preparación de categorías. |
| `modules/dashboard/inicioService.ts` | Calcula los datos de los tableros por rol y periodos de tiempo. |
| `modules/inventario/inventarioService.ts` | Construye el inventario, calcula estados de stock y obtiene detalles de productos. |
| `modules/movimientos/movimientosService.ts` | Centraliza datos y generación de PDFs de movimientos. |
| `modules/solicitudes/solicitudesService.ts` | Lista solicitudes, obtiene detalles, crea solicitudes, cambia estados y genera PDFs. |
| `modules/inventario/productosService.ts` | Crea y actualiza productos con sus datos relacionados. |
| `modules/usuarios/usuariosService.ts` | Consulta solicitantes y gestiona la asignación de lotes. |
| `modules/agricultura/lotesService.ts` | Obtiene lotes filtrados según usuario y rol para catálogos/asignaciones. |
| `modules/agricultura/historialLotesService.ts` | Consulta dashboard, detalle, historial, costos y exportación PDF de lotes. |
| `modules/agricultura/cosechasService.ts` | Registra y consulta cosechas y sus boletas. |
| `modules/admin/edicionCriticaService.ts` | Recalcula y expone información para la edición administrativa de documentos. |

`lotesService.ts` y `historialLotesService.ts` se mantienen separados porque tienen responsabilidades diferentes: el primero es un catálogo de lotes y el segundo gestiona análisis, permisos, historial y exportación.

## Carpeta `prisma/`

### `schema.prisma`

Es la definición tipada de la base de datos PostgreSQL. Prisma usa este archivo para generar el cliente importado desde `src/core/prisma.ts`.

Modelos principales:

| Modelo | Representa |
|---|---|
| `usuario` | Cuentas, roles, estado activo y relaciones con operaciones. |
| `auditoria` | Registro de acciones realizadas sobre entidades. |
| `producto` | Artículos controlados por inventario. |
| `categoria` | Clasificación de productos. |
| `unidad` | Unidades de medida. |
| `bodega` | Almacenes de origen o destino. |
| `ubicacion` | Ubicaciones internas dentro de una bodega. |
| `documento` | Cabecera de entradas, ajustes, devoluciones y movimientos. |
| `documento_item` | Líneas de producto, cantidad, costo, ubicación y lote. |
| `solicitud` / `solicitud_item` | Solicitudes de productos y sus líneas. |
| `proveedor` / `proveedor_contacto` | Proveedores y contactos. |
| `finca` | Fincas agrícolas. |
| `lote` | Lotes pertenecientes a una finca y asociados a un cultivo. |
| `lote_encargado` | Asignación de usuarios responsables de lotes. |
| `cultivo` | Cultivo y variedad de un lote. |
| `cosecha` | Producción registrada para un lote. |
| `boleta_cosecha` | Envío de cosecha a una empacadora. |
| `empacadora` | Destino o entidad que recibe cosechas. |
| `comprobante_fiscal` | Información fiscal asociada a un documento. |
| `consecutivo` | Consecutivos por tipo de documento y año. |

Los enums controlan estados y categorías cerradas: `estado_documento`, `estado_lote`, `estado_solicitud`, `rol`, `tipo_documento` y `tipo_solicitud`.

### `seed.ts`

Carga datos iniciales si no existen: unidades de medida, categorías y un usuario administrador de respaldo.

### `migrations/`

Contiene el historial versionado de cambios estructurales de la base de datos. Las migraciones deben ejecutarse con las herramientas de Prisma y no editarse manualmente después de aplicadas en un entorno compartido.

## Carpeta `SQL/`

Estos archivos son scripts manuales de apoyo; no sustituyen el flujo de migraciones de Prisma.

| Archivo | Para qué sirve |
|---|---|
| `Migracion1.sql` | Convierte `producto.codigoalt` de texto a entero y agrega una restricción de unicidad. |
| `Productos.sql` | Inserta un catálogo amplio de productos. |

## Lectura rápida por módulo

```text
Seguridad
  core/middlewares/auth.ts
  modules/auth/auth.ts
  modules/usuarios/usuarios.ts + usuariosService.ts

Catálogos e inventario
  modules/inventario/*
  modules/catalogos/proveedores.ts
  core/constants.ts

Movimientos
  modules/movimientos/movimientos.ts + movimientosService.ts
  documento + documento_item + producto + bodega + ubicacion

Solicitudes
  modules/solicitudes/solicitudes.ts + solicitudesService.ts
  solicitud + solicitud_item + documento

Agricultura
  modules/agricultura/fincas.ts
  modules/agricultura/historialLotes.ts
  modules/agricultura/cosechas.ts
  lotesService.ts + historialLotesService.ts + cosechasService.ts
  finca + lote + cultivo + cosecha + boleta_cosecha + empacadora

Administración y dashboard
  modules/dashboard/inicio.ts + inicioService.ts
  modules/admin/edicionCritica.ts + edicionCriticaService.ts
  auditoria
```

## Qué faltaría para documentar el frontend

Para documentar la parte visual con el mismo nivel sería necesario tener el repositorio del frontend o agregarlo aquí. Allí se describirían las páginas, componentes, formularios, cliente HTTP, manejo del JWT, rutas de navegación y estilos.
