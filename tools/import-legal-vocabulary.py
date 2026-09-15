import json
import sys
from pathlib import Path

import openpyxl


def clean(value):
    return " ".join(str(value or "").split())


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: import-legal-vocabulary.py INPUT.xlsx OUTPUT.js")

    source = Path(sys.argv[1])
    destination = Path(sys.argv[2])
    sheet = openpyxl.load_workbook(source, read_only=True, data_only=True).active
    vocabulary = []

    for row in sheet.iter_rows(min_row=4, values_only=True):
        number, mongolian, korean, page = row[:4]
        if not isinstance(number, (int, float)):
            continue
        mongolian = clean(mongolian)
        korean = clean(korean)
        if not mongolian or not korean:
            continue
        number = int(number)
        vocabulary.append({
            "id": f"ko-legal-{number}",
            "language": "korean",
            "level": "Хууль зүйн нэр томьёо",
            "stage": "Гүнзгий шат",
            "word": korean,
            "pronunciation": "",
            "translation": mongolian,
            "visual": "⚖️",
            "source": "Монгол–Солонгос хууль зүйн нэр томьёоны толь",
            "page": int(page) if isinstance(page, (int, float)) else clean(page),
            "sourceNumber": number,
            "preserveEntry": True,
        })

    expected = list(range(1, 12286))
    actual = [item["sourceNumber"] for item in vocabulary]
    if actual != expected:
        raise RuntimeError(f"Expected serials 1–12285, got {len(actual)} entries")

    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(vocabulary, ensure_ascii=False, separators=(",", ":"))
    destination.write_text(
        f"window.KOREAN_LEGAL_VOCABULARY = {payload};\n",
        encoding="utf-8",
    )
    print(json.dumps({"entries": len(vocabulary), "output": str(destination)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
