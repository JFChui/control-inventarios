# Sistema Web de Control de Inventarios — Hotel Demo

Especificación de producto para el control de inventarios de Ama de Llaves / Lavandería. Los módulos **no** son sistemas independientes: inventario, movimientos, alertas, reportes y consumo por ocupación deben estar conectados.

## Objetivo

Permitir registrar, controlar y analizar existencias (amenidades, blancos, químicos, insumos, uniformes, maquinaria) con trazabilidad (kardex), inventario físico, alertas de stock y análisis consumo vs. ocupación hotelera.

## Estado de maduración (octubre 2026)

Las cuatro fases de maduración están en `main`:

1. Gobierno, catálogo por departamento, usuarios, alertas en vivo e impresión por módulo.
2. Blancos reconciliados con la existencia compartida e inventario físico con cierre inmutable.
3. Dotación atómica, uniformes y tickets de maquinaria.
4. Reportes de inventario y bajo stock, dashboard con salidas reales y estadísticas de ocupación contra consumo.

**Recomendaciones 2026 (también en `main`):** rectificar dotación confirmada; estatus Inspected / Clean / Dirty / Out of order; linners de piso con par y existencia; vueltas para 212 habitaciones; maquinaria vs equipos de habitación; uniformes en cuatro grupos (fijos, eventuales, RR.HH., no utilizables); módulo Stock del Linner de Recepción; reportes de esos módulos.

El catálogo operativo sale del listado del hotel (Estilo, Lencería, Lavandería y Suministro huésped). Existencia y stock mínimo arrancan en cero porque ese listado no trae cantidades. Un producto **sin conteo** (`inventory_initialized_at` nulo) no entra en alertas: no es un agotado real. El stock mínimo en 0 significa **umbral no configurado** (no se usa bajo/próximo). La existencia inicial se carga con un inventario físico por departamento.

Documentación para personas: piso [`docs/manual-usuario.md`](manual-usuario.md); sistemas [`docs/manual-sistemas.md`](manual-sistemas.md); cuentas [`docs/cuentas-de-acceso.md`](cuentas-de-acceso.md).

## Navegación (menú lateral)

1. Inicio / Dashboard  
2. Inventario General  
3. Entradas y Salidas  
4. Stock del Linner de Recepción  
5. Control de Blancos (incluye linners de piso)  
6. Inventario Físico  
7. Alertas de Bajo Stock  
8. Reportes  
9. Uniformes  
10. Amenidades y Lencería (por camarera)  
11. Maquinaria y equipos  
12. Estadísticas y Gráficas  
13. Usuarios  
14. Departamentos  
15. Categorías  

Cada módulo tiene **Imprimir** (`window.print()` + CSS). El menú visible depende del **cargo**.  

---

## 1. Dashboard

Vista rápida del estado del inventario. Indicadores sugeridos:

| Indicador | Ejemplo |
|-----------|---------|
| Productos registrados | 185 |
| Productos disponibles | 142 |
| Productos bajo stock | 12 |
| Maquinarias con fallas | 2 |
| Habitaciones ocupadas hoy | 78 |

Desde aquí se puede navegar a detalle / kardex de un producto.

---

## 2. Inventario General

Módulo principal: qué productos existen y cuánto hay disponible.

Columnas típicas: Código, Producto, Categoría, Unidad, Existencia, **Stock mínimo**, Estado (`Sin conteo` / `Agotado` / `Bajo` / `Próximo` / `Normal` / `Inactivo`).

El listado filtra por URL (`q`, `category`, `department`, `status`, `activos=1` por defecto) y busca por código o nombre. Los Gerentes de Diseño y Estilo pueden aplicar **un** mínimo y/o **una** unidad a todos los activos de una categoría (y opcionalmente un departamento) en `/inventario/minimos`, sin cambiar existencias ni códigos del PDF.

Ejemplo de categorías: Amenidades, Blancos, Químicos, Insumos.

Al seleccionar un producto → historial de movimientos (Kardex). Los Gerentes de Diseño y Estilo pueden **editar** código, nombre, categoría, unidad, stock mínimo, activo y los **departamentos habilitados**.

**Habilitación por departamento:** el catálogo puede asociarse a departamentos. Las entradas/salidas manuales quedan en Gerentes de Diseño y Estilo.

