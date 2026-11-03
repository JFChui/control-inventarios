"""One-off generator for the scanned catalog migration and TS module."""
from pathlib import Path

# (code, name, category) category in AMEN BLAN QUIM INSU
EST = [
    ("STY-0001", "CEPILLO DE MADERA CON PLATO", "INSU"),
    ("STY-0002", "VELAS AROMATICAS", "INSU"),
    ("STY-0003", "ASPENSORES", "INSU"),
    ("STY-0004", "PROTECTORES DE TELA SCOTCHGARD", "QUIM"),
    ("STY_0003", "PAPEL HIGIENICO J.R 9 BLANCO INSTITUCIONAL", "INSU"),
    ("STY_0004", "CEPILLO DE LAVAR MANGO CORTO", "INSU"),
    ("STY_0005", "PAPEL HIGIENICO BLANCO X 48", "INSU"),
    ("STY_0008", "GUANTES DE GOMA AMARILLO TALLA M (9 1/2)", "INSU"),
    ("STY_0010", "ESPONJA DOBLE USO 3M", "INSU"),
    ("STY_0011", "TOBO PLASTICO CON ASA 10 LT.", "INSU"),
    ("STY_0012", "CEPILLO PARA WC", "INSU"),
    ("STY_0014", "CEPILLO PARA BARRER CERDA DURA", "INSU"),
    ("STY_0015", "COLETO DE 3 RAYAS", "INSU"),
    ("STY_0017", "BOLSAS PLASTICAS PARA PAPELERA HAB. (IM) PAQ DE 100 UNID", "INSU"),
    ("STY_0027", "OASIS 256-58", "QUIM"),
    ("STY_0039", "PORTA VASOS (PQT DE 100 UNIDADES)", "INSU"),
    ("STY_0046", "MOPA INDUSTRIAL #36", "INSU"),
    ("STY_0047", "DISCO PLASTIRRODE 20 BLANCO - ALTA VELOCIDAD", "INSU"),
    ("STY_0053", "PULE SPRAY", "QUIM"),
    ("STY_0054", "CRISTAFULL", "QUIM"),
    ("STY_0060", "DISCO PLASTIRRODE 21 NEGRO 3M", "INSU"),
    ("STY_0071", "DISCO S/B BONNET PARA ALFOMBRA 3M (CAJA x 5 UNID)", "INSU"),
    ("STY_0075", "LANA DE ACERO #3", "INSU"),
    ("STY_0076", "REMOVEDOR DE CHICLE 3M (CAJA x 6 UNID)", "QUIM"),
    ("STY_0077", "TROUBLE SHOOTER 3M (CAJA x 12 LATAS 652GR)", "QUIM"),
    ("STY_0080", "CARPETRON 1 GALON", "QUIM"),
    ("STY_0085", "CERA PARA PISOS PLASTICA NEUTRA (SURPASS) GALON", "QUIM"),
    ("STY_0088", "AMBIENTADOR FRAGANCIA MANZANA VERDE (GALON 4 LTS)", "QUIM"),
    ("STY_0089", "CLEAN V - LIMPIADOR DE VIDRIOS (PAILA 20 LTS)", "QUIM"),
    ("STY_0096", "MULTIPROPOSITO (MULTIQUAT- ECO)", "QUIM"),
    ("STY_0100", "PALA PARA BASURA", "INSU"),
    ("STY_0102", "FULSEAL (SELLADOR PARA PISOS)", "QUIM"),
    ("STY_0113", "TOALLAS BLANCAS BRILUZ 12 X 180", "INSU"),
    ("STY_0115", "PLUMEROS", "INSU"),
    ("STY_0116", "PAÑO AMARILLO", "INSU"),
    ("STY_0117", "KAO STERICIDE ( GEL ANTIBACTERIAL )", "QUIM"),
    ("STY_0119", "PORTA MOPA MANGO ALUMINIO INDUSTRIAL", "INSU"),
    ("STY_0120", "FULGLOS (CERA)", "QUIM"),
    ("STY_0122", "ESCOBILLON MATA ARAÑA", "INSU"),
    ("STY_0124", "COLCHONETA DE YOGA", "INSU"),
    ("STY_0125", "LINDERME (LIMPIADOR DE ACERO INOXIDABLE)", "QUIM"),
    ("STY_0132", "KAO HAND ( JABON DE MANO CON AROMA)", "QUIM"),
    ("STY_0140", "PAÑOS MICROFIBRA DE COLORES", "INSU"),
    ("STY_0141", "PISTOLAS IONIZANTES", "INSU"),
    ("STY_0152", "CARTELES (RECICLAJE) TAMAÑO 8CM DE DIAMETRO EN VINIL AUTOADHESIVO", "INSU"),
]

