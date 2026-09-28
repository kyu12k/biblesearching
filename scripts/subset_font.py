# -*- coding: utf-8 -*-
"""
크게 보기(프로젝션) 화면에 쓸 한글 글꼴을 웹폰트로 만드는 스크립트.

원본 TTF 는 5MB 가까이 되므로, 성경 본문(HRV/NIV)과 화면에 나오는 글자만
남겨 subset 한 뒤 WOFF2 로 압축한다.

사용법:
    pip install fonttools brotli
    python scripts/subset_font.py "C:/.../KoPubWorld Dotum Bold.ttf" kopub-dotum-bold

글꼴(KoPubWorld)은 한국출판인회의가 무료로 배포하며 웹폰트 사용이 허용된다.
"""
import json
import os
import re
import sys
from fontTools.subset import main as subset_main

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'public', 'data')
OUT_DIR = os.path.join(ROOT, 'public', 'fonts')

# 본문 외에 화면에 나올 수 있는 글자 (책 이름, 글꼴 메뉴 미리보기, 숫자·기호 등)
EXTRA = (
    '하나님의 말씀'
    '명조고딕나눔돋움궁서기본'
    'KoPub'
    '0123456789'
    'abcdefghijklmnopqrstuvwxyz'
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    ' !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'
    '‘’“”…·—–‐·「」『』〈〉《》()[]'
)


def chars_from_bible():
    seen = set()
    for name in ('HRV.json', 'NIV.json'):
        path = os.path.join(DATA, name)
        with open(path, encoding='utf-8') as f:
            bible = json.load(f)
        for book in bible.values():
            for chapter in book.values():
                for text in chapter.values():
                    seen.update(text)
    return seen


def chars_from_books():
    path = os.path.join(ROOT, 'src', 'data', 'books.js')
    with open(path, encoding='utf-8') as f:
        src = f.read()
    return set(''.join(re.findall(r"'([^']*)'", src)))


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src_ttf, out_name = sys.argv[1], sys.argv[2]

    chars = chars_from_bible() | chars_from_books() | set(EXTRA)
    chars = {c for c in chars if c.isprintable() or c == ' '}
    print(f'포함할 글자 {len(chars)}자')

    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, out_name + '.woff2')
    subset_main([
        src_ttf,
        '--text=' + ''.join(sorted(chars)),
        '--flavor=woff2',
        '--layout-features=*',
        '--output-file=' + out,
    ])
    src_kb = os.path.getsize(src_ttf) / 1024
    out_kb = os.path.getsize(out) / 1024
    print(f'{src_kb:,.0f}KB -> {out_kb:,.0f}KB  ({out})')


if __name__ == '__main__':
    main()
