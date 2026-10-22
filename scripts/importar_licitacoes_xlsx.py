#!/usr/bin/env python3
"""Converte a planilha anual de licitações em inserções idempotentes no modelo do site."""
import argparse
import hashlib
import json
import re
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
ACTIVITY_ID = "2feaa216-5e46-4331-93a4-02ba2307ea3b"
YEAR_ID = "5ea47bac-933b-46b0-aa9e-8eda7359371e"
GROUPS = {
    "FUNDO GERAL": "1c0ecb21-fb2e-456e-b753-8f1ee48a304b",
    "SEC. EDUCAÇÃO": "cac823b5-4151-46fe-9950-bc42e683fce0",
    "SEC. SAÚDE": "ce0ee43f-c7ca-48f2-a6b6-e03ef325ab2c",
    "SEC. ASSISTÊNCIA SOCIAL": "6808b6c4-7dda-40b1-898a-694c0002f94c",
}
ALL_GROUPS = list(GROUPS)
MANUAL_TARGETS = {
    130: ["SEC. EDUCAÇÃO"], 131: ["SEC. EDUCAÇÃO"], 132: ["SEC. EDUCAÇÃO"], 133: ["SEC. EDUCAÇÃO"],
    134: ["FUNDO GERAL"], 274: ["FUNDO GERAL"],
    281: ["SEC. SAÚDE"], 282: ["SEC. SAÚDE"], 283: ["SEC. SAÚDE"], 284: ["SEC. SAÚDE"], 285: ["SEC. SAÚDE"], 286: ["SEC. SAÚDE"],
    360: ["FUNDO GERAL"], 361: ALL_GROUPS, 389: ["FUNDO GERAL"], 397: ["FUNDO GERAL"],
}
REVOKED_EDUCATION_ROWS = {277, 372}


def clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def read_workbook(path):
    with ZipFile(path) as archive:
        shared = []
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        for item in root.findall(f"{{{NS}}}si"):
            shared.append("".join(node.text or "" for node in item.iter(f"{{{NS}}}t")))
        result = {}
        for sheet_name, filename in (("PROCESSOS 2025", "xl/worksheets/sheet1.xml"), ("ADESÃO ATA", "xl/worksheets/sheet2.xml")):
            root = ET.fromstring(archive.read(filename)); rows = {}
            for row in root.findall(f".//{{{NS}}}row"):
                number = int(row.attrib["r"]); values = {}
                for cell in row.findall(f"{{{NS}}}c"):
                    column = re.match(r"[A-Z]+", cell.attrib["r"]).group()
                    node = cell.find(f"{{{NS}}}v"); raw = "" if node is None else node.text
                    if cell.attrib.get("t") == "s" and raw != "": value = shared[int(raw)]
                    elif cell.attrib.get("t") == "inlineStr": value = "".join(x.text or "" for x in cell.iter(f"{{{NS}}}t"))
                    else: value = raw
                    values[column] = value
                rows[number] = values
            merges = root.find(f"{{{NS}}}mergeCells")
            if merges is not None:
                for merge in merges:
                    start, end = merge.attrib["ref"].split(":")
                    ca, ra = re.match(r"([A-Z]+)(\d+)", start).groups(); cb, rb = re.match(r"([A-Z]+)(\d+)", end).groups()
                    if ca == cb:
                        for number in range(int(ra) + 1, int(rb) + 1): rows.setdefault(number, {})[ca] = rows[int(ra)].get(ca, "")
            result[sheet_name] = rows
        return result


def excel_date(value):
    text = clean(value)
    if not text: return ""
    try:
        number = float(text)
        if 20000 <= number <= 80000:
            return (datetime(1899, 12, 30) + timedelta(days=number)).strftime("%d/%m/%Y")
    except ValueError:
        pass
    return text


def money(value):
    text = clean(value)
    if not text or text.upper() == "REVOGADO": return None
    text = re.sub(r"R\$", "", text, flags=re.I).replace(" ", "")
    if "," in text and "." in text: text = text.replace(".", "").replace(",", ".")
    elif "," in text: text = text.replace(",", ".")
    try: return round(float(text), 2)
    except ValueError: return None


def targets_for(label, row_number, object_text):
    label_norm = clean(label).upper()
    if row_number in REVOKED_EDUCATION_ROWS: return ["SEC. EDUCAÇÃO"]
    if not label_norm:
        if row_number in MANUAL_TARGETS: return MANUAL_TARGETS[row_number]
        raise ValueError(f"Linha {row_number} sem secretaria e sem regra segura: {object_text[:100]}")
    targets = []
    if "4 SEC" in label_norm or "4 FUND" in label_norm or "4 SECRET" in label_norm: return ALL_GROUPS
    if "FUNDO GERAL" in label_norm or "SEC. GERAL" in label_norm or "SEC, FUNDO" in label_norm: targets.append("FUNDO GERAL")
    if "EDUCA" in label_norm: targets.append("SEC. EDUCAÇÃO")
    if "SAÚDE" in label_norm or "SAUDE" in label_norm: targets.append("SEC. SAÚDE")
    if "ASSIST" in label_norm or label_norm == "FMAS": targets.append("SEC. ASSISTÊNCIA SOCIAL")
    if not targets: raise ValueError(f"Linha {row_number} com secretaria desconhecida: {label!r}")
    return list(dict.fromkeys(targets))