**Fórmula de existencia:**

```
existencia_actual = existencia_anterior + entradas − salidas
```

---

## 3. Entradas y Salidas

Registro de todos los movimientos. Cada movimiento actualiza existencias automáticamente.

El formulario puede filtrar productos por categoría. Solo los Gerentes de Diseño y Estilo registran entradas y salidas manuales.

### Entrada (ejemplo)

- Producto: Toallas de cuerpo  
- Cantidad: 100  
- Fecha: 11/08/2026  
- Proveedor: Proveedor XYZ  
- Responsable: Supervisor de Ama de Llaves  

### Salida (ejemplo)

- Producto: Jabón de tocador  
- Cantidad: 24  
- Departamento: Ama de Llaves  
- Responsable: Supervisor de pisos  
- Motivo: Dotación de habitaciones  
- Destino opcional: **Linner de Recepción**. Sugiere `máximo − existencia` del linner. Productos no blancos: salida de kardex (`source_type = reception_linner`) y sube la existencia del linner. Blancos: `stock_linner` a `REC` (sin kardex).

---

## 3b. Stock del Linner de Recepción

Módulo `/inventario/linner-recepcion` (gerentes y supervisores de piso / MRLA; **no** lavandería). Menú: Inventario → Stock linner recepción.

- Mínimo y máximo por producto (edición de gerentes). Check: `max >= min`.
- Existencia propia para no-blancos (`reception_linner_stock`). Los blancos leen el linner `REC` de `linen_location_stock`.
- "A llevar" = `max − existencia`. Estado bajo mínimo se muestra **aquí**, no en la burbuja de alertas.
- Consumo/conteo (`consume_reception_linner`) baja la existencia del linner sin otra salida de kardex.
- Surtido: ver §3 Entradas y Salidas (destino Linner de Recepción).

---

## 4. Control de Blancos

Dedicado a lencería / blancos del hotel:

- Toallas de cuerpo, mano, faciales  
- Sábanas, fundas, protectores  
- Alfombras de baño  
- Otros blancos  

### Estados del ciclo de vida

```
Disponible → En uso → En lavandería → Dañado → Baja
```

Debe mostrar no solo cantidades totales, sino **dónde están** y **en qué estado**. La suma activa (disponible + en uso + lavandería + dañado) es la existencia del producto. Pasar a baja genera una sola salida de kardex y ese histórico no vuelve a la existencia.

**Linners:** almacenes de piso `L06`–`L26` (sin `L13`) y `REC` (Recepción). La cantidad en un linner es sub-ubicación de `available` (no genera kardex). Almacén de lavandería = `available − sum(linners)`. El lencero surte contra el **par** de cada blanco. `/blancos/linners` muestra real / par.

**Vueltas (212 hab.):** `(available + in_use + in_laundry) / (total_rooms × pieces_per_room)`. Si las piezas por habitación son 0, se muestra "—". `hotel_settings.total_rooms` arranca en 212.

Ejemplo de vista:

| Blanco | Total | Lavandería (almacén) | En linners | En uso | En lavandería | Dañado | Vueltas (212 hab.) |
|--------|-------|----------------------|------------|--------|---------------|--------|--------------------|
| Toalla cuerpo | 500 | 120 | 180 | 180 | 20 | 0 | 2.1 |
| Sábana matrimonial | 400 | 80 | 200 | 110 | 10 | 0 | 1.8 |
| Funda | 600 | 150 | 300 | 130 | 20 | 0 | — |

Las piezas por habitación se editan en el producto de blanco. Sin ese dato, Vueltas muestra "—".

---

## 5. Solicitud de Insumos (retirado)

El módulo se **quitó de la aplicación**. Las tablas `supply_requests` / `supply_request_lines` y los movimientos históricos `source_type = request` se conservan en la base de datos.

---

## 6. Inventario Físico

Comparar sistema vs. conteo real.

| Producto | Sistema | Conteo físico | Diferencia |
|----------|---------|---------------|------------|
| Jabón | 250 | 245 | -5 |
| Toalla cuerpo | 180 | 180 | 0 |
| Detergente | 35 | 32 | -3 |

Clasificación de diferencia:

- Sin diferencia  
- Diferencia menor: hasta 5 unidades o hasta el 5% de la existencia del sistema  
- Diferencia significativa  

