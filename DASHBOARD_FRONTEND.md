# Dashboard — Guía de referencia para el Frontend

> **Última actualización:** dashboard unificado en `/api/dashboard`.
> **Estado del legacy:** `/api/inicio` está **deprecado**. Solo queda viva
> `/api/inicio/solicitante` hasta que el frontend migre. Todo lo demás fue eliminado.

---

## 0. Resumen rápido para quien llega nuevo

- El home del dashboard se alimenta **únicamente** de `GET /api/dashboard`.
- El payload **recorta** contenido según el rol (modo *completo* vs *simple*),
  pero **la forma es idéntica** (mismos tipos). Renderiza siempre iterando arrays por `id`.
- `/api/inicio/*` es **legacy/deprecado**. No construir nada nuevo sobre él.

---

## 1. Endpoint y autenticación

```
GET /api/dashboard?modulo=BODEGA|COSECHAS&dias=N
```

- Requiere `Authorization: Bearer <token>`.
- `modulo`: `"BODEGA"` | `"COSECHAS"`.
- `dias`: ventana temporal en días (se normaliza a un rango válido; por defecto `7`).

### Errores

| Código | Cuándo | Body |
|--------|--------|------|
| `400` | `modulo` inválido | `{ message: "Módulo inválido. Use BODEGA o COSECHAS." }` |
| `401` | Sin token / token inválido | `{ message: "..." }` |
| `403` | Rol sin permiso para ese módulo | `{ message: "No tiene permisos para ver este módulo" }` |
| `500` | Error interno | `{ message: "Error al obtener el dashboard" }` |

> **Recomendación:** antes de renderizar el selector de módulos, filtra con el `rol`
> de la sesión (ver matriz §2) para evitar 403 evitables.

---

## 2. Matriz de acceso por rol

| Rol | `modulo=BODEGA` | `modulo=COSECHAS` |
|-----|:---:|:---:|
| `ADMIN` | Completo | Completo |
| `BODEGUERO` | Completo | 403 |
| `COSECHA` | 403 | Completo |
| `SOLICITANTE` | Simple (solo lo suyo) | 403 |
| `VISOR` | Simple (global, sin datos críticos) | 403 |

- **Completo** = ADMIN, BODEGUERO.
- **Simple** = SOLICITANTE, VISOR (contenido reducido, sin datos críticos, `alertas: []`).
- `COSECHAS` **no** es accesible para SOLICITANTE/VISOR (403).

---

## 3. Forma de la respuesta (contrato estable)

```ts
type DashboardResponse = {
  modulo: "BODEGA" | "COSECHAS";
  generadoEn: string;          // ISO timestamp
  kpis: Kpi[];
  graficas: Grafica[];
  resumenDia: ResumenItem[];
  alertas: Alerta[];
};

type Formato = "numero" | "moneda" | "libras" | "metros";

type Kpi = {
  id: string;
  label: string;
  value: number;
  formato: Formato;
  descripcion: string;
  variacionPct: number | null;   // % vs periodo anterior; null = no comparable
  tendencia: number[];           // 1 valor por día de la ventana (sparkline)
  icono?: "movimientos" | "stock" | "solicitudes" | "inventario"
        | "cosecha" | "despacho" | "lote";
};

type Grafica = {
  id: string;
  titulo: string;
  tipo: "barras" | "lineas";
  series: { key: string; label: string }[];
  datos: ({ etiqueta: string } & Record<string, number | string>)[];
};

type ResumenItem = {
  id: string;
  label: string;
  value: number;
  total: number | null;   // para mostrar "value / total"
  formato: Formato;
};

type Alerta = {
  id: string;
  nivel: "info" | "warning" | "danger";
  titulo: string;
  descripcion: string;
  cantidad: number;
  ruta: string;           // navegar al hacer clic
};
```

> La estructura **no cambia** entre rol completo y simple. Solo cambia *qué elementos*
> vienen dentro de los arrays.

---

## 4. Módulo BODEGA

### 4.1 Modo Completo (ADMIN, BODEGUERO)

**KPIs (`kpis`)**

| `id` | label | formato | notas |
|------|-------|---------|-------|
| `movimientos-hoy` | Movimientos de hoy | `numero` | Documentos aprobados de hoy |
| `stock-critico` | Productos en nivel crítico | `numero` | Stock ≤ 50 |
| `solicitudes-pendientes` | Solicitudes pendientes | `numero` | Sólo `PENDIENTE` |
| `solicitudes-activas` | Solicitudes activas | `numero` | `PENDIENTE + APROBADA` (aún sin entregar) |
| `valor-inventario` | Valor del inventario | `moneda` | |

