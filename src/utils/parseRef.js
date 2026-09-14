import { BOOKS } from '../data/books';

function findBook(term) {
  const t = term.trim().toLowerCase();
  // 우선순위: 약어 완전일치 > 한글 완전일치 > 약어 시작 > 한글 시작 > 영어 시작
  return (
    BOOKS.find(b => b.abbr === t) ||
    BOOKS.find(b => b.ko === t) ||
    BOOKS.find(b => b.ko === t + '서' || b.ko === t + '기' || b.ko === t + '복음') ||
    BOOKS.find(b => b.abbr.startsWith(t) && b.abbr.length <= t.length + 1) ||
    BOOKS.find(b => b.ko.startsWith(t)) ||
    BOOKS.find(b => b.en.toLowerCase().startsWith(t))
  );
}

// "요3:16", "요1", "창 1:1", "요한복음 3:16" 파싱
// 반환: { b, c, v } — v는 없으면 null (장 이동). 책을 못 찾거나 장 범위를 벗어나면 null
export function parseRef(input) {
  const s = input.trim();
  if (!s) return null;

  // 장:절 형식 (전각 콜론 '：' 도 허용)
  const full = s.match(/^(.+?)\s*(\d+)\s*[:：]\s*(\d+)$/);
  if (full) {
    const book = findBook(full[1]);
    const c = +full[2], v = +full[3];
    if (!book || c < 1 || c > book.chapters || v < 1) return null;
    return { b: book.id, c, v };
  }

  // 장만 (절 없음)
  const chapOnly = s.match(/^(.+?)\s*(\d+)$/);
  if (chapOnly) {
    const book = findBook(chapOnly[1]);
    const c = +chapOnly[2];
    if (!book || c < 1 || c > book.chapters) return null;
    return { b: book.id, c, v: null };
  }

  return null;
}
