"""Read uniform-codes.xlsx and write the uniform_workers migration."""

from __future__ import annotations

import argparse
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
SPACE_RE = re.compile(r"\s+")

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_XLSX = Path("uniform-codes.xlsx")
DEFAULT_OUT = ROOT / "supabase" / "migrations" / "20261010180000_uniform_workers.sql"

HEADER_MAP = {
    "COD. UNIFORME": "uniform_code",
    "APELLIDOS": "last_name",
    "NOMBRES": "first_name",
    "DEPARTAMENTO": "staff_department",
    "CARGO": "position",
}


def collapse_spaces(value: str) -> str:
    return SPACE_RE.sub(" ", (value or "").strip())


def sql_str(value: str) -> str:
    return "'" + collapse_spaces(value).replace("'", "''") + "'"


def col_index(cell_ref: str) -> int:
    letters = "".join(ch for ch in cell_ref if ch.isalpha())
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch.upper()) - 64)
    return n - 1


def shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    out: list[str] = []
    for si in root.findall("m:si", NS):
        out.append("".join(t.text or "" for t in si.findall(".//m:t", NS)))
    return out


def cell_text(cell: ET.Element, strings: list[str]) -> str:
    kind = cell.get("t")
    if kind == "s":
        v = cell.find("m:v", NS)
        if v is None or v.text is None:
            return ""
        return strings[int(v.text)]
    if kind == "inlineStr":
        return "".join(t.text or "" for t in cell.findall(".//m:t", NS))
    v = cell.find("m:v", NS)
    if v is None or v.text is None:
        return ""
    text = v.text
    if kind in (None, "n") and re.fullmatch(r"-?\d+\.0+", text):
        return str(int(float(text)))
    return text


def sheet_rows(zf: zipfile.ZipFile, strings: list[str]) -> list[list[str]]:
    path = "xl/worksheets/sheet1.xml"
    if path not in zf.namelist():
        raise SystemExit("No se encontró xl/worksheets/sheet1.xml en el Excel.")
    root = ET.fromstring(zf.read(path))
    rows: list[list[str]] = []
    for row in root.findall("m:sheetData/m:row", NS):
        cells: dict[int, str] = {}
        max_idx = -1
        for cell in row.findall("m:c", NS):
            ref = cell.get("r") or "A1"
            idx = col_index(ref)
            cells[idx] = cell_text(cell, strings)
            max_idx = max(max_idx, idx)
        rows.append([cells.get(i, "") for i in range(max_idx + 1)])
    return rows


def parse_workers(xlsx: Path) -> list[dict[str, str]]:
    with zipfile.ZipFile(xlsx) as zf:
        rows = sheet_rows(zf, shared_strings(zf))
    if not rows:
        raise SystemExit("El Excel no tiene filas.")

    header = [collapse_spaces(h).upper() for h in rows[0]]
    indexes: dict[str, int] = {}
    for i, name in enumerate(header):
        key = HEADER_MAP.get(name)
        if key:
            indexes[key] = i
    missing = [col for col in HEADER_MAP.values() if col not in indexes]
    if missing:
        raise SystemExit(f"Faltan columnas en el Excel: {', '.join(missing)}")

    workers: list[dict[str, str]] = []
    codes: set[str] = set()
    for row in rows[1:]:
        if not any(collapse_spaces(c) for c in row):
            continue
        record = {
            key: collapse_spaces(row[idx] if idx < len(row) else "")
            for key, idx in indexes.items()
        }
        if not record["uniform_code"]:
            raise SystemExit(f"Fila sin código de uniforme: {record}")
        if record["uniform_code"] in codes:
            raise SystemExit(f"Código duplicado: {record['uniform_code']}")
        codes.add(record["uniform_code"])
        workers.append(record)
    return workers


