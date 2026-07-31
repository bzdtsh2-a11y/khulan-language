#!/usr/bin/env python3
import json, os, sys
base = os.path.dirname(os.path.abspath(__file__))
required = [
  'CODEX_IMPORT_PROMPT_MN.md','CONTENT_AUDIT_MN.md','DELTA_SUMMARY_MN.md','INTEGRITY_CHECK.json',
  'PACKAGE_ID.txt','PRESERVATION_REPORT.json','README_MN.md','SHA256SUMS.txt','VERIFY_BEFORE_IMPORT.py',
  'manifest.json','topik_ch02_mn_web.json','topik_ch02_mn_web.ts','topik_ch02_schema.json','topik_ch02_seed.json'
]
missing = [f for f in required if not os.path.exists(os.path.join(base,f))]
if missing:
    print('FAIL: missing files', missing)
    sys.exit(1)
with open(os.path.join(base,'topik_ch02_mn_web.json'), encoding='utf-8') as f:
    data = json.load(f)
checks = []
checks.append(('source_pages_total', data['stats']['source_pages_total'] == 20))
checks.append(('supplementary_ch1_pages', data['stats']['supplementary_ch1_pages'] == 2))
checks.append(('chapter2_pages', data['stats']['chapter2_pages'] == 18))
checks.append(('supplementary_ad_detail_items', data['stats']['supplementary_ad_detail_items'] == 10))
checks.append(('ranking_places_total', data['stats']['ranking_places_total'] == 40))
checks.append(('ranking_topics_total', data['stats']['ranking_conversation_topics_total'] == 20))
checks.append(('expected_problem_sets', data['stats']['chapter2_expected_problem_sets'] == 8))
checks.append(('expected_problem_items', data['stats']['chapter2_expected_problem_items'] == 26))
checks.append(('total_structured_exercise_items', data['stats']['total_structured_exercise_items'] == 45))
checks.append(('source_pages_length', len(data['source_pages']) == 20))
checks.append(('all_have_ocr_raw', all('ocr_text_raw' in p and p['ocr_text_raw'] for p in data['source_pages'])))
failed = [name for name, ok in checks if not ok]
if failed:
    print('FAIL:', failed)
    sys.exit(1)
print('PASS')
for name, ok in checks:
    print(f'- {name}:', 'OK' if ok else 'FAIL')