LEN = [
    ("LENC00001", "ALMOHADA DE PLUMAS KING (MEDIDAS 0.50 x 0.90)", "BLAN"),
    ("LENC00003", "ALMOHADA DE PLUMAS QUEEN MEDIDA: 0.50 x 0.70", "BLAN"),
    ("LENC00005", "BATA DE BAÑO CON LOGO HOTEL", "BLAN"),
    ("LENC00008", "COBIJA INDIVIDUAL 1.50x2.20 CM, COLOR MARFIL", "BLAN"),
    ("LENC00009", "COBIJA KING 2.40x2.00 CM, COLOR MARFIL", "BLAN"),
    ("LENC00010", "COBIJA LAFAYETTE INDIVIDUAL", "BLAN"),
    ("LENC00011", "COBIJA LAFAYETTE KING", "BLAN"),
    ("LENC00022", "FORRO PARA MESA DE PLANCHAR", "BLAN"),
    ("LENC00026", "FUNDA QUEEN - MEDIDAS 0.55 x 0.80 (CAJA x 100 UNID)", "BLAN"),
    ("LENC00027", "INSERTO / PLUMONES KING (MEDIDAS 1.95 x 1.95)", "BLAN"),
    ("LENC00030", "PROTECTOR DE ALMOHADA KING (MEDIDAS 0.50 x 0.90)", "BLAN"),
    ("LENC00031", "PROTECTOR DE ALMOHADA QUEEN MEDIDAS 0.50 x 0.70", "BLAN"),
    ("LENC00032", "PROTECTOR DE COLCHON DE CUNA", "BLAN"),
    ("LENC00046", "SABANAS QUEEN MEDIDAS 2.40 x 2.60", "BLAN"),
    ("LENC00047", "TOALLA ALFOMBRIN PARA PIES - MEDIDAS 0.50 x 0.70 BLANCO", "BLAN"),
    ("LENC00049", "TOALLA PARA CUERPO GYM 51 X 101 CM (2024)", "BLAN"),
    ("LENC00051", "TOALLA COUNTRY COVER DELUXE PARA PISO (ALFOMBRIN)", "BLAN"),
    ("LENC00052", "TOALLA DE CUERPO MEDIDAS 0.70 x 1.50 (2024)", "BLAN"),
    ("LENC00053", "TOALLA DE MANO MEDIDAS 70 X 45 (2024)", "BLAN"),
    ("LENC00054", "TOALLA FACIAL MEDIDAS 0.30 x 0.30 (CAJA x 100 UNID)", "BLAN"),
    ("LENC00055", "TOALLA PARA CUERPO 0.76x1.60 CM, 450GR, COLOR BLANCO CON RAYAS AZUL (GIMNASIO) 24 UND X CAJA", "BLAN"),
    ("LENC00058", "TOALLA PISCINA AZUL 1.60 X 85 CM (2024)", "BLAN"),
    ("LENC00059", "ZIPPED PILLOW PROTECTOR KING, 180 TC, 50% POLY, 50% COTTON, SIZE 20x36, WITH SMALL ZIP (CAJA x 100 UNID)", "BLAN"),
    ("LENC00060", "ZIPPED PILLOW PROTECTOR QUEEN, 180 TC, 50% POLY, 50% COTTON, SIZE 20x30, WITH SMALL ZIP (CAJA x 100 UNID)", "BLAN"),
    ("LENC00068", "TOALLA GYM COLOR CENIZA (AMA DE CASA)", "BLAN"),
    ("LENC00069", "SABANAS KING (DIST.HOGAR)", "BLAN"),
    ("LENC00070", "PROTECTOR DE COLCHON KING (DIST.HOGAR)", "BLAN"),
    ("LENC00071", "PROTECTOR DE COLCHON FULL/MAT/DOBLE (DIST.HOGAR)", "BLAN"),
    ("LENC00072", "DUVET INSERT KING (DIST.HOGAR)", "BLAN"),
    ("LENC00073", "DUVET INSERT ANTIALERG. K (DIST. HOGAR)", "BLAN"),
    ("LENC00074", "DUVET INSERT ANTIALERG. FULL/MAT/DO (DIST.HOGAR)", "BLAN"),
    ("LENC00075", "DUVET COVER KING (DIST.HOGAR)", "BLAN"),
    ("LENC00076", "DUVET COVER FULL/MAT/DOBLE (DIST.HOGAR)", "BLAN"),
    ("LENC00077", "FUNDA KING (DIST.HOGAR)", "BLAN"),
    ("LENC00078", "ALMOHADA KING (DIST.HOGAR)", "BLAN"),
    ("LENC00079", "ALMOHADA ANTIALERGICA (DIST.HOGAR)", "BLAN"),
]