SCHEMA = r"""-- Padrón de uniformes (personal del hotel) + asignación por worker_id.
-- staff_department es texto del hotel; no toca public.departments.

create table if not exists public.uniform_workers (
  id uuid primary key default gen_random_uuid(),
  uniform_code text not null unique,
  last_name text not null,
  first_name text not null,
  staff_department text not null,
  position text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists uniform_workers_set_updated_at on public.uniform_workers;
create trigger uniform_workers_set_updated_at
before update on public.uniform_workers
for each row execute function public.set_updated_at();

alter table public.uniform_workers enable row level security;

drop policy if exists uniform_workers_select on public.uniform_workers;
create policy uniform_workers_select
  on public.uniform_workers for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists uniform_workers_write on public.uniform_workers;
create policy uniform_workers_write
  on public.uniform_workers for all
  to authenticated
  using ((select public.has_hr_scope()))
  with check ((select public.has_hr_scope()));

revoke all on table public.uniform_workers from public, anon;
grant select, insert, update on table public.uniform_workers to authenticated;

alter table public.uniform_assignments
  add column if not exists worker_id uuid references public.uniform_workers (id) on delete restrict;

create index if not exists uniform_assignments_worker_id_idx
  on public.uniform_assignments (worker_id);

drop function if exists public.assign_uniform(uuid, text, numeric, text);

create or replace function public.assign_uniform(
  p_sku_id uuid,
  p_worker_id uuid,
  p_qty numeric,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sku public.uniform_skus%rowtype;
  worker public.uniform_workers%rowtype;
  new_id uuid;
  display_name text;
begin
  if not public.has_hr_scope() then
    raise exception 'Sin permiso para asignar uniformes';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad inválida';
  end if;
  if p_worker_id is null then
    raise exception 'Trabajador obligatorio';
  end if;

  select * into worker
  from public.uniform_workers
  where id = p_worker_id;

  if not found then
    raise exception 'Trabajador no encontrado';
  end if;
  if not worker.is_active then
    raise exception 'El trabajador está inactivo';
  end if;

  display_name := worker.uniform_code || ' — ' || worker.last_name || ' ' || worker.first_name;

  select * into sku from public.uniform_skus where id = p_sku_id for update;
  if not found then
    raise exception 'Uniforme no encontrado';
  end if;
  if sku.available < p_qty then
    raise exception 'No hay suficientes uniformes disponibles';
  end if;

  update public.uniform_skus
  set available = available - p_qty,
      in_use = in_use + p_qty,
      updated_at = now()
  where id = p_sku_id;

  insert into public.uniform_assignments (sku_id, worker_id, worker_name, quantity, assigned_by, notes)
  values (p_sku_id, worker.id, display_name, p_qty, auth.uid(), p_notes)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.assign_uniform(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.assign_uniform(uuid, uuid, numeric, text) to authenticated;

-- SKUs de prueba del arranque: 0 asignaciones y 0 ajustes.
delete from public.uniform_skus
where code in ('UNI-1', '1455');
"""


def values_sql(workers: list[dict[str, str]]) -> str:
    lines = []
    for w in workers:
        lines.append(
            "  ("
            + ", ".join(
                [
                    sql_str(w["uniform_code"]),
                    sql_str(w["last_name"]),
                    sql_str(w["first_name"]),
                    sql_str(w["staff_department"]),
                    sql_str(w["position"]),
                ]
            )
            + ")"
        )
    return ",\n".join(lines)


def build_sql(workers: list[dict[str, str]]) -> str:
    seed = f"""
insert into public.uniform_workers (
  uniform_code, last_name, first_name, staff_department, position
)
values
{values_sql(workers)}
on conflict (uniform_code) do update
set last_name = excluded.last_name,
    first_name = excluded.first_name,
    staff_department = excluded.staff_department,
    position = excluded.position,
    is_active = true,
    updated_at = now();
"""
    return SCHEMA.rstrip() + "\n" + seed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    if not args.xlsx.exists():
        raise SystemExit(f"No existe el Excel: {args.xlsx}")

    workers = parse_workers(args.xlsx)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(build_sql(workers), encoding="utf-8")

    depts = sorted({w["staff_department"] for w in workers})
    sys.stdout.write(
        f"Wrote {len(workers)} workers / {len(depts)} departments to {args.out}\n"
    )


if __name__ == "__main__":
    main()
