"""Convert the weekly opening-odds Excel export to the site's data.js format."""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path

import openpyxl


def text(value):
    return "" if value is None else str(value).strip()


def odd(value):
    if value in (None, ""):
        return ""
    if isinstance(value, (int, float)):
        return f"{value:.2f}".replace(".", ",")
    return text(value).replace(".", ",")


def date_value(value):
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    return text(value)[:10]


def result(score):
    match = re.fullmatch(r"\s*(\d+)\s*[-–]\s*(\d+)\s*", text(score))
    if not match:
        return ""
    home, away = map(int, match.groups())
    return "1" if home > away else "2" if home < away else "X"


def convert(source: Path, destination: Path):
    sheet = openpyxl.load_workbook(source, read_only=True, data_only=True).active
    matches = []

    for row in sheet.iter_rows(min_row=9, values_only=True):
        home, away = text(row[34]), text(row[35])
        if not home or not away:
            continue

        score_ft = text(row[29])
        matches.append({
            "id": len(matches) + 1,
            "date": date_value(row[30]),
            "day": text(row[31]),
            "league": text(row[32]),
            "time": text(row[33]),
            "home": home,
            "away": away,
            "played": bool(result(score_ft)),
            "scoreHT": text(row[28]),
            "scoreFT": score_ft,
            "results": {
                "ms1": "1" if text(row[20]) == "1" else "",
                "ms0": "X" if text(row[20]) == "0" else "",
                "ms2": "2" if text(row[20]) == "2" else "",
                "kgVar": "VAR" if text(row[17]) == "VAR" else "",
                "kgYok": "YOK" if text(row[17]) == "YOK" else "",
                "over25": "ÜST" if text(row[7]) == "ÜST" else "ALT" if text(row[7]) == "ALT" else "",
            },
            "odds": {
                "ms1": odd(row[36]), "ms0": odd(row[37]), "ms2": odd(row[38]),
                "over25": odd(row[52]), "under25": odd(row[51]),
                "kgVar": odd(row[55]), "kgYok": odd(row[56]),
                "iy1": odd(row[61]), "iy0": odd(row[62]), "iy2": odd(row[63]),
                "iyOver15": odd(row[65]), "iyUnder15": odd(row[64]),
            },
        })

    destination.write_text(
        "window.ORAN_DATA = " + json.dumps(matches, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"{len(matches)} maç yazıldı: {destination}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Kullanım: python scripts/excel_to_data.py input/acilis.xlsx data.js")
    convert(Path(sys.argv[1]), Path(sys.argv[2]))
