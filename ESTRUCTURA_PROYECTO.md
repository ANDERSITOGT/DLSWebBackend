# Estructura explicada del proyecto DLS

## Alcance actual

Este repositorio contiene el **backend** del sistema de inventarios DLS. El backend expone una API HTTP para que un frontend pueda consultar y modificar usuarios, productos, inventario, solicitudes, movimientos y la información de fincas/lotes.

> **Frontend:** no se encontró un frontend en este repositorio. No existen aquí componentes visuales, páginas, estilos ni archivos como `index.html`. El frontend probablemente está en otro repositorio o todavía debe construirse.

## Árbol del proyecto

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
    ├── prisma.ts
    ├── test.ts
    ├── middlewares/
    │   └── auth.ts
    ├── routes/
    │   ├── auth.ts
    │   ├── catalogos.ts
    │   ├── categorias.ts
    │   ├── edicionCritica.ts
    │   ├── fincas.ts
    │   ├── historialLotes.ts
    │   ├── inicio.ts
    │   ├── inventario.ts
    │   ├── movimientos.ts
    │   ├── productos.ts
    │   ├── proveedores.ts
    │   ├── solicitudes.ts
    │   └── usuarios.ts
    └── services/
        ├── categoriaService.ts
        ├── edicionCriticaService.ts
        ├── historialLotesService.ts
        ├── inicioService.ts
        ├── inventarioService.ts
        ├── lotesService.ts
        ├── movimientosService.ts
        ├── productosService.ts
        ├── solicitudesService.ts
        └── usuariosService.ts
```

`node_modules/` se omite del árbol porque contiene dependencias instaladas, no código propio del sistema.

## Cómo funciona el backend

El flujo general es:

```text
Frontend futuro
      │ solicitudes HTTP/JSON
      ▼
