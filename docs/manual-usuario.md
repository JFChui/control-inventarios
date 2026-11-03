# Manual de uso
## Control de inventarios — Hotel Demo

**Para:** Gerentes de Diseño y Estilo, Lavandería, supervisores de piso, Mantenimiento y Recursos Humanos  
**No hace falta saber de computadoras.** Si puede usar WhatsApp o un correo, puede usar este sistema.  
**Dirección de la página:** https://your-app.vercel.app  

Las claves de cada persona **no van en este manual**. Están en la hoja de cuentas que guarda gerencia / Sistemas.

Fecha de este documento: noviembre 2026.

---

## 1. ¿Para qué sirve esto?

Es el cuaderno de inventario del hotel, pero en internet.

Sirve para saber:

- qué productos hay (jabón, toallas, detergente, etc.)
- cuántos hay **ahora**
- quién sacó o metió mercancía
- cuándo hay que reponer (alertas)
- uniformes, blancos (con linners y vueltas), maquinaria, linner de recepción y consumo frente a la ocupación del hotel

**La idea más importante:** hay **un solo inventario**. Si Lavandería usa detergente o una camarera recibe amenidades, esa cantidad **baja del mismo stock** que se ve en Inventario, en Alertas y en Reportes. No hay “otro almacén escondido” en otra pantalla.

---

## 2. Cómo entrar (paso a paso)

1. Abra el navegador (Chrome, Edge o el del teléfono).
2. Escriba o toque esta dirección:  
   https://your-app.vercel.app
3. Verá una tarjeta verde: **Hotel Demo — Control de inventarios**.
4. En **correo** escriba el usuario que le dieron (termina en `@example.local`).  
   Eso **no** es Gmail. No busque el mensaje en Outlook.
5. En **contraseña** escriba la clave, respetando mayúsculas y signos.
6. Pulse **Entrar**.

### Si el sistema le pide cambiar la contraseña

Es normal la primera vez y también después de que un gerente la restablezca.

1. Escriba una clave nueva de **al menos 8 caracteres**.
2. Vuelva a escribirla para confirmar.
3. Guárdela. A partir de ahí usa esa clave, no la temporal.

### Si no puede entrar

- Revise que no haya un espacio al inicio o al final del correo.
- Revise mayúsculas en la clave.
- Si el mensaje dice que el usuario está **desactivado**, avise a un gerente.
- Si olvidó la clave, **no hay recuperación por correo**. Pídasela a un gerente de Diseño y Estilo.

### Cómo salir

Abajo del menú (o en el panel del teléfono) pulse **Cerrar sesión**, sobre todo si comparte la computadora.

### En el teléfono

Arriba a la izquierda hay un botón **☰**. Ábralo para ver el menú. El menú de la izquierda en computadora es el mismo.

---

## 3. Palabras que usa el sistema

| Lo que dice la pantalla | Qué significa en el hotel |
|-------------------------|---------------------------|
| **Existencia** | Cuántas unidades hay ahora |
| **Entrada** | Mercancía que entra (compra, recepción, conteo inicial) |
| **Salida** | Mercancía que se usa o se entrega |
| **Kardex** | El historial del producto: todas las entradas y salidas, con fecha |
| **Stock mínimo** | La cantidad “piso”. Si baja de ahí, hay que reponer. Si está en 0, **aún no se configuró** ese piso |
| **Sin conteo** | El producto está en la lista, pero **nadie lo ha contado ni ha tenido movimiento**. No está agotado |
| **Agotado** | Ya se contó o se movió, y la existencia quedó en 0 |
| **Bajo / Próximo** | Hay stock, pero está en el mínimo o cerca |
| **Dirty / Clean** | Habitaciones ocupadas que hay que reponer (dirty) frente a las que ya están listas (clean) |
| **Borrador** | Un conteo o una dotación todavía no confirmados; no mueven el stock hasta cerrarlos |
| **Linner** | Carro / almacén de piso (L06 a L26, sin L13) o el de recepción |
| **Par** | Cuánto **debería** haber en ese linner de cada blanco |
| **Vueltas** | Cuántas veces alcanza el blanco para vestir las 212 habitaciones |
| **Rectificar** | Corregir una dotación ya confirmada; solo ajusta la diferencia |