**Gráficas (`graficas`)**

| `id` | título | tipo | series |
|------|--------|------|--------|
| `entradas-vs-salidas` | Entradas vs. salidas | barras | `entradas`, `salidas` |
| `top-productos-despachados` | Top 5 productos despachados | barras | `cantidad` |
| `solicitudes-por-estado` | Solicitudes por estado | barras | `cantidad` |

**Resumen del día (`resumenDia`)**

| `id` | label | `total` |
|------|-------|---------|
| `ingresos-hoy` | Ingresos de hoy | `null` |
| `salidas-hoy` | Salidas de hoy | `null` |
| `solicitudes-aprobadas-hoy` | **Aprobadas hoy** | solicitudes creadas hoy |
| `solicitudes-pendientes` | Solicitudes pendientes | `null` |

> ⚠️ **Cambio de label:** `solicitudes-aprobadas-hoy` ahora se llama **"Aprobadas hoy"**
> y es **estrictamente las aprobadas del día actual** (no un total acumulado ni "recientes").
> Su `total` = solicitudes **creadas hoy**. Renderízalo como `value / total`
> (ej. **"3 / 5"** → "3 de 5 aprobadas hoy"). No es el concepto "aprobadas recientemente".

**Alertas (`alertas`)**

| `id` | nivel (según dato) | ruta |
|------|---------------------|------|
| `stock-critico` | `danger` si >0, si no `info` | `/bodega/inventario` |
| `solicitudes-sin-atender` | `warning` si >0 | `/bodega/solicitudes` |
| `borradores-antiguos` | `warning` si >0 | `/bodega/movimientos` |
| `ajustes-periodo` | `info` | `/bodega/movimientos` |

### 4.2 Modo Simple (SOLICITANTE, VISOR)

> La forma es igual; llegan **menos elementos**. No asumas que existen todos los `id`.

**KPIs**

| `id` | label | notas |
|------|-------|-------|
| `solicitudes-activas` | Solicitudes activas | `PENDIENTE + APROBADA` |
| `solicitudes-pendientes` | Solicitudes pendientes | Sólo `PENDIENTE` |

> ⚠️ **Cambio reciente:** se **quitó `movimientos-hoy`** del modo simple (era jerga de
> bodega y no aportaba al solicitante). En su lugar llega **`solicitudes-activas`**,
> que es el número más significativo para este perfil.

**Gráficas**

| `id` | título |
|------|--------|
| `solicitudes-por-estado` | Solicitudes por estado |

**Resumen del día**

| `id` | label |
|------|-------|
| `solicitudes-aprobadas-hoy` | Aprobadas hoy |
| `solicitudes-pendientes` | Solicitudes pendientes |

**Alertas:** `[]` (siempre vacío).

**SOLICITANTE vs VISOR** (ambos "simple", el payload es el mismo esquema):
- **SOLICITANTE:** los datos están filtrados a **sus propios** documentos/solicitudes
  (incluido `solicitudes-activas`, que cuenta solo las suyas).
- **VISOR:** ve **globales** de solicitudes (pero igual sin stock, dinero, top de
  despachos ni alertas).

El frontend no necesita lógica distinta; solo cambia el **copy** (título).

**Lo que NO llega en modo simple:**
`stock-critico`, `valor-inventario`, `movimientos-hoy`,
`entradas-vs-salidas`, `top-productos-despachados`, `ingresos-hoy`, `salidas-hoy`
y todas las `alertas`.

---

## 5. Módulo COSECHAS (siempre completo: ADMIN, COSECHA)

**KPIs**

| `id` | label | formato |
|------|-------|---------|
| `libras-cosechadas` | Libras cosechadas | `libras` |
| `porcentaje-rechazo` | % de rechazo | `numero` |
| `libras-vendidas` | Libras vendidas | `libras` |
| `rendimiento-lote` | Rendimiento por lote | `metros` (lb/m) |

**Gráficas**

| `id` | título | tipo |
|------|--------|------|
| `cosechas-por-periodo` | Cosechas por periodo | lineas (`campo`, `vendidas`) |
| `cosechas-por-lote` | Top 8 lotes por libras | barras (`libras`) |
| `libras-por-empacadora` | Libras por empacadora | barras (`libras`) |

**Resumen del día**

