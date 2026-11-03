# Ejemplo de pipeline — Hotel Demo

Documento de referencia del **pipeline de entrega (CI/CD)** y del **pipeline operativo de inventario**.

![Pipeline del proyecto — CI/CD e inventario](./pipeline-proyecto.png)

---

## 1. Pipeline CI/CD (código → producción)

Flujo real del proyecto:

```mermaid
flowchart LR
  A[Developer] --> B[git push main]
  B --> C[GitHub]
  C --> D[GitHub Actions CI]
  D --> E{lint + build OK?}
  E -->|No| F[Falla el check]
  E -->|Sí| G[Vercel Production Deploy]
  G --> H[https://your-app.vercel.app]
  C --> G
```

### Etapas

| Etapa | Qué hace | Dónde |
|-------|----------|--------|
| 1. Commit | Cambios en el código | Local / Cursor |
| 2. Push | Sube a `main` | GitHub |
| 3. CI | `npm ci` → `test` → `lint` → `build` | GitHub Actions (`.github/workflows/ci.yml`) |
| 4. Deploy | Build + publish producción | Vercel (integración Git) |
| 5. Runtime | App + Auth + RLS | Vercel + Supabase |

### Variables en producción (Vercel)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo servidor)

### Cómo se dispara

1. Push a `main` en `your-org/control-inventarios`
2. Vercel despliega automáticamente
3. En paralelo, Actions valida lint/build

---

## 2. Pipeline operativo de inventario (negocio)

Todos los módulos alimentan el **mismo stock** y el **kardex** (`stock_movements`).

```mermaid
flowchart TB
  subgraph Entradas
    E1[Compra / recepción]
    E2[Ajuste positivo físico]
  end

  subgraph Salidas
    S1[Salida manual]
    S3[Dotación por camarera]
    S4[Ajuste negativo físico]
    S5[Surtir linner recepción no-blancos]
  end

  E1 --> K[Kardex stock_movements]
  E2 --> K
  S1 --> K
  S3 --> K
  S4 --> K
  S5 --> K

  K --> P[products.quantity_on_hand]
  P --> A[Alertas vs stock_minimo]
  P --> R[Reportes]
  K --> EST[Estadísticas vs ocupación]

  subgraph Satélites
    B[Blancos - estados y linners]
    Rec[Linner recepción]
    U[Uniformes - 4 grupos]
    M[Maquinaria y equipos]
  end

  B -.-> P
  Rec -.-> K
  U -.-> P
  M -.->|no mueve stock| M
```

Surtir blancos a un linner de piso **no** pasa por el kardex (sub-ubicación de `available`).

### Cadena lógica (resumen)

```
Entrada / salida / dotación / conteo físico / linner recepción (no-blancos)
        ↓
   Kardex (traza)
        ↓
   Existencia actualizada
        ↓
   Alertas · Reportes · Gráficas
```

### Ejemplo concreto: inventario físico

```mermaid
sequenceDiagram
  participant Piso
  participant App
  participant DB as Supabase
  participant Stock as products

  Piso->>App: Abrir conteo (borrador)
  App->>DB: physical_counts + lines (system_qty)
  Piso->>App: Guardar counted_qty (vacío no es 0)
  Note over App: Revisar diferencias
  Piso->>App: Cerrar / publicar
  App->>DB: post_physical_count
  App->>DB: stock_movements (in/out) + source
  App->>Stock: quantity_on_hand ajustado
```

---

## 3. Pipeline de un cambio típico (día a día)

```text
1. Editar código (módulo / UI / action)
2. Probar en local: npm run dev
3. git add + commit (mensaje claro)
4. git push origin main
5. Esperar:
   - Actions: CI verde
   - Vercel: Deployment Ready
6. Verificar en producción (login + módulo tocado)
```

---

## 4. Archivos relacionados

| Archivo | Rol |
|---------|-----|
| `.github/workflows/ci.yml` | Pipeline CI (test + lint + build) |
| Vercel → Project → Git | Deploy automático desde `main` |
| `docs/product-spec.md` | Reglas de negocio del pipeline operativo |
| `docs/schema-mvp.md` / `schema-modules.md` | Tablas que alimentan el kardex |

---

*Hotel Demo — Control de inventarios*