src/index.ts
      │ registra middleware y prefijos /api/*
      ▼
src/routes/*.ts
      │ valida acceso y recibe parámetros
      ▼
src/services/*.ts  ──────►  src/prisma.ts
      │                          │
      └──────────────────────────┘
                                 ▼
                         PostgreSQL mediante Prisma
```

1. `src/index.ts` crea el servidor Express.
2. Express habilita CORS y lectura de JSON.
3. Cada archivo de `routes/` publica un grupo de endpoints.
4. `auth.ts` protege los endpoints que requieren sesión.
5. Las rutas llaman a servicios para concentrar reglas de negocio.
6. Prisma traduce las consultas de TypeScript a PostgreSQL.
7. Los documentos y reportes pueden exportarse a PDF mediante `pdfkit`.

## Archivos de configuración y raíz

| Archivo | Para qué sirve |
|---|---|
| `.env` | Variables privadas de ejecución, como `DATABASE_URL`, `JWT_SECRET` y el puerto. No debe publicarse ni incluirse en documentación con sus valores. |
| `.gitignore` | Indica qué archivos locales o generados no deben entrar a Git. |
| `package.json` | Define el nombre del backend, dependencias y comandos `dev`, `build` y `start`. |
| `package-lock.json` | Fija las versiones exactas instaladas por npm para que las instalaciones sean reproducibles. |
| `tsconfig.json` | Configura TypeScript: código fuente en `src/`, salida compilada en `dist/`, modo estricto y compatibilidad CommonJS/Node. |
| `ESTRUCTURA_PROYECTO.md` | Esta guía de contexto y documentación del árbol del backend. |

### Comandos disponibles

```bash
npm run dev    # Desarrollo con recarga automática
npm run build  # Genera el cliente Prisma y compila TypeScript en dist/
npm start      # Ejecuta el backend compilado
```

## Carpeta `src/`

### Archivos base

| Archivo | Responsabilidad |
|---|---|
| `src/index.ts` | Punto de entrada. Configura Express, CORS, JSON, las rutas `/api/*`, el health check `/api/health` y el puerto del servidor. |
| `src/prisma.ts` | Crea y exporta la instancia compartida de `PrismaClient`; también contiene `connectDB()` para comprobar la conexión. |
| `src/test.ts` | Script pequeño para probar una consulta a la tabla `unidad`. No es una suite automatizada de pruebas. |

### `src/middlewares/`

| Archivo | Responsabilidad |
|---|---|
| `auth.ts` | Lee el token Bearer, valida el JWT y vuelve a consultar al usuario en la base de datos. Así puede revocar el acceso si la cuenta fue desactivada. Guarda el usuario actual en `req.user`. |

### `src/routes/`

Las rutas son la capa HTTP. El prefijo indicado se agrega en `src/index.ts`.

| Archivo y prefijo | Qué administra | Endpoints principales |
|---|---|---|
| `auth.ts` — `/api/auth` | Inicio de sesión y emisión de JWT. | `POST /login` |
| `inicio.ts` — `/api/inicio` | Datos resumidos para los tableros según el rol. | `GET /bodeguero`, `/solicitante`, `/admin` |
| `inventario.ts` — `/api/inventario` | Consulta del inventario y exportación general. | `GET /`, `/categorias`, `/pdf`, `/:id` |
| `movimientos.ts` — `/api/movimientos` | Entradas, ajustes, devoluciones y consulta de documentos de inventario. | `POST /ingreso`, `/ajuste`, `/devolucion-proveedor`; `GET /`, `/export`, `/:id`, `/:id/export` |
| `solicitudes.ts` — `/api/solicitudes` | Solicitudes de productos, estados, entrega y PDF. | `GET /`, `/:id`; `POST /`, `/:id/entregar`; `PATCH /:id/estado`; `GET /:id/export` |
| `productos.ts` — `/api/productos` | Alta y edición de productos. | `POST /`, `PATCH /:id` |
| `categorias.ts` — `/api/categorias` | Consulta de categorías mediante `categoriaService`. | `GET /` |
| `catalogos.ts` — `/api/catalogos` | Catálogos auxiliares usados por formularios y búsquedas. | `GET /lotes`, `/fincas-lotes`, `/bodegas`, `/proveedores`, `/categorias`, `/unidades`, `/productos-busqueda`, `/productos/buscar`, `/cultivos` |
| `proveedores.ts` — `/api/proveedores` | Proveedores y sus contactos. | `GET /`, `POST /`, `PATCH /:id`, `POST /:id/contactos`, `DELETE /contactos/:contactoId` |
| `usuarios.ts` — `/api/usuarios` | Administración de cuentas, estados, contraseñas y asignación de lotes. | `GET /`, `POST /`, `PATCH /:id/toggle-status`, `PATCH /:id/reset-password`, `GET /solicitantes-asignacion`, `POST /:id/asignar-lotes` |
| `fincas.ts` — `/api/fincas` | Fincas y lotes agrícolas. | `GET /`, `POST /`, `GET /:id/lotes`, `POST /:id/lotes`, `PATCH /lotes/:loteId` |
| `historialLotes.ts` — `/api/lotes` | Historial de un lote y sus cosechas, incluyendo exportación. | `GET /`, `/:id`, `/:id/export` |
| `edicionCritica.ts` — `/api/edicion-critica` | Operaciones administrativas sensibles sobre documentos. | `GET /documentos`, `POST /verificar-acceso`, `PATCH /documentos/:id` |

Los endpoints que muestran `authenticateToken` requieren el encabezado:

```http
Authorization: Bearer <JWT>
```

Las operaciones administrativas además comprueban que el usuario tenga rol de administrador.

### `src/services/`

Los servicios separan la lógica de negocio de la capa HTTP. Aquí se calculan existencias, estados, filtros, transacciones y reportes.

| Archivo | Responsabilidad |
|---|---|
| `categoriaService.ts` | Consulta y preparación de categorías. |
| `inicioService.ts` | Calcula los datos de los tableros de inicio por rol y por periodos de tiempo. |
| `inventarioService.ts` | Construye el inventario, calcula estados de stock y obtiene el detalle de productos. |
| `movimientosService.ts` | Genera PDFs y centraliza datos de movimientos/documentos. |
| `solicitudesService.ts` | Lista solicitudes, obtiene detalles, crea solicitudes, cambia estados y genera PDFs. |
| `productosService.ts` | Crea y actualiza productos con sus datos relacionados. |
| `usuariosService.ts` | Consulta solicitantes y gestiona la asignación de lotes. |
| `lotesService.ts` | Obtiene lotes filtrados según usuario y rol. |
| `historialLotesService.ts` | Consulta el historial de lotes y sus cosechas. |
| `edicionCriticaService.ts` | Recalcula y expone información para la edición administrativa de documentos. |

## Carpeta `prisma/`

### `schema.prisma`

Es la definición tipada de la base de datos PostgreSQL. Prisma usa este archivo para generar el cliente que se importa desde `src/prisma.ts`.

Modelos principales:

| Modelo | Representa |
|---|---|
| `usuario` | Cuentas, roles, estado activo y relaciones con operaciones del sistema. |
| `auditoria` | Registro de acciones realizadas sobre entidades, incluyendo usuario, fecha, IP y payload. |
| `producto` | Artículos controlados por inventario, categoría, unidad, códigos y dosis. |
| `categoria` | Clasificación de productos. |
| `unidad` | Unidades de medida como litros, kilogramos o unidades. |
| `bodega` | Almacenes de origen o destino. |
| `ubicacion` | Ubicaciones internas dentro de una bodega. |
| `documento` | Cabecera de entradas, ajustes, devoluciones y otros movimientos. |
| `documento_item` | Líneas de producto, cantidad, costo, ubicación y lote de un documento. |
| `solicitud` / `solicitud_item` | Solicitudes de productos y sus líneas. |
| `proveedor` / `proveedor_contacto` | Proveedores y personas de contacto. |
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

Carga datos iniciales si no existen: unidades de medida, categorías y un usuario administrador de respaldo. Se ejecuta mediante la configuración `prisma.seed` de `package.json`.

### `migrations/`

Contiene el historial versionado de cambios estructurales de la base de datos:

- `migration_lock.toml`: identifica el proveedor de base de datos usado por Prisma.
- `20260825221958_linea_base_inicial/migration.sql`: línea base inicial.
- `20260826164529_agregar_dosis_producto/migration.sql`: agrega soporte para dosis de productos.
- `20261028111800_integracion_cosechas/migration.sql`: integra el módulo de cosechas, empacadoras y boletas.

Las migraciones deben ejecutarse con las herramientas de Prisma y no editarse manualmente después de aplicadas en un entorno compartido.

## Carpeta `SQL/`

Estos archivos son scripts manuales de apoyo; no sustituyen el flujo de migraciones de Prisma.

| Archivo | Para qué sirve |
|---|---|
| `Migracion1.sql` | Convierte `producto.codigoalt` de texto a entero y agrega una restricción de unicidad. Debe ejecutarse solo después de comprobar que los valores existentes son números válidos. |
| `Productos.sql` | Inserta un catálogo amplio de productos, con categoría, unidad, códigos e ingrediente activo. |

## Lectura rápida por módulo

```text
Usuarios y seguridad
  auth.ts + middlewares/auth.ts + usuarios.ts + usuariosService.ts

Catálogo
  productos.ts + categorias.ts + catalogos.ts + proveedores.ts

Inventario
  inventario.ts + movimientos.ts
  inventarioService.ts + movimientosService.ts
  documento + documento_item + producto + bodega + ubicacion

Solicitudes
  solicitudes.ts + solicitudesService.ts
  solicitud + solicitud_item + documento

Agricultura
  fincas.ts + historialLotes.ts
  lotesService.ts + historialLotesService.ts
  finca + lote + cultivo + cosecha + boleta_cosecha + empacadora

Administración
  inicio.ts + edicionCritica.ts
  inicioService.ts + edicionCriticaService.ts + auditoria
```

## Qué faltaría para documentar el frontend

Para documentar la parte visual con el mismo nivel sería necesario tener el repositorio del frontend o agregarlo aquí. Allí se describirían, por ejemplo, las páginas, componentes, formularios, cliente HTTP, manejo del JWT, rutas de navegación y estilos.