El conteo puede limitarse a un departamento. **Recomendado:** un conteo por área (EST, LEN, LAV, SUM), no los 227 ítems de golpe. Si la existencia del sistema es 0, el cierre actúa como **apertura**: genera entrada de kardex con motivo `Apertura inventario físico` (o solo marca el producto como inicializado si se contó 0). En blancos, la apertura deja todo en `available` para que `available + in_use + in_laundry + damaged = quantity_on_hand`.

Al cerrarlo (`posted`) las líneas quedan inmutables y los ajustes entran al kardex. Las líneas sin cantidad contada **no** se inicializan ni se ajustan.  

Útil para detectar pérdidas, errores de registro o descuadres.

---

## 7. Alertas de Bajo Stock

Comparar existencia vs. **stock mínimo** de forma continua. La UI usa esa etiqueta (no “mínimo” a secas).

Clasificación compartida (`classifyStock` y vistas SQL): `sin_conteo` si nunca se contó ni movió; `agotado` si existencia ≤ 0 **y** ya está inicializado; `bajo` si ≤ stock mínimo (solo cuando el mínimo > 0); `proximo` si ≤ stock mínimo × 1,25; si no, `normal`. Con mínimo 0 no hay umbral de bajo/próximo.

La vista `v_products_low_stock` **excluye** `sin_conteo`. Resultado con el catálogo recién cargado: 0 alertas hasta el primer conteo o entrada.

**En vivo (Fase 1):** burbuja flotante (`StockAlertBubble`) con contador de productos bajo mínimo. Se alimenta de `v_products_low_stock` y se refresca por Realtime en `products` (sin recargar la página).

### Clasificación

- Stock normal  
- Próximo a mínimo  
- Bajo stock  
- Agotado  
- Sin conteo (aún no hay existencia inicial)  

### Ejemplo

- Detergente: existencia 35 L, mínimo 50 L → **Bajo stock**  
- Jabón: existencia 250, mínimo 100 → **Stock suficiente**  

---

## 8. Reportes

### Inventario actual

Producto, existencia, unidad, stock mínimo, estado, (opcional) valor monetario.

### Consumo por departamento

Ejemplo:

| Departamento | Jabones | Toallas | Detergente | Guantes |
|--------------|---------|---------|------------|---------|
| Ama de Llaves | 850 | 1.200 | 80 L | 20 cajas |
| Lavandería | 50 | 300 | 250 L | 35 cajas |

### Productos bajo stock

Solo ítems que requieren reposición.

### Maquinaria y equipos

Estatus actual por máquina/equipo y tickets abiertos.

### Control de blancos

Total, ubicación (almacén de lavandería, cada linner, en uso, en lavandería, dañado) y vueltas para 212 habitaciones.

### Uniformes

Por prenda: fijos, eventuales, RR.HH. (disponible) y no utilizables, con detalle de trabajador.

### Dotación camarera

Rango de fechas (`America/Caracas`). Camarera, habitaciones por tipo/estatus, producto y cantidad entregada (incluye rectificaciones del kardex).

### Linner de recepción

Existencia, mínimo, máximo, a llevar y bajo mínimo.

---

## 9. Control de Uniformes

Hay **dos listas distintas**:

1. **Padrón de personal** (`uniform_workers`): código de uniforme del hotel, apellidos, nombres, departamento del hotel (`staff_department`, texto, **sin** FK a `departments`) y cargo. Cargado desde un Excel de padrones (semilla de ejemplo). Alta/baja de personal no borra historial.
2. **Prendas** (`uniform_skus`): código SKU, nombre, talla, cantidades. El Excel **no** trae tallas ni existencias: RR.HH. las registra a mano.

Las asignaciones enlazan una prenda a un trabajador del padrón (`uniform_assignments.worker_id`). `worker_name` queda como copia legible `CODIGO — APELLIDOS NOMBRES` para el historial.

**Regla de la prenda:** `Total = En uso + Disponible (RR.HH.) + No utilizable`

Los grupos **Fijos** y **Eventuales** salen de las asignaciones abiertas según `employment_type` del padrón. Una prenda sin asignaciones abiertas está **en almacén de RR.HH.** No se asigna a texto libre ni a un trabajador inactivo.

### Asignación