LAV = [
    ("LAV_0001", "PERBORATO DE SODIO", "QUIM"),
    ("LAV_0014", "ALMIDON", "QUIM"),
    ("LAV_0019", "CERA (HOT WIPE LIMPIAR PLANCHAS)", "QUIM"),
    ("LAV_0026", "CARTON PARA DOBLADO DE CAMISAS", "INSU"),
    ("LAV_0027", "RUST STAIN DE ADCO", "QUIM"),
    ("LAV_0031", "ROLLO QUITA PELUZA", "INSU"),
    ("LAV_0048", "GRAPAS PLASTICAS (CJ 10.000 UND)", "INSU"),
    ("LAV_0049", "MARQUILLAS NOWASTE #1", "INSU"),
    ("LAV_0050", "MARQUILLAS NOWASTE #2", "INSU"),
    ("LAV_0051", "MARQUILLAS NOWASTE #3", "INSU"),
    ("LAV_0052", "MARQUILLAS NOWASTE #4", "INSU"),
    ("LAV_0053", "MARQUILLAS NOWASTE #5", "INSU"),
    ("LAV_0054", "MARQUILLAS NOWASTE #6", "INSU"),
    ("LAV_0055", "MARQUILLAS NOWASTE #7", "INSU"),
    ("LAV_0056", "MARQUILLAS NOWASTE #8", "INSU"),
    ("LAV_0064", "DETERGENTE AL SECO TRIPLE X DFB", "QUIM"),
    ("LAV_0074", "AGUJA PARA PISTOLA DENNISON (4 P/CAJITA)", "INSU"),
    ("LAV_0080", "KAO LIZER (BLANQUEADOR POLVO) SACO 20 KG", "QUIM"),
    ("LAV_0083", "KAO 87 MAX (LIMPIADOR MULTIUSO) CARB. 20 LTS", "QUIM"),
    ("LAV_0085", "T2 (DESMANCHADOR PROTEINA, ALBUMINA) GALON", "QUIM"),
    ("LAV_0086", "T3 (DESMANCHADOR OXIDO) GALON", "QUIM"),
    ("LAV_0089", "ROLLOS PLASTICO #76 P7 TRAJES", "INSU"),
    ("LAV_0090", "FORROS PRESMOR PARA PLANCHA GRANDE", "INSU"),
    ("LAV_0091", "ESPATULA DE HUESO", "INSU"),
    ("LAV_0096", "CARETA PARA ESMERILAR TRANSPARENTE", "INSU"),
    ("LAV_0107", "PAJARILLAS PARA CUELLO DE CAMISAS (PAQ 500 UNDS)", "INSU"),
    ("LAV_0108", "FORRO PRESMOR BLANCO", "INSU"),
    ("LAV_0109", "FORRO PRESMOR PARA PLANCHA PUÑO/CUELLO", "INSU"),
    ("LAV_0111", "K75 (NEUTRALIZANTE) 60 LTS", "QUIM"),
    ("LAV_0112", "PINZA DE LAVANDERIA", "INSU"),
    ("LAV_0113", "KAO CLOREX CARB. 20 LT (CLORO SANITIZANTE)", "QUIM"),
    ("LAV_0115", "KAO SOFT LN (SUAVIZANTE) GL 3.78 LT", "QUIM"),
    ("LAV_0118", "LARK PLUS CARBOYA 70 KG", "QUIM"),
    ("LAV_0119", "LARK GENT L CARBOYA 60 KG", "QUIM"),
    ("LAV_0120", "WHISTENING CARBOYA 70 KG", "QUIM"),
    ("LAV_0121", "LARK HL CARBOYA 66 KG", "QUIM"),
    ("LAV_0122", "LARK SOFTENER FLORAL CARBOYA 60 KG", "QUIM"),
    ("LAV_0123", "LARK RC SACO 20 KG", "QUIM"),
    ("LAV_0124", "WYANDOTTE ANTIMANCHAS GL 3.79", "QUIM"),
    ("LAV_0125", "LARK MULTIUSO 20 KG", "QUIM"),
    ("LAV_0128", "LARK SOFTENER FLORAL PAILA 20 KG", "QUIM"),
    ("LAV_0130", "GANCHOS DE ALAMBRE BLANCOS PANTALON (PAQ. 360 UNID)", "INSU"),
    ("LAV_0131", "GANCHOS DE ALAMBRE BLANCOS CAMISAS (PAQ. 360 UNID)", "INSU"),
    ("LAV_0132", "GANCHO RECOMPOSICION", "INSU"),
    ("LAV_0133", "CAJA DE AMARRES 4\"", "INSU"),
    ("LAV_0134", "KAO ODOR AROMATIZANTE", "QUIM"),
]