Las fechas y horas se muestran en hora de **Venezuela** (Caracas), no en la del servidor.

---

## 4. Qué ve cada cargo (léalo antes de operar)

El menú **cambia según el cargo**. Si no ve una pantalla, no es un fallo: no le corresponde.

| Cargo | Correo típico | Qué ve |
|-------|---------------|--------|
| Gerente Senior / Gerente de Diseño y Estilo | `admin@…` | Todo: catálogo, entradas/salidas, conteos, blancos, usuarios, estadísticas |
| Gerente de Recursos Humanos | `hr@…` | Inicio y **Uniformes** |
| Supervisor de lavandería | `lavanderia@…` | Inicio, **Blancos**, **Uniformes** y **Maquinaria** |
| Supervisor de piso | `estilo@…`, `lenceria@…`, `suministro@…`, `mantenimiento@…` | Inicio, inventario, inventario físico, alertas, reportes, **dotación** y **stock del linner de recepción** |
| MRLA | `ama@…` | Igual que supervisor de piso |

**Entradas y salidas manuales** solo las registran los gerentes de Diseño y Estilo.

**Cerrar un conteo físico** (pasar de borrador a publicado) lo hacen los cargos que tienen Inventario físico: gerentes y supervisores de piso. Lavandería y RR.HH. no cierran conteos.

No hay pantalla de “Solicitud de insumos”: los pedidos entre áreas se resolvieron fuera de esta app; el stock se mueve con entradas/salidas, dotación o conteo.

---

## 5. El menú (qué hay en cada sitio)

| Menú | Para qué |
|------|----------|
| **Inicio** | Resumen del día: existencias, alertas, ocupación de hoy |
| **Inventario** | Lista de productos y, al abrir uno, el kardex |
| **Entradas y salidas** | Registrar una compra o un consumo (solo gerentes) |
| **Blancos** | Toallas y sábanas: disponible, en uso, lavandería, dañado, baja |
| **Inventario físico** | Contar lo que hay en el almacén y comparar con el sistema |
| **Alertas** | Lo que está bajo o agotado (solo productos ya contados) |
| **Reportes** | Inventario, alertas, maquinaria, blancos, uniformes, dotación y linner recepción |
| **Uniformes** | Prendas de fijos, eventuales, RR.HH. y no utilizables |
| **Dotación** | Amenidades / lencería que se entregan a la camarera según habitaciones |
| **Maquinaria** | Máquinas de lavandería y equipos de habitación |
| **Stock linner recepción** | Mínimo, máximo y existencia de ese linner (menú Inventario) |
| **Estadísticas** | Ocupación del hotel contra consumo real |
| **Usuarios / Departamentos / Categorías** | Solo gerentes |

Cada pantalla tiene **Imprimir** (arriba). Usa la impresora o “Guardar como PDF” del navegador.

---

## 6. Dashboard (la pantalla de inicio)

Ahí ve de un vistazo cuántos productos hay, cuántos están bajo mínimo, si hay máquinas con falla y cuántas habitaciones están ocupadas **hoy** (hora de Caracas).

Si un número no cuadra, no lo “arregle” a mano: entre al módulo (Inventario, Alertas, Maquinaria) y revise el historial.

---

## 7. Inventario general

Lista de productos: código, nombre, categoría, unidad, existencia, mínimo y estado.

- Use el buscador y los filtros (categoría, departamento, estado).
- Pulse un producto para ver el **kardex** (quién movió, cuándo, de dónde).
- **Sin conteo** no es un error: el listado del hotel se cargó sin cantidades. Hay que hacer un inventario físico o una entrada.

Solo los gerentes editan un producto (nombre, mínimo, departamentos habilitados) o aplican un mínimo a toda una categoría en **Inventario → Mínimos**.

---

## 8. Entradas y salidas (solo gerentes)

Para meter mercancía nueva o registrar un consumo que no sale de otro módulo:

1. Abra **Entradas y salidas**.
2. Elija producto, tipo (entrada o salida), cantidad y un comentario claro.
3. Si el destino es el **Linner de Recepción**, márquelo: el sistema sugiere cuánto falta para llegar al máximo (`máximo − existencia`).
4. Guarde. El kardex y la existencia se actualizan al momento.

No se puede sacar más de lo que hay. Si el sistema lo rechaza, cuente de nuevo o revise el kardex.

Los supervisores de piso **no** tienen esta pantalla: su movimiento de stock sale de la **dotación**, del **conteo físico** y del consumo que registran en **Stock linner recepción**.

---

## 9. Stock del linner de recepción

Para gerentes y supervisores de piso (menú **Inventario → Stock linner recepción**).

Ahí se ve, por producto: cuánto hay **en ese linner**, el mínimo, el máximo, cuánto **falta para el máximo** y si está bajo el mínimo.

- Los gerentes editan mínimo y máximo.
- Quien opera el linner registra **conteo o consumo** para bajar lo que ya se usó (eso no vuelve a salir del kardex: el kardex ya se movió cuando se surtió).
- Los blancos de este linner se ven también en **Blancos → Linners** (ubicación `REC`).

La burbuja verde de alertas **no** incluye el linner bajo mínimo: hay que mirar esta pantalla.

---

## 10. Inventario físico (contar de verdad)

Sirve para igualar lo que dice la computadora con lo que hay en el cuarto de lencería o el almacén.

1. Un gerente o un supervisor de piso abre un conteo del departamento (queda en **borrador**).
2. En cada línea escriba lo que contó. Si deja el recuadro **vacío** y pulsa Enter, **no se guarda un cero**: el producto queda sin contar.
3. Revise las diferencias.
4. Pulse **Cerrar / publicar** solo cuando el conteo esté completo. Eso sí mueve el stock y ya no se puede editar.

Hasta que no se cierre, el sistema no cambia existencias. No cierre un conteo de prueba en el hotel.

---

## 11. Alertas de bajo stock

Solo aparecen productos **ya contados** (o que ya tuvieron movimiento) y que están en el mínimo, cerca o en cero.

Un producto **sin conteo** no sale aquí a propósito: todavía no hay cifra real.

---

## 12. Control de blancos (Lavandería y gerentes)

Ciclo: **Disponible → En uso → En lavandería → Dañado → Baja**.

- Mueva cantidades de un estado a otro (por ejemplo, de disponible a lavandería). Si sale de un linner, indíquelo.
- **Baja** resta del inventario general: esa pieza ya no existe.
- La suma de estados debe coincidir con la existencia del producto.
- **Vueltas** (junto a Baja): cuántas vueltas alcanza ese blanco para las 212 habitaciones, según las piezas por habitación. Si las piezas por habitación no están cargadas, verá un guion.
- **Linners:** pulse **Ver linners**. Pisos 6 a 26 (sin el 13) y Recepción. Ahí se ve cuánto hay y cuánto **debería** haber (par). El lencero **surtir** mueve de lavandería al piso; no baja el inventario general.

La cuenta de Lavandería entra directo a esta pantalla (y a maquinaria / uniformes).

---

## 13. Dotación por camarera (habitaciones)

Para supervisores de piso y gerentes.

1. Indique la fecha (por defecto **hoy** en Caracas) y las habitaciones (tipo y estado).
2. El sistema calcula jabón, papel, sábanas, etc. según los parámetros.
3. Revise el borrador.
4. **Confirme** (el sistema pide confirmación). Ahí se registran las **salidas** del kardex.

Si se equivocó antes de confirmar, no confirme: borre o deje el borrador. **Después de confirmar** puede pulsar **Rectificar** si hay que corregir el conteo: el sistema ajusta el kardex solo por la diferencia.

Los estatus de habitación incluyen Ocupación, Salida, Limpieza, Inspected, Clean, Dirty y Out of order.

---

## 14. Uniformes (RR.HH., Lavandería y gerentes)