Al asignar a un trabajador del padrón: Disponible ↓, En uso ↑, queda fecha y código. RPC `assign_uniform(sku_id, worker_id, qty, notes)`.

### Devolución / baja de personal

Devolver prenda: `En uso → Disponible`. Dar de baja a la persona (`is_active = false`) impide **nuevas** asignaciones; no cierra las abiertas (hay que devolverlas).

### Acciones UI

- Ver / filtrar padrón (`q`, `staff_dept`, `activos`, tipo fijo/eventual)
- Dar de alta o dar de baja un trabajador (admin / RR.HH.), con `employment_type`
- Registrar uniforme (SKU + talla)
- Asignar eligiendo trabajador del padrón
- Registrar devolución
- Marcar **No utilizable** (desde disponible o desde una asignación abierta)
- Filtros de prendas: talla, departamento de inventario
- Columnas de la tabla de prendas: Fijos / Eventuales / RR.HH. / No utilizables / Total  

---

## 10. Amenidades y Lencería por Camarera

Relaciona inventario con habitaciones atendidas.

### Entrada operativa

- Camarera, turno y fecha  
- **Conteo** de habitaciones por tipo y estatus (`ocupación`, `salida`, `limpieza`, `inspected`, `clean`, `dirty`, `out of order`)  
- El sistema calcula cuánto llevar de cada producto (vista previa en vivo)  
- Tras **confirmar**, se puede **rectificar** los conteos; el kardex solo registra el delta  

### Cálculo de dotación

Parámetros **configurables** por tipo de habitación y estatus. Total = `habitaciones × cantidad / habitación` por producto.

Ejemplo (12 habitaciones):

**Amenidades**

| Producto | Cant. / habitación | Habitaciones | Total |
|----------|--------------------|--------------|-------|
| Jabón de tocador | 1 | 12 | 12 |
| Shampoo | 1 | 12 | 12 |
| Acondicionador | 1 | 12 | 12 |
| Papel higiénico | 2 | 12 | 24 |

**Lencería**

| Producto | Cant. / habitación | Habitaciones | Total |
|----------|--------------------|--------------|-------|
| Toalla de cuerpo | 2 | 12 | 24 |
| Toalla de mano | 2 | 12 | 24 |
| Toalla facial | 2 | 12 | 24 |

### Cadena de efecto

```
Habitaciones asignadas → productos requeridos → salida de inventario → consumo por camarera/departamento
```

---

## 11. Maquinaria y equipos

Pestañas **Máquinas** (lavandería) y **Equipos** (habitación: aspiradoras, sopladores). Reportes de falla y ciclo de mantenimiento.

### Estados

```
Reportada → Entregada a mantenimiento → En reparación → Reparada
                                                         ↘ Fuera de servicio
```

### Campos del reporte