| `id` | label |
|------|-------|
| `campo-hoy` | Libras de campo hoy |
| `rechazo-hoy` | Libras de rechazo hoy |
| `vendidas-hoy` | Libras vendidas hoy |
| `boletas-hoy` | Boletas de hoy |

**Alertas**

| `id` | nivel | ruta |
|------|-------|------|
| `lotes-sin-cosecha` | `warning` si >0 | `/cosechas/registro` |
| `cosechas-sin-boleta` | `danger` si >0 | `/cosechas/registro` |
| `vendidas-descuadradas` | `warning` si >0 | `/cosechas/registro` |
| `lotes-sin-actividad` | `warning` si >0 | `/cosechas/registro` |
| `lotes-sin-area` | `info` | `/cosechas/registro` |

---

## 6. Recomendaciones de renderizado

1. **Itera por `id`, nunca por índice fijo.** Usa `kpis.map(...)`, no `kpis[2]`.
   El backend puede quitar tarjetas según el rol.
2. **No asumas cantidad fija** de gráficas/alertas. Modo simple = 1 gráfica, 0 alertas.
3. **Formatea según `formato`:**
   - `numero` → entero con separadores de miles.
   - `moneda` → moneda local (Quetzales / GTQ).
   - `libras` → número + "lb".
   - `metros` → decimal + "lb/m" (es rendimiento: libras por metro lineal).
4. **`variacionPct`:** si es `null`, muestra "—" o "sin comparación". Positivo ↑, negativo ↓.
5. **`tendencia`:** array de `dias` elementos → ideal para sparklines.
6. **`resumenDia[].total`:** si no es `null`, muestra `value / total`
   (ej. "3 de 5 aprobadas hoy").
7. **Alertas:** si `alertas` viene `[]`, **oculta** la sección (no dejes contenedor vacío).
8. **Selector de módulo:** habilita solo los módulos permitidos por rol (ver §2).
9. Maneja el **403** con una pantalla/estado "Sin acceso a este módulo".
10. **No** hardcodees reglas de permisos en base a "qué llega"; usa el `rol` de sesión
    para decidir títulos y CTAs.

---

## 7. Nota de migración: `/api/inicio` → `/api/dashboard`

**`/api/inicio/*` está deprecado.** Es legacy y duplica lógica del home.

| Endpoint legacy | Estado | Reemplazo |
|-----------------|--------|-----------|
| `/api/inicio/bodeguero` | ❌ **ELIMINADO** | `GET /api/dashboard?modulo=BODEGA` (ADMIN, BODEGUERO) |
| `/api/inicio/admin` | ❌ **ELIMINADO** | `GET /api/dashboard?modulo=BODEGA` (ADMIN) |
| `/api/inicio/solicitante` | ⚠️ **DEPRECADO (vivo)** | `GET /api/dashboard?modulo=BODEGA` (SOLICITANTE, VISOR) |

- Hoy solo queda viva `/api/inicio/solicitante` porque el frontend aún la consume.
- **Migra cuanto antes** a `/api/dashboard`. Cuando el frontend confirme la migración,
  backend eliminará `/api/inicio/solicitante` (sunset).
- El `inicioService` legacy **no filtra por usuario** (a diferencia del nuevo dashboard,
  que sí aplica filtrado por rol). Otro motivo para migrar.

> Si el frontend detecta un `404` en `/api/inicio/bodeguero` o `/api/inicio/admin`,
> es esperado: fueron eliminados. Cambiar a `/api/dashboard`.

---

## 8. Resumen de cambios (antes → ahora)

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| Endpoint del home | `/api/inicio/*` (3 rutas) | `/api/dashboard` (1 endpoint, 2 módulos) |
| `/api/inicio/bodeguero`, `/admin` | Disponibles | **Eliminados** |
| `/api/inicio/solicitante` | Disponible | Deprecado (vivo temporalmente) |
| Acceso COSECHAS | Implícito | Solo ADMIN, COSECHA (403 al resto) |
| SOLICITANTE/VISOR en BODEGA | Datos sensibles completos | **Modo simple** (sin stock/dinero/alertas) |
| KPI modo simple | — | `solicitudes-activas` + `solicitudes-pendientes` |
| `movimientos-hoy` en modo simple | Se mostraba | **Quitado** |
| Label `solicitudes-aprobadas-hoy` | "Solicitudes aprobadas" | **"Aprobadas hoy"** (estrictamente hoy) |
| Forma de la respuesta | — | Estable (solo cambia el contenido por rol) |

---