def build_records(path):
    book = read_workbook(path); digest = hashlib.sha256(Path(path).read_bytes()).hexdigest(); records = []; skipped = []
    rows = book["PROCESSOS 2025"]
    for number, row in sorted(rows.items()):
        if number <= 2 or number == 1165: continue
        data = {column: clean(row.get(column)) for column in "ABCDEFGHIJ"}
        if not any(data.values()): continue
        if data["A"] and not any(data[c] for c in "BCDEFGHIJ"):
            skipped.append({"sheet":"PROCESSOS 2025","row":number,"processo":data["A"],"reason":"linha reservada sem dados"}); continue
        targets = targets_for(data["H"], number, data["C"])
        notes = []
        if data["H"].upper() == "REVOGADO": notes.append("REVOGADO")
        if data["I"] and data["I"].upper() != "REVOGADO": notes.append(data["I"])
        if data["J"] and data["J"].upper() != "REVOGADO": notes.append("Conferido: " + data["J"])
        for target in targets:
            source_key = f"PROCESSOS-2025:{number}:{target}"
            extra = {
                "registro_tipo":"licitacao_lancamento", "processo":data["A"], "modalidade":data["B"], "objeto":data["C"],
                "fornecedor_numero":data["D"], "contrato":data["E"], "valor_global":money(data["G"]), "vigencia":excel_date(data["F"]),
                "obs":" | ".join(notes), "status_list":[], "licitacao_group_id":GROUPS[target], "import_source":"2025 RELAÇAO DE PROCESSOS (LICITAÇÃO).xlsx",
                "import_sheet":"PROCESSOS 2025", "import_row":number, "import_hash":digest, "import_original_secretaria":data["H"], "import_key":source_key,
            }
            records.append({"id":str(uuid.uuid5(uuid.NAMESPACE_URL,"gestao-atividades:"+digest+":"+source_key)),"group":target,"description":data["C"] or data["A"] or "Licitação","obs":extra["obs"],"extra":extra,"source_order":number})
    for number, row in sorted(book["ADESÃO ATA"].items()):
        if number <= 1: continue
        data = {column: clean(row.get(column)) for column in "ABCDEFGHI"}
        if not any(data.values()): continue
        targets = targets_for(data["C"], number, data["D"])
        process_match = re.search(r"PROC(?:ESSO)?\s*\d+/\d+", data["B"], re.I)
        process_number = process_match.group(0).upper() if process_match else data["B"]
        modality = clean(data["B"].replace(process_match.group(0), "", 1)) if process_match else "ADESÃO À ATA"
        notes = ["Data do contrato: " + excel_date(data["G"])] if data["G"] else []
        if data["I"]: notes.append("Aditivo: " + data["I"])
        for target in targets:
            source_key = f"ADESAO-ATA:{number}:{target}"
            extra = {
                "registro_tipo":"licitacao_lancamento", "processo":process_number, "modalidade":modality, "objeto":data["D"],
                "fornecedor_numero":data["E"], "contrato":data["A"], "valor_global":money(data["F"]), "vigencia":excel_date(data["H"]),
                "obs":" | ".join(notes), "status_list":[], "licitacao_group_id":GROUPS[target], "import_source":"2025 RELAÇAO DE PROCESSOS (LICITAÇÃO).xlsx",
                "import_sheet":"ADESÃO ATA", "import_row":number, "import_hash":digest, "import_original_secretaria":data["C"], "import_key":source_key,
            }
            records.append({"id":str(uuid.uuid5(uuid.NAMESPACE_URL,"gestao-atividades:"+digest+":"+source_key)),"group":target,"description":data["D"] or process_number,"obs":extra["obs"],"extra":extra,"source_order":1000+number})
    order = Counter()
    for record in records:
        record["order_num"] = order[record["group"]]; order[record["group"]] += 1
    return records, skipped, digest


def sql_for(records):
    payload = [{"id":r["id"],"group_id":GROUPS[r["group"]],"description":r["description"],"observacao":r["obs"],"order_num":r["order_num"],"extra":r["extra"]} for r in records]
    data = json.dumps(payload, ensure_ascii=False, separators=(",",":"))
    return f"""with payload as (
 select * from jsonb_to_recordset($import${data}$import$::jsonb)
 as x(id text,group_id text,description text,observacao text,order_num integer,extra jsonb)
)
insert into public.subitems(id,atividade_id,item_id,parent_id,parent_type,description,observacao,order_num,concluded,status,extra_fields,created_at,updated_at)
select id,'{ACTIVITY_ID}','{YEAR_ID}',group_id,'subitem',description,nullif(observacao,''),order_num,0,null,extra,now(),now() from payload
on conflict (id) do nothing;
select count(*)::int as total_importado from public.subitems where atividade_id='{ACTIVITY_ID}' and extra_fields->>'import_hash'='{records[0]['extra']['import_hash']}';"""


def main():
    parser=argparse.ArgumentParser(); parser.add_argument("xlsx"); parser.add_argument("--emit",choices=("report","sql"),default="report"); parser.add_argument("--offset",type=int,default=0); parser.add_argument("--limit",type=int,default=100000)
    args=parser.parse_args(); records,skipped,digest=build_records(args.xlsx)
    if args.emit=="report":
        print(json.dumps({"source_sha256":digest,"source_records":len({(r['extra']['import_sheet'],r['extra']['import_row']) for r in records}),"expanded_records":len(records),"by_group":dict(Counter(r['group'] for r in records)),"skipped":skipped,"sample_first":records[:2],"sample_last":records[-2:]},ensure_ascii=False,indent=2))
    else:
        batch=records[args.offset:args.offset+args.limit]
        if not batch: raise SystemExit("Lote vazio")
        print(sql_for(batch))


if __name__ == "__main__": main()