- El padrón de trabajadores y las **prendas** (antes “SKUs”) están aquí.
- Cada persona del padrón se marca como **fijo** o **eventual** al darla de alta; se puede filtrar por tipo.
- Asignar un uniforme a una persona lo pasa a “en uso” (columna Fijos o Eventuales, según el tipo).
- **Devolver** (con confirmación) lo regresa a RR.HH. (disponible).
- **No utilizable** saca la prenda del uso o del almacén y la deja en esa columna; pide motivo.
- **Dar de baja** a un trabajador pide confirmación; no borra el historial.

La fórmula: total de la prenda = fijos + eventuales + RR.HH. (disponible) + no utilizables.

---

## 15. Maquinaria (Lavandería)

Hay dos pestañas: **Máquinas** de lavandería y **Equipos** de habitación (aspiradoras, sopladores). Reporte una falla, el estado y el comentario. No mueve inventario de productos.

---

## 16. Reportes y estadísticas

**Reportes:** listados para imprimir (inventario actual, bajo stock, maquinaria, blancos con ubicación y vueltas, uniformes por grupo, dotación camarera y linner de recepción).

**Estadísticas** (gerentes):

- Ocupación **diaria**: habitaciones *dirty* (hay que reponer) y *clean* (ya listas). Dirty + clean no puede pasar del total de habitaciones.
- Ocupación **mensual** (resumen).
- Consumo del mes según el kardex real, en hora de Caracas. El sistema no inventa números.

---

## 17. Departamentos, categorías y usuarios (solo gerentes)

- **Departamentos y categorías:** alta, edición, desactivar. Borrar un departamento pide confirmación y solo se permite si no está en uso.
- **Usuarios:** crear persona (correo, nombre, cargo, departamento). El sistema muestra una **clave temporal una sola vez**.
- En el perfil de otra persona: **Restablecer contraseña**. Confirme, copie la clave nueva y désela. Esa persona deberá cambiarla al entrar.
- No puede desactivarse a sí mismo, quitarse el cargo de gerente ni restablecer su propia clave.

---

## 18. Rutinas recomendadas

| Cuándo | Quién | Qué hacer |
|--------|-------|-----------|
| Cada mañana | Supervisor de piso | Revisar alertas, el linner de recepción y la ocupación de ayer / hoy |
| Al armar carros | Supervisor de piso | Confirmar la **dotación** del día |
| Si el conteo de habitaciones cambió | Supervisor de piso | **Rectificar** la dotación ya confirmada |
| Al surtir pisos | Lavandería | **Blancos → Linners**: surtir contra el par |
| Al llevar al linner de recepción | Gerente | **Entradas y salidas** con destino Linner de recepción |
| Al recibir compra | Gerente | **Entrada** con factura o guía en el comentario |
| Al contar el almacén | Gerente o piso | Inventario físico en borrador; cerrar solo al terminar |
| Turno de lavandería | Lavandería | Mover blancos; reportar máquinas o equipos |
| Ingreso / egreso de personal | RR.HH. | Uniformes: asignar, devolver o marcar no utilizable |

---

## 19. Problemas frecuentes

| Qué ve | Qué hacer |
|--------|-----------|
| No aparece un menú | Es normal: su cargo no lo incluye |
| Producto en “sin conteo” | Hay que contarlo o registrar una entrada; no está agotado |
| No puede hacer una salida | Solo gerentes en Entradas/salidas; o no hay existencia |
| Enter en el conteo “no hace nada” | El recuadro está vacío; escríba un número (0 es un conteo real de cero) |
| La hora no coincide con el reloj del hotel | Avise a Sistemas; debe verse hora de Caracas |
| Olvidó la clave | Un gerente la restablece en Usuarios; no hay correo de recuperación |
| El linner de recepción está bajo mínimo | No sale en la burbuja de alertas; ábralo en **Stock linner recepción** y surta desde Entradas y salidas |

---

## 20. Dónde pedir ayuda

1. Su supervisor inmediato.
2. Gerencia de Diseño y Estilo (cuentas y permisos).
3. Sistemas, con este dato: dirección https://your-app.vercel.app y el **correo** de la cuenta (nunca mande la clave por chat).