## 9. Respuestas a las preguntas del frontend (decisiones de producto)

### 9.1 ¿Las listas "En Proceso" / "Historial" son imprescindibles en el home?

**No. Se quitan del home.** Son redundantes con la pantalla **Solicitudes** (que tiene
filtros y paginación) y pertenecían al legacy `/api/inicio` (que encima no filtra por
usuario). En el home reemplázalas por una tarjeta/enlace a **Solicitudes** con el conteo
que ya llega en el KPI `solicitudes-pendientes`. El payload de `/api/dashboard` **no**
incluye esas listas: entrega resúmenes (KPIs + `resumenDia`) y `alertas` con `ruta`.

### 9.2 ¿`movimientos-hoy` tiene sentido para un SOLICITANTE?

**No, confunde.** Es jerga de bodega; un solicitante no registra movimientos, registra
solicitudes. **Se quitó del modo simple** y se reemplazó por `solicitudes-activas`.
Queda disponible solo para ADMIN/BODEGUERO.

### 9.3 ¿SOLICITANTE y VISOR comparten pantalla o pantallas separadas?

**Misma pantalla, mismo componente.** El payload es idéntico en forma; los datos ya
vienen filtrados (SOLICITANTE = lo suyo; VISOR = global sin datos críticos). Diferencias
solo en **copy** por `rol`:
- SOLICITANTE → "Mis solicitudes"
- VISOR → "Solicitudes"

No crear dos pantallas: es doble mantenimiento para algo que el backend ya resuelve.

### 9.4 ¿CTA "Nueva solicitud" en el home?

- **SOLICITANTE:** sí (es su acción principal) → CTA primario "Nueva solicitud".
- **VISOR:** no (solo lectura).
- **ADMIN / BODEGUERO / COSECHA:** no "Nueva solicitud" genérico; usar acciones propias
  (ej. "Registrar movimiento", "Registrar cosecha").

El CTA se decide en el frontend por `rol`. **No** se envía un bloque `acciones` en el
payload (decisión deliberada: el `rol` en sesión es la única fuente de verdad de permisos
para UI; duplicarlo en el payload se desincroniza). Si en el futuro se quiere
server-driven, se evalúa aparte.

### 9.5 ¿Cuándo se elimina `/api/inicio/solicitante`?

**Deprecado ya; eliminación = tarea backend con ventana de sunset**, acordada cuando el
frontend confirme que migró a `/api/dashboard`. **No** se borra a ciegas desde el cliente.
`/api/inicio/bodeguero` y `/api/inicio/admin` **ya fueron eliminados** (eran código muerto).

### 9.6 ¿El legacy sigue sin exigir token? (hueco de seguridad)

**No, ya está protegido.** En `src/index.ts` se monta con
`app.use("/api/inicio", authenticateToken, inicioRouter)` y cada ruta aplica `requireRole`.
No hay hueco de seguridad abierto; la doc vieja estaba desactualizada. La razón para
deprecar es **duplicación/ambigüedad de producto**, no seguridad.

### 9.7 ¿El modo Simple va a crecer (listas / solicitudes recientes)?

**Queda cerrado** como widget de resumen (números accionables + enlace). Las listas viven
en la pantalla **Solicitudes**. Regla de diseño: modo simple = números + enlace, nunca listas.

### 9.8 Semántica de `solicitudes-aprobadas-hoy`: ¿total o solo hoy?

**Estrictamente hoy.** Es `"Aprobadas hoy"` (aprobadas/entregadas del día actual) y su
`total` = solicitudes creadas hoy. **No** es "aprobadas recientemente". Renderiza
`value / total` (ej. "3 de 5"). Si el negocio pidiera "recientes", sería un KPI distinto
(no se recomienda para el home; "hoy" es más claro y accionable).

### 9.9 Nueva semántica: `solicitudes-activas`

- **Definición:** solicitudes en `PENDIENTE` o `APROBADA` (aún **no** entregadas ni
  rechazadas). Coherente con el "stock comprometido" del dominio.
- **Filtrado:** SOLICITANTE cuenta **solo las suyas**; VISOR/ADMIN/BODEGUERO cuentan
  **globales**.
- **Visibilidad:** aparece para todos los roles de bodega; para SOLICITANTE refleja
  únicamente su propio trabajo.

---

_Fuente de verdad del código: `src/modules/dashboard/dashboardService.ts`,
`src/modules/dashboard/dashboard.ts`, `src/modules/dashboard/inicio.ts` (deprecado)._
