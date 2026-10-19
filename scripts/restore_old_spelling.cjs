/*
 * 개역한글 원래 표기 복원: ㄹ 뒤 된소리 어미 (찌·찐·쌔)
 *
 * 현재 HRV.json 은 1988년 맞춤법 개정(제53항) 이후 표기로 바뀌어 있다.
 *   이룰지로다 → 원문 이룰찌로다, 볼지어다 → 볼찌어다,
 *   있을진대 → 있을찐대, 책망할새 → 책망할쌔 ...
 *
 * 규칙으로 일괄 치환하면 '알지 못하고'(부정의 -지)처럼 원래 '지'가 맞는 곳까지
 * 바뀌므로, 옛 표기를 쓰는 다른 개역한글 본문(bj_e_bible)과 절마다 글자를 맞춰
 * 보고, 기준 본문에서도 '찌/찐/쌔'인 자리만 바꾼다.
 *
 * 사용법:  node scripts/restore_old_spelling.cjs [기준 bible.json 경로] [--dry]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HRV_PATH = path.join(ROOT, 'public', 'data', 'HRV.json');
const REF_PATH = process.argv.find(a => a.endsWith('.json')) ??
  path.join(ROOT, '..', 'bj_e_bible', 'src', 'data', 'bible.json');
const DRY = process.argv.includes('--dry');

const TENSE = { '지': '찌', '진': '찐', '새': '쌔' };
const isRieul = c => { const x = (c ?? '').charCodeAt(0) - 0xAC00; return x >= 0 && x < 11172 && x % 28 === 8; };

const hrv = JSON.parse(fs.readFileSync(HRV_PATH, 'utf8'));
const ref = JSON.parse(fs.readFileSync(REF_PATH, 'utf8'));
const booksSrc = fs.readFileSync(path.join(ROOT, 'src', 'data', 'books.js'), 'utf8');
const BOOKS = [...booksSrc.matchAll(/id:\s*(\d+),\s*ko:\s*'([^']+)'/g)].map(m => ({ id: m[1], ko: m[2] }));

// 공백을 뺀 글자열과, 각 글자의 원래 위치
function stripWithMap(s) {
  const chars = [], pos = [];
  for (let i = 0; i < s.length; i++) if (!/\s/.test(s[i])) { chars.push(s[i]); pos.push(i); }
  return { chars, pos };
}

// 두 글자열을 정렬해 (a 위치, b 위치) 대응을 돌려준다 — 같은 글자 또는 치환된 글자만
function align(a, b) {
  if (a.length === b.length) return a.map((_, i) => [i, i]);
  const n = a.length, m = b.length;
  const d = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  const pairs = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) { pairs.push([i - 1, j - 1]); i--; j--; }
    else if (d[i][j] === d[i - 1][j] + 1) i--;
    else j--;
  }
  return pairs.reverse();
}

const counts = { '지': 0, '진': 0, '새': 0 };
const kept = [];          // ㄹ 뒤 지/진/새 인데 기준 본문도 그대로인 곳 (부정의 -지 등)
const changedVerses = [];
const noRef = [];         // 기준 본문에 없는 책
for (const { id, ko } of BOOKS) {
  const rb = ref[ko];
  for (const c of Object.keys(hrv[id])) for (const v of Object.keys(hrv[id][c])) {
    const text = hrv[id][c][v];
    if (!rb) {
      if ([...text].some((ch, i) => TENSE[ch] && isRieul(text[i - 1]))) noRef.push(`${ko} ${c}:${v}  ${text.trim()}`);
      continue;
    }
    const other = rb[c]?.[+v - 1];
    if (!other) continue;
    const A = stripWithMap(text), B = stripWithMap(other);
    const out = [...text];
    let n = 0;
    for (const [i, j] of align(A.chars, B.chars)) {
      const ch = A.chars[i];
      if (!TENSE[ch] || !isRieul(A.chars[i - 1])) continue;
      if (B.chars[j] === TENSE[ch] && B.chars[j - 1] === A.chars[i - 1]) {
        out[A.pos[i]] = TENSE[ch]; counts[ch]++; n++;
      } else if (B.chars[j] === ch) {
        kept.push(`${A.chars.slice(Math.max(0, i - 2), i + 3).join('')}`);
      }
    }
    if (n) { hrv[id][c][v] = out.join(''); changedVerses.push(`${ko} ${c}:${v}`); }
  }
}

console.log(`[1단계: 기준 본문 대조] 지→찌 ${counts['지']}, 진→찐 ${counts['진']}, 새→쌔 ${counts['새']} (${changedVerses.length}절)`);

// 2단계: 기준 본문도 일부 장(출16·레20·신28·시4·잠23·사9·렘49 등)은 바뀐 표기라 빈틈이 있다.
// 'ㄹ' 받침 글자 바로 뒤에 붙은, 다른 뜻으로 읽힐 수 없는 어미만 규칙으로 바꾼다.
// (부정의 '-지 못하/아니하/말', 명사 '물새' 같은 경우는 여기 해당하지 않음)
const RULE_ENDINGS = {
  '지': ['어다', '니라', '니이다', '니', '라도', '라', '로다', '언정', '며'],
  '진': ['대', '저'],
};
const ruleHits = [];
for (const { id, ko } of BOOKS) {
  for (const c of Object.keys(hrv[id])) for (const v of Object.keys(hrv[id][c])) {
    const t = [...hrv[id][c][v]];
    let changed = false;
    for (let k = 1; k < t.length; k++) {
      const ends = RULE_ENDINGS[t[k]];
      if (!ends || !isRieul(t[k - 1])) continue;
      const rest = t.slice(k + 1, k + 4).join('');
      if (!ends.some(e => rest.startsWith(e))) continue;
      ruleHits.push(`${ko} ${c}:${v} ${t.slice(Math.max(0, k - 3), k + 1).join('').split(' ').pop()}${rest.split(/[\s(]/)[0]}`);
      t[k] = TENSE[t[k]];
      changed = true;
    }
    if (changed) hrv[id][c][v] = t.join('');
  }
}
console.log(`[2단계: 규칙 보완] ${ruleHits.length}곳:\n  ` + ruleHits.join('\n  '));

// '새'는 '물새'처럼 명사일 수 있어 규칙으로 바꾸지 않는다. 기준 본문의 빈틈에서 남은 곳을
// 하나씩 확인해 보니 모두 '-ㄹ쌔' 어미여서 절을 지정해 바꾼다.
const SAE_FIX = [['1', '13', '1', '나올새'], ['2', '14', '6', '갈새'], ['44', '8', '25', '돌아갈새'], ['44', '8', '39', '올라갈새']];
for (const [b, c, v, word] of SAE_FIX) {
  const t = hrv[b][c][v];
  if (t.includes(word)) hrv[b][c][v] = t.replace(word, word.slice(0, -1) + '쌔');
}

// 남은 'ㄹ+새' — 확인용
const leftSae = [];
for (const { id, ko } of BOOKS) for (const c of Object.keys(hrv[id])) for (const v of Object.keys(hrv[id][c])) {
  const t = hrv[id][c][v];
  for (let k = 1; k < t.length; k++) if (t[k] === '새' && isRieul(t[k - 1])) leftSae.push(`${ko} ${c}:${v} ${t.slice(Math.max(0, k - 3), k + 3).trim()}`);
}
console.log(`[확인] 그대로 둔 ㄹ 바로 뒤 '새' ${leftSae.length}곳:\n  ` + leftSae.join('\n  '));
const keptTally = {};
for (const k of kept) keptTally[k] = (keptTally[k] ?? 0) + 1;
console.log(`그대로 둔 'ㄹ+지/진/새' ${kept.length}곳 (기준 본문도 같음). 많은 순:`,
  Object.entries(keptTally).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, n]) => `${k}(${n})`).join(' '));
if (noRef.length) console.log(`기준 본문에 없는 책의 후보 ${noRef.length}절:\n  ` + noRef.join('\n  '));

if (!DRY) {
  fs.writeFileSync(HRV_PATH, JSON.stringify(hrv));
  console.log('HRV.json 저장 완료');
}