SUM = [
    ("SUM00001", "ACONDICIONADOR CJ 440 UND (FRASCO MODELO R 45CC - JC)", "AMEN"),
    ("SUM00003", "BLOCK CAJA CHICA (PETIT CASH) (RESGUARDO EN CAJA GENERAL)", "INSU"),
    ("SUM00004", "BLOCK DUE BACK (DE PAPEL QUIMICO CON 1 ORIGINAL Y 2 COPIAS)", "INSU"),
    ("SUM00005", "BLOCK MISCELANEOS CHARGE", "INSU"),
    ("SUM00006", "BLOCK ORDEN DE TRANSPORTE (TAXI)", "INSU"),
    ("SUM00007", "BLOCK REBATE", "INSU"),
    ("SUM00008", "BLOCK ROOM SERVICE (AMENIDADES)", "INSU"),
    ("SUM00017", "CANDADO ESTILISTA TRABAJANDO", "AMEN"),
    ("SUM00019", "CANDADO LITTLE PRIVACY (UND 50)", "AMEN"),
    ("SUM00021", "CARPETAS HOTEL", "INSU"),
    ("SUM00023", "CLAIM CHECKS BOTONES (PQT x 100 UNID)", "INSU"),
    ("SUM00024", "TAZA MUG PARA HAB NEGRA", "AMEN"),
    ("SUM00028", "COLGANTES CORBATIN BOTELLAS DE AGUA (100UND x PQT)", "AMEN"),
    ("SUM00030", "COSTURERO (ESTUCHE) (CAJA x 750 UNID) JC", "AMEN"),
    ("SUM00031", "CREMA HUMECTANTE CJ 440 UND (FRASCO MODELO R 45CC - JC)", "AMEN"),
    ("SUM00034", "ENJUAGUE BUCAL (FRASCO MODELO R 40CC) JC", "AMEN"),
    ("SUM00035", "ETIQUETA PARA CAJA DE SEGURIDAD", "INSU"),
    ("SUM00037", "FONDO DE PAPELERA (PAQUETE x 100 UNID)", "INSU"),
    ("SUM00038", "GEL DE BAÑO CJ 440 UND (FRASCO MODELO R 45CC - JC)", "AMEN"),
    ("SUM00041", "GORRO DE BAÑO EN BOLSITA TRANSPARENTE CAJA", "AMEN"),
    ("SUM00044", "HANGERS MENS OPEN HOOK (GANCHOS LISOS ABIERTO) 1x100", "AMEN"),
    ("SUM00045", "HANGERS SATIN PADDED OPEN HOOK (GANCHOS SATEN ABIERTO) 1x100", "AMEN"),
    ("SUM00046", "HOJAS CARTA MEMBRETADAS", "INSU"),
    ("SUM00052", "IRON AUTO SHUT-OFF RETRACTABLE CORD (PLANCHA)", "AMEN"),
    ("SUM00055", "JABON RECTANGULAR 50G (ESTUCHE CARTON A 2 COLORES) CAJA X 300 UND (JC)", "AMEN"),
    ("SUM00058", "KEY CARD ELITE (CAJA x 200 UNID)", "INSU"),
    ("SUM00062", "KIT DENTAL (ESTUCHE CARTON 2 COLORES - 1 CEPILLO LARGO Y 1 C) JC", "AMEN"),
    ("SUM00069", "ENJUAGUE BUCAL 250ML (VENTA EN FRONT)", "AMEN"),
    ("SUM00072", "PAPEL FORMAS CONTINUAS (FACTURAS CAJA)", "INSU"),
    ("SUM00074", "PLANCHA PARA ROPA A VAPOR, ANTIADHERENTE", "AMEN"),
    ("SUM00075", "PORTA LLAVES BLANCA / KEY POCKET (PQT x 100)", "INSU"),
    ("SUM00076", "PORTA LLAVES ELITE / KEY POCKET (PQT x 100 UNID)", "INSU"),
    ("SUM00082", "SHAMPOO CJ 440 UND (FRASCO MODELO R 45CC - JC)", "AMEN"),
    ("SUM00087", "SOBRES DE CAJERO (PQT x 100 UNID)", "INSU"),
    ("SUM00090", "STICKER CON LOGO HOTEL (PQT 50 UNID)", "INSU"),
    ("SUM00092", "TARJETA DE SUSTAINABILITY (PQT x 100 UNID)", "INSU"),
    ("SUM00094", "TARJETA SENSORY REFRESH (PAQUETE x 50 UNID)", "INSU"),
    ("SUM00097", "TARJETAS TURNDOWN UNABLECARD (PQT 50 UNID)", "INSU"),
    ("SUM00099", "TICKET BANDA MAGNETICA (TKN-A01 - ESTACIONAMIENTO) (CAJA 5000 UND)", "INSU"),
    ("SUM00100", "TICKETS DE VALET PARKING (PQT x 100 UNID)", "INSU"),
    ("SUM00104", "VANITY SET (ESTUCHE CARTON 2 COLORES - 4 HISOPOS, 2 ALGODONES)", "AMEN"),
    ("SUM00108", "PAPEL FORMAS CONTINUAS (RECIBOS DE PAGO CAJA x 2.000 UNI)", "INSU"),
    ("SUM00112", "BOLIGRAFO STRIPE LINE NEGRO PRINTA", "INSU"),
    ("SUM00114", "TARJETA SER VERDE ES FACIL (PAQ X 100)", "INSU"),
    ("SUM00115", "CAFE COFFEE PAK NORMAL (SOBRE 2 TAZAS) PARAMO", "AMEN"),
    ("SUM00116", "BOLSA ECOLOGICA PARA SECADOR", "AMEN"),
    ("SUM00118", "PAÑUELOS FACIALES KLEENEX (BULTOS X 18 PQTE)", "AMEN"),
    ("SUM00119", "CAFE COFFEE PAK DESCAFEINADO (SOBRE 2 TAZAS)", "AMEN"),
    ("SUM00122", "TAPA 6 OZ COLOR (CAJA x 1.000 UNID)", "AMEN"),
    ("SUM00123", "TARJETAS BUENAS NOCHES (PAQ X 100)", "INSU"),
    ("SUM00133", "TARJETA BIENVENIDA AL HUESPED (250 UND)", "INSU"),
    ("SUM00135", "TOALLA ANTIBACTERIAL PARA LOS HUESPEDES", "AMEN"),
    ("SUM00148", "HILO DENTAL", "AMEN"),
    ("SUM00156", "BOLSA PARA VASO DE CAFE HABITACIONES (PAQ 200)", "AMEN"),
    ("SUM00159", "ESTUCHE CAFE KALDI SANARE", "AMEN"),
    ("SUM00160", "ESTUCHE CAFE KALDI ARABICA", "AMEN"),
    ("SUM00167", "ESTUCHE CAFE KALDI QUALITA EXTRA", "AMEN"),
    ("SUM00168", "SECADORES HAB (IMPORTACION)", "AMEN"),
    ("SUM00169", "PAPELERAS HAB (IMPORTACION)", "AMEN"),
    ("SUM00171", "PLANCHAS HAB (IMPORTACION)", "AMEN"),
    ("SUM00172", "RELOJ HAB (IMPORTACION)", "AMEN"),
    ("SUM00176", "TARJETAS BONVOY DISFRUTE DE SU COMIDA (PAQ 100 UNDS)", "INSU"),
    ("SUM00184", "SET RECOLECTOR DE BASURA", "INSU"),
    ("SUM00185", "LISTA LAVANDERIA (100 UNDS)", "INSU"),
    ("SUM00186", "CAJAS PARA 2 BOMBONES", "AMEN"),
    ("SUM00187", "CAJA PARA 1 BOMBON", "AMEN"),
    ("SUM00188", "BOLSAS PAPEL KRAFT LAVANDERIA (ENTREGA HUESPEDES)", "AMEN"),
    ("SUM00190", "KEY CARD WHITE (CAJA x 200 UNID)", "INSU"),
    ("SUM00191", "TARJETA MARRIOTT BONVOY AMBASSADOR GOLD MEMBER (PAQ 100 UNDS)", "INSU"),
    ("SUM00192", "SHAMPOO 300 ML CC/ VALVULA", "AMEN"),
    ("SUM00193", "ACONDICIONADOR 300 ML CC/ VALVULA", "AMEN"),
    ("SUM00196", "CHAMPU GALON", "AMEN"),
    ("SUM00197", "ACONDICIONADOR GALON", "AMEN"),
    ("SUM00198", "CREMA HUMECTANTE GALON", "AMEN"),
    ("SUM00199", "GEL DE BAÑO GALON", "AMEN"),
    ("SUM00200", "BOLSA TRANSPARENTE AUTOADHESIVA LAVANDERIA (PAQ. 100 UNID)", "AMEN"),
    ("SUM00201", "GEL DE BAÑO 300 ML CC/ VALVULA", "AMEN"),
    ("SUM00202", "TACOS CUADRADOS DE HOJAS BLANCAS (NOTAS) TALONARIOS UNIDADES", "INSU"),
    ("SUM00204", "MENU CANDADO BRAND STANDARD (PQT 100 UND)", "INSU"),
    ("SUM00205", "BLOCKS DE COMANDAS", "INSU"),
    ("SUM00206", "STICKERS (COLCHONES)", "INSU"),
    ("SUM00208", "CORBATIN PARA AMENIDADES (100 UND X PQT)", "AMEN"),
    ("SUM00209", "CALCOMANIAS PARA LAS AMENIDADES (250 UND X PQT) BLANCO, NEGRO, AZUL, AMARILLO", "INSU"),
    ("SUM00210", "TEND CARD (ESTIMADO HUESPED) PAQ. 50 UND", "INSU"),
    ("SUM00211", "PRESINTOS DE SEGURIDAD (AMENIDADES PAQ. 3000 UNID)", "AMEN"),
    ("SUM00212", "ROLLO DE CINTA (MAQUINA DE VALET PARKING)", "INSU"),
    ("SUM00213", "TEND CARD (AQUI TAMBIEN LIMPIAMOS) PAQ. 50 UND", "INSU"),
    ("SUM00214", "BLOCK ESTIMADO HUESPED (CAJA DE SEGURIDAD) PAQ. 50 UND", "INSU"),
    ("SUM00215", "ETIQUETA PARA ALMOHADA (PAQ. 100 UND)", "INSU"),
    ("SUM00216", "SNACK MENU (PAQ. DE 50 UND)", "INSU"),
    ("SUM00217", "TARJETA DISCULPE ESTUVE AQUI (PAQ. 100 UND)", "INSU"),
    ("SUM00218", "ESTUCHE CAFE KALDI CAFE & CACAO", "AMEN"),
    ("SUM00219", "POMO PARA PUERTA (MARRIOTT BONVOY SILVER MEMBER)", "AMEN"),
    ("SUM00220", "POMO PARA PUERTA (MARRIOTT BONVOY PLATINUM MEMBER)", "AMEN"),
    ("SUM00221", "POMO PARA PUERTA (MARRIOTT BONVOY TITANIUM MEMBER)", "AMEN"),
    ("SUM00222", "POMO PARA PUERTA (MARRIOTT BONVOY AMBASSADOR MEMBER)", "AMEN"),
    ("SUM00223", "POMO PARA PUERTA (MARRIOTT BONVOY GOLD MEMBER)", "AMEN"),
    ("SUM00224", "BLOCK PARA REUNIONES", "INSU"),
    ("SUM00228", "TARJETAS NOTAS HUESPEDES (IT'S BUSINESS UNUSUAL) PAQ. 100 UND", "INSU"),
    ("SUM00229", "FIRE TV", "AMEN"),
]