- Maquinaria (ej. Lavadora industrial #02)  
- Fecha  
- Responsable de lavandería  
- Descripción del problema  
- Entregado a / responsable de mantenimiento  
- Estado  

No se captura ubicación.  

---

## 12. Estadísticas y Gráficas

Relacionar consumo de inventario con **ocupación diaria y mensual** del hotel.

Se configura el **total de habitaciones**. Cada día se registran ocupadas *dirty* y *clean*. El porcentaje del día es `(dirty + clean) / total × 100`. El mes promedia esos días. Gráficas de barras (diaria por día del mes; mensual con nombre en español y título editable).

### Tabla base (ejemplo)

| Mes | Ocupación | Amenidades | Químicos | Insumos | Blancos |
|-----|-----------|------------|----------|---------|---------|
| Enero | 65% | 3.200 | 450 L | 180 | 2.500 |
| Febrero | 72% | 3.650 | 490 L | 210 | 2.850 |
| Marzo | 81% | 4.200 | 560 L | 240 | 3.100 |

### Análisis

- Gráficas ocupación vs. consumo  
- Variación % mes a mes (ocupación y categorías)  
- Detectar si el consumo crece en proporción a huéspedes / habitaciones atendidas  

Cadena lógica:

```
Mayor ocupación → más habitaciones atendidas → mayor consumo
(amenidades, químicos, insumos, blancos, lavandería)
```

---

## 13. Usuarios

Los **Gerentes de Diseño y Estilo** crean y editan perfiles. Alta con correo, nombre, cargo, departamento y **contraseña temporal** (se muestra una sola vez). El usuario nuevo entra con `must_change_password` y es redirigido a `/cambiar-password`.

Desde el perfil de **otra** cuenta, el gerente puede **Restablecer contraseña**: genera una clave temporal de un solo uso, marca `must_change_password` y no puede usarse sobre la propia sesión. Un gerente tampoco puede desactivarse ni quitarse el cargo a sí mismo.

`is_active = false` bloquea lectura y escritura (`src/proxy.ts` + RLS + Server Actions).

Todos los cargos ven el **Dashboard**. Entradas/Salidas, Estadísticas, Usuarios, Categorías y Departamentos son solo de los Gerentes de Diseño y Estilo.

### Cargos (enum `app_role`)

| Rol DB | Quién | Alcance |
|--------|-------|---------|
| `senior_design_manager` | Gerente Senior de Diseño y Estilo | Todo el sistema |
| `design_manager` | Gerente de Diseño y Estilo | Todo el sistema |
| `hr_manager` | Gerente de Recursos Humanos | Dashboard y Uniformes |
| `laundry_supervisor` | Supervisor de lavandería | Dashboard, Blancos, Uniformes, Maquinaria |
| `floor_supervisor_a/b/c` | Supervisor de piso A/B/C | Dashboard, Inventario general, Inventario físico, Reportes, Alertas, Dotación, Linner de recepción |
| `mrla` | MRLA | Igual que supervisores de piso |

Mapeo al migrar: `admin` → `senior_design_manager`; `human_resources` → `hr_manager`; `department_user` → `floor_supervisor_a`. Los valores antiguos permanecen en el enum y no se asignan en la UI.

## 14. Departamentos

Catálogo operativo de departamentos (código único, nombre, activo). Visible a los Gerentes de Diseño y Estilo en `/departamentos`.

- Crear / editar código y nombre.  
- **Desactivar** si hay referencias (perfiles, movimientos, productos habilitados, solicitudes).  
- **Borrar** solo si no hay FKs; si las hay, el sistema pide desactivar.

---

## Modelo mental de integración

```
SISTEMA WEB
└── DASHBOARD
    └── INVENTARIO GENERAL ←→ ENTRADAS Y SALIDAS
            └── CONTROL DE STOCK
                ├── ALERTAS BAJO STOCK
                ├── INVENTARIO FÍSICO
                └── REPORTES (consumo / inventario / bajo stock)
                        └── AMENIDADES / INSUMOS / QUÍMICOS / BLANCOS
                                └── OCUPACIÓN DEL HOTEL
                                        └── GRÁFICAS Y ANÁLISIS MENSUAL
```

Módulos satélite conectados al mismo stock: **Blancos** (con linners de piso), **Linner de Recepción**, **Uniformes**, **Dotación por camarera**, **Maquinaria y equipos**.

---

## Reglas de negocio prioritarias

1. Toda entrada/salida/dotación de camarera debe dejar traza en kardex y actualizar existencia.  
2. No permitir salidas que dejen existencia negativa (salvo política explícita documentada).  
3. Alertas derivadas de `existencia` vs `stock_minimo` (label UI: **Stock mínimo**).  
4. Blancos: estados mutuamente consistentes con totales por ítem.  
5. Uniformes: `total = en_uso + disponible + no_utilizable`; asignación/devolución atómicas.  
6. Dotación por camarera: cantidades por parámetro configurable, no hardcodeadas.  
7. Reportes y gráficas leen movimientos reales + datos de ocupación; no inventar cifras.  
8. El acceso a módulos lo define el cargo (menú, páginas, Server Actions y RLS).  
9. Usuarios inactivos no leen ni escriben.  
10. Checks de rol en RLS vía helpers `SECURITY DEFINER` (`search_path = public`); no consultar `profiles` desde policies de `profiles`.  
11. Linners de blancos: `sum(linners) <= available`; surtir/devolver no genera kardex.  
12. Linner de recepción (no-blancos): salida de kardex `source_type = reception_linner` al surtir; el consumo baja solo la existencia del linner.  
13. Dotación confirmada se rectifica con `revise_maid_allocation` (delta en kardex), no editando conteos a mano.  

---

## Fuente

Derivado del documento de tesis/propuesta: *Sistema del control de inventarios* (contexto Hotel Demo / Ama de Llaves).
