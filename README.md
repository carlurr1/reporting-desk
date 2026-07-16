# Reporting Desk — ETB

Herramienta para gestionar el **inventario y la programación de informes** que ETB
envía a sus clientes: mide productividad y cumplimiento por analista, **valida los
casos contra Salesforce**, conserva un **historial inmutable** y muestra dashboards
tipo Power BI. Reemplaza el manejo por Excel.

**Stack:** Next.js 15 + Supabase (PostgreSQL) + Vercel. Integración Salesforce por
login SOAP (usuario + contraseña + token), igual que Pulso / mayoristas-tracker.

> 📐 La visión completa (análisis de los archivos, modelo de datos, roles,
> seguridad y roadmap) está en **[`ARQUITECTURA.md`](./ARQUITECTURA.md)**.

---

## 1. Crear el proyecto en Supabase

1. [supabase.com](https://supabase.com) → **New project**. Guarda la contraseña.
2. **SQL Editor** → ejecuta los archivos de `supabase/` **en orden**:
   `01_schema` → `02_functions` → `03_rls` → `04_seed_catalogo` →
   `05_auditoria` → `06_vistas_kpi` → `07_rpc`.
   *(Opcional para ver el Tablero con datos de ejemplo antes de importar:
   ejecuta también `10_demo.sql`.)*
3. En **Project Settings → API** copia `URL`, `anon key` y `service_role key`.

## 2. Configurar el código

```bash
cd reporting-desk
npm install
cp .env.example .env.local     # pega las llaves de Supabase y Salesforce
```

## 3. Crear el primer superadmin

Como aún no hay usuarios, créalo una vez desde Supabase (**Auth → Users → Add user**
con un correo técnico, p.ej. `admin@reportingdesk.etb.local` + contraseña) y luego
inserta su perfil en el **SQL Editor**:

```sql
insert into public.usuarios (id, login, iniciales, nombre, apellido, rol, cargo)
select id, 'admin', 'AD', 'Administrador', 'Reporting', 'superadmin', 'Superadmin'
from auth.users where email = 'admin@reportingdesk.etb.local';
```

Desde ahí, el resto del equipo se crea desde la app (Server Action `crearUsuario`,
que usa la service role key). **Importante:** cada analista debe tener sus
**iniciales** (GA, KM, YM…) para que la importación del Excel lo empate.

## 4. Migrar los Excel actuales

```bash
export NEXT_PUBLIC_SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...

# Maestro de clientes (export de Salesforce)
npm run import:clientes    -- ./Inventario.xlsx CLIENTES_SF

# Programación de cada mes (repite por hoja)
npm run import:programacion -- ./Inventario.xlsx CALENDARIO_ABRIL 2026-04
npm run import:programacion -- ./Inventario.xlsx CALENDARIO_MARZO 2026-03

# Ficha operativa (supervisor, ANS)
npm run import:consulta     -- ./LIBRO_CONSULTA_CLIENTES.xlsx "INFO CLIENTES"
```

## 5. Desarrollar y desplegar

```bash
npm run dev            # http://localhost:3000
```

Para producción: sube el repo a GitHub → Vercel → **New Project** → selecciona la
carpeta `reporting-desk` como *Root Directory* → pega las variables de entorno →
Deploy. Cada push re-despliega.

---

## Cómo está protegido

- **RLS en todas las tablas** (`03_rls.sql`): el analista solo edita **sus**
  informes; nadie borra el histórico.
- **Auditoría inmutable** (`05_auditoria.sql`): cada cambio queda registrado con
  quién/cuándo/qué; la bitácora no se puede alterar.
- **Service role key solo en el servidor** (Server Actions). Nunca en el cliente.
- **Credenciales de Salesforce solo en variables de entorno** del servidor.

## Estado actual (Fase 0 + Fase 1)

**Fase 0 · Cimientos:** esquema completo, auth+roles, auditoría inmutable, vistas
KPI, integración Salesforce e importadores de los dos Excel.

**Fase 1 · Operación:**
- **Tablero** con KPIs, productividad por analista, dona de estados y cumplimiento
  por segmento (Recharts).
- **Mi bandeja** (analista): lista sus informes del período y registra el envío
  con el **Caso SF**, que se **valida en vivo contra Salesforce** (trae el nombre
  del cliente y marca el caso como válido si coincide).
- **Programación** (coordinador/superadmin): tabla de programaciones, reasignar
  analista, crear nuevas y **generar el período** (crea los informes del mes).

Interfaz por **pestañas según el rol**. Lo siguiente (Fase 2) es rotación de
buzones, alertas de atraso y metas — ver el roadmap en `ARQUITECTURA.md`.
