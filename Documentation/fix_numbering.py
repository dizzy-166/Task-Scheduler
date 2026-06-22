#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""fix_numbering.py — заменяет 1. на 1) в нумерованных списках numbering.xml"""

import re, zipfile, os, sys
sys.stdout.reconfigure(encoding='utf-8')

NUM_XML  = r"diploma_unpacked\word\numbering.xml"
UNPACKED = r"diploma_unpacked"
DOCX     = r"Диплом_Шеронов - исправления 28.05.docx"

with open(NUM_XML, 'r', encoding='utf-8') as f:
    xml = f.read()

before = re.findall(r'<w:lvlText w:val="([^"]*\.)"', xml)
print(f"Before: {len(before)} lvlText values ending with period:")
for v in sorted(set(before)):
    print(f"  {v!r}")

# Change trailing period in lvlText values: ...X." -> ...X)"
# This changes 1. -> 1) but keeps separators like 1.2 untouched (they don't end with .)
xml_new = re.sub(r'(<w:lvlText w:val="[^"]*)\."', r'\1)"', xml)

after_period = re.findall(r'<w:lvlText w:val="([^"]*\.)"', xml_new)
after_paren  = re.findall(r'<w:lvlText w:val="([^"]*\))"', xml_new)

print(f"\nRemaining with trailing period: {len(after_period)}")
print(f"Now with parenthesis ({len(after_paren)} entries):")
for v in sorted(set(after_paren)):
    print(f"  {v!r}")

# Verify heading separators untouched
check_headings = ['%1', '%1.%2', '%1.%2.%3']
print("\nHeading formats still intact:")
for h in check_headings:
    found = f'<w:lvlText w:val="{h}"' in xml_new
    print(f"  {h!r}: {'YES' if found else 'NOT FOUND'}")

with open(NUM_XML, 'w', encoding='utf-8') as f:
    f.write(xml_new)
print("\nnumbering.xml updated")

# Repack
tmp = DOCX + ".tmp"
with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, _dirs, files in os.walk(UNPACKED):
        for fname in files:
            fpath = os.path.join(root, fname)
            arcname = os.path.relpath(fpath, UNPACKED)
            zf.write(fpath, arcname)
if os.path.exists(DOCX):
    os.remove(DOCX)
os.rename(tmp, DOCX)
print(f"Repacked OK, size: {os.path.getsize(DOCX)} bytes")
