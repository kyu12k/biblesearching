"""
ABB → JSON 변환 스크립트
ABB 파일 구조:
  - 첫 바이트 0x01: 새 책(book) 시작 (chapter=1, verse=1)
  - 첫 바이트 0x02: 새 장(chapter) 시작 (verse=1)
  - 그 외: 다음 절(verse)
  텍스트는 첫 바이트 이후부터 CP949 인코딩
출력: { "bookIndex": { "chapter": { "verse": "text" } } }
"""

import os, json, sys

BIBLE_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'biblesearch', 'Bibles')
OUT_DIR   = os.path.join(os.path.dirname(__file__), '..', 'public', 'data')

def parse_abb_files(version):
    """9개 ABB 파일을 파싱해 { book: { chapter: { verse: text } } } 반환"""
    bible = {}
    book_idx = 0
    chapter  = 1
    verse    = 1

    for file_num in range(1, 10):
        path = os.path.join(BIBLE_DIR, f'{version}_{file_num}.ABB')
        with open(path, 'rb') as f:
            data = f.read()

        lines = data.split(b'\r\n')
        for line in lines:
            if not line:
                continue
            first = line[0]
            text  = line[1:].decode('cp949', errors='replace').strip()
            if not text:
                continue

            if first == 0x01:
                # 새 책 시작 — 헤더가 [0x01, 0x02] 2바이트이므로 둘 다 제거
                text = line[2:].decode('cp949', errors='replace').strip()
                book_idx += 1
                chapter   = 1
                verse     = 1
            elif first == 0x02:
                # 새 장 시작 — 첫 바이트(0x02)만 마커, 나머지는 텍스트
                chapter += 1
                verse    = 1
            else:
                # 일반 절 — 첫 바이트도 한국어 텍스트의 일부
                text = line.decode('cp949', errors='replace').strip()

            # 현재 위치에 텍스트 저장
            b = str(book_idx)
            c = str(chapter)
            v = str(verse)
            bible.setdefault(b, {}).setdefault(c, {})[v] = text

            # 마커 줄은 verse=1이 이미 저장됐으므로 다음 줄부터 증가
            if first not in (0x01, 0x02):
                verse += 1
            else:
                verse = 2  # 다음 줄은 같은 장 2절

    return bible

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for version in ['HRV', 'NIV']:
        print(f'변환 중: {version}...', end=' ', flush=True)
        bible = parse_abb_files(version)
        out_path = os.path.join(OUT_DIR, f'{version}.json')
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(bible, f, ensure_ascii=False, separators=(',', ':'))
        total_verses = sum(len(vs) for bk in bible.values() for vs in bk.values())
        print(f'완료 - {len(bible)}권 {total_verses}절 - {out_path}')

if __name__ == '__main__':
    main()
