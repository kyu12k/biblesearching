/*
 * 개역한글 원문(krv.json)으로 HRV.json 본문을 맞춘다.
 *
 * 기존 HRV.json 은 맞춤법을 현대식으로 손본 판본이었다(볼찌어다 → 볼지어다, 수양 → 숫양,
 * 세째 → 셋째, 잠간 → 잠깐 …). 띄어쓰기도 현대식이었고 오타·빠진 단어도 있었다
 * (출 9:16 '네가 너를', 요 6:40 '내가' 누락, '하니님', '위하어' 등).
 * krv.json 은 원문 표기 그대로라, 글자·띄어쓰기·문장부호를 모두 이것에 맞춘다.
 *
 * 정리 규칙
 *  - 〔소제목〕〔각주〕(중첩 포함)와 ①② Ⓐ 같은 각주 표시는 지운다
 *  - 전각 괄호 （ ）는 앱의 다른 곳과 같게 ( )로 바꾼다. 원문의 [ ] 「 」 ― 등은 그대로
 *  - 합쳐진 절 안내(예: "(30절에 포함되어 있음)")는 기존 문구를 유지한다
 *  - krv 에만 있고 내용이 있는 절(시 72:20)은 추가, 내용 없이 "(없음)"인 절은 추가하지 않는다
 *
 * 사용법:  node scripts/import_krv.cjs [krv.json 경로] [--dry]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HRV_PATH = path.join(ROOT, 'public', 'data', 'HRV.json');
const KRV_PATH = process.argv.find(a => a.endsWith('.json')) ?? path.join(ROOT, '..', '..', 'krv.json');
const DRY = process.argv.includes('--dry');

function clean(t) {
  let s = t, prev;
  do { prev = s; s = s.replace(/〔[^〔〕]*〕/g, ''); } while (s !== prev);   // 소제목·각주
  s = s.replace(/[①-⓿]/g, '');                                     // ① Ⓐ ⓔ
  s = s.replace(/（/g, '(').replace(/）/g, ')');
  return s.replace(/\s+/g, ' ').trim();
}
const isPlaceholder = t => /^\((없음|[^)]*포함[^)]*)\)$/.test(t.trim());

// krv.json 자체의 오타 (다른 개역한글 본문과 대조해 확인한 것만)
const KRV_TYPOS = [
  ['23:62:4', '쁄라라라 하리니', '쁄라라 하리니'],   // 사 62:4 '라'가 하나 더 들어감 (헵시바라 하며 와 같은 꼴)
];
const fixTypos = (id, t) => KRV_TYPOS.reduce((s, [where, from, to]) => (where === id ? s.replace(from, to) : s), t);

const krv = JSON.parse(fs.readFileSync(KRV_PATH, 'utf8'));
const hrv = JSON.parse(fs.readFileSync(HRV_PATH, 'utf8'));

const stats = { same: 0, spaceOnly: 0, text: 0, keptPlaceholder: 0, added: [], skipped: [], missing: [] };
const seen = new Set();
for (const book of krv.books) {
  const b = String(book.number);
  for (const ch of book.chapters) {
    const c = String(ch.chapter);
    for (const vv of ch.verses) {
      const v = String(vv.verse);
      seen.add(`${b}:${c}:${v}`);
      const next = fixTypos(`${b}:${c}:${v}`, clean(vv.text));
      const cur = hrv[b]?.[c]?.[v];
      if (cur === undefined) {
        if (isPlaceholder(next)) { stats.skipped.push(`${book.name} ${c}:${v} ${next}`); continue; }
        (hrv[b][c] ??= {})[v] = next;
        stats.added.push(`${book.name} ${c}:${v} ${next}`);
        continue;
      }
      if (isPlaceholder(next) && isPlaceholder(cur)) { hrv[b][c][v] = cur.trim(); stats.keptPlaceholder++; continue; }
      const a = cur.replace(/\s+/g, ' ').trim();
      if (a === next) stats.same++;
      else if (a.replace(/\s/g, '') === next.replace(/\s/g, '')) stats.spaceOnly++;
      else stats.text++;
      hrv[b][c][v] = next;
    }
  }
}
for (const b of Object.keys(hrv)) for (const c of Object.keys(hrv[b])) for (const v of Object.keys(hrv[b][c])) {
  if (!seen.has(`${b}:${c}:${v}`)) stats.missing.push(`${b}:${c}:${v}`);
}
// 절 번호 순서 유지 (추가된 절이 끝에 붙도록 정렬)
for (const b of Object.keys(hrv)) for (const c of Object.keys(hrv[b])) {
  hrv[b][c] = Object.fromEntries(Object.entries(hrv[b][c]).sort((x, y) => +x[0] - +y[0]));
}

console.log(`같음 ${stats.same} | 띄어쓰기만 바뀜 ${stats.spaceOnly} | 글자가 바뀜 ${stats.text} | 안내 문구 유지 ${stats.keptPlaceholder}`);
console.log(`추가한 절 ${stats.added.length}: ${stats.added.join(' / ')}`);
console.log(`추가하지 않은 빈 절 ${stats.skipped.length}: ${stats.skipped.join(' / ')}`);
console.log(`krv 에 없는 기존 절 ${stats.missing.length}: ${stats.missing.slice(0, 10).join(' ')}`);
if (!DRY) { fs.writeFileSync(HRV_PATH, JSON.stringify(hrv)); console.log('HRV.json 저장 완료'); }
