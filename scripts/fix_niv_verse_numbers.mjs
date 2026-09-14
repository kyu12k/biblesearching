// NIV 절 번호 보정 스크립트
// convert_abb.py는 절 번호를 순차적으로 부여하므로, NIV(1984)가 본문에서 생략한 절
// (개역한글에서 "(없음)" 또는 본문이 있는 절) 이후의 절 번호가 하나씩 앞당겨져 있음.
// 실제 NIV 절 번호에 맞게 키를 밀어준다. (한 번만 실행하면 됨 — 이미 보정된 파일에는 no-op)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NIV_PATH  = path.join(__dirname, '..', 'public', 'data', 'NIV.json');
const HRV_PATH  = path.join(__dirname, '..', 'public', 'data', 'HRV.json');

// NIV 본문에서 생략된 절: [book, chapter, verse]
const OMITTED = [
  [40, 17, 21], [40, 18, 11], [40, 23, 14],
  [41,  7, 16], [41,  9, 44], [41,  9, 46], [41, 11, 26], [41, 15, 28],
  [42, 17, 36], [42, 23, 17],
  [43,  5,  4],
  [44,  8, 37], [44, 15, 34], [44, 24,  7], [44, 28, 29],
  [45, 16, 24],
];

const niv = JSON.parse(fs.readFileSync(NIV_PATH, 'utf8'));
const hrv = JSON.parse(fs.readFileSync(HRV_PATH, 'utf8'));

const byChapter = new Map();
for (const [b, c, v] of OMITTED) {
  const key = `${b}:${c}`;
  byChapter.set(key, [...(byChapter.get(key) ?? []), v].sort((x, y) => x - y));
}

let changed = 0;
for (const [key, omitted] of byChapter) {
  const [b, c] = key.split(':');
  const ch = niv[b][c];
  const hrvCount = Object.keys(hrv[b][c]).length;
  const nivCount = Object.keys(ch).length;
  if (!(String(omitted[0]) in ch)) { console.log(`skip ${key}: 이미 보정됨`); continue; }
  if (nivCount !== hrvCount - omitted.length) {
    throw new Error(`${key}: NIV ${nivCount}절, HRV ${hrvCount}절 — 예상(${hrvCount - omitted.length})과 다름`);
  }
  // 순차 키를 실제 번호로 매핑: 생략된 절 번호를 건너뛰며 채운다
  const texts = Object.keys(ch).sort((x, y) => +x - +y).map(k => ch[k]);
  const fixed = {};
  let real = 1;
  for (const t of texts) {
    while (omitted.includes(real)) real++;
    fixed[String(real)] = t;
    real++;
  }
  niv[b][c] = fixed;
  changed++;
  console.log(`fixed ${key}: ${nivCount}절, 생략 ${omitted.join(',')}`);
}

if (changed) fs.writeFileSync(NIV_PATH, JSON.stringify(niv));
console.log(`${changed}개 장 보정 완료`);