GROUPS = [("EST", EST), ("LEN", LEN), ("LAV", LAV), ("SUM", SUM)]

root = Path(__file__).resolve().parents[1]


def sql_str(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


rows = []
for dept, items in GROUPS:
    for code, name, category in items:
        rows.append(
            f"  ({sql_str(code)}, {sql_str(name)}, {sql_str(category)}, {sql_str(dept)})"
        )

sql = f"""-- Catálogo real del listado escaneado (código + descripción).
-- Existencia y stock mínimo quedan en 0: el PDF no trae cantidades.
-- Los productos demo del seed se desactivan si su código no está en el listado.

insert into public.departments (code, name)
values
  ('EST', 'Estilo'),
  ('LEN', 'Lencería'),
  ('SUM', 'Suministro huésped')
on conflict (code) do update
set name = excluded.name,
    is_active = true;

insert into public.products (code, name, category_id, unit, quantity_on_hand, min_stock, is_active)
select v.code, v.name, c.id, 'UND', 0, 0, true
from (
  values
{",\n".join(rows)}
) as v(code, name, category_code, department_code)
join public.product_categories c on c.code = v.category_code
on conflict (code) do update
set name = excluded.name,
    category_id = excluded.category_id,
    unit = excluded.unit,
    is_active = true;

insert into public.product_departments (product_id, department_id)
select p.id, d.id
from (
  values
{",\n".join(rows)}
) as v(code, name, category_code, department_code)
join public.products p on p.code = v.code
join public.departments d on d.code = v.department_code
on conflict (product_id, department_id) do nothing;

insert into public.linen_items (product_id, available)
select p.id, p.quantity_on_hand
from public.products p
join public.product_categories c on c.id = p.category_id
where c.code = 'BLAN'
  and p.code like 'LENC%'
on conflict (product_id) do nothing;

update public.products
set is_active = false
where code in ('AM-001', 'AM-002', 'BL-001', 'BL-002', 'QU-001', 'IN-001', 'IN-002')
  and code not in (
    select v.code
    from (
      values
{",\n".join(rows)}
    ) as v(code, name, category_code, department_code)
  );
"""

migration = root / "supabase" / "migrations" / "20261003023000_catalog_pdf_departments.sql"
migration.write_text(sql, encoding="utf-8")

ts_rows = []
for dept, items in GROUPS:
    for code, name, category in items:
        ts_rows.append(
            "  { "
            + f"code: {sql_str(code)}, name: {sql_str(name)}, category: {sql_str(category)}, department: {sql_str(dept)} "
            + "},"
        )

ts = """export type PdfCatalogItem = {
  code: string;
  name: string;
  category: "AMEN" | "BLAN" | "QUIM" | "INSU";
  department: "EST" | "LEN" | "LAV" | "SUM";
};

/** Transcripción revisada del listado escaneado. Existencias no vienen en el PDF. */
export const pdfCatalog: PdfCatalogItem[] = [
""" + "\n".join(ts_rows) + """
];

export function countByPrefix(items: PdfCatalogItem[] = pdfCatalog) {
  const counts = { STY: 0, LENC: 0, LAV: 0, SUM: 0 };
  for (const item of items) {
    if (item.code.startsWith("STY")) counts.STY += 1;
    else if (item.code.startsWith("LENC")) counts.LENC += 1;
    else if (item.code.startsWith("LAV")) counts.LAV += 1;
    else if (item.code.startsWith("SUM")) counts.SUM += 1;
  }
  return counts;
}
"""
(root / "src" / "lib" / "catalog" / "pdf-catalog.ts").write_text(ts, encoding="utf-8")

from collections import Counter
c = Counter()
for dept, items in GROUPS:
    for code, _, _ in items:
        if code.startswith("STY"):
            c["STY"] += 1
        elif code.startswith("LENC"):
            c["LENC"] += 1
        elif code.startswith("LAV"):
            c["LAV"] += 1
        elif code.startswith("SUM"):
            c["SUM"] += 1
print(dict(c), "total", sum(c.values()))
codes = [code for _, items in GROUPS for code, _, _ in items]
print("unique", len(set(codes)), "rows", len(codes))
