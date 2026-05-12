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
// 반환: { b, c, v } — v는 없으면 null (장 이동)
export function parseRef(input) {
  const s = input.trim();
  if (!s) return null;

  // 장:절 형식
  const full = s.match(/^(.+?)\s*(\d+)\s*[:：]\s*(\d+)$/);
  if (full) {
    const book = findBook(full[1]);
    if (!book) return null;
    return { b: book.id, c: +full[2], v: +full[3] };
  }

  // 장만 (절 없음)
  const chapOnly = s.match(/^(.+?)\s*(\d+)$/);
  if (chapOnly) {
    const book = findBook(chapOnly[1]);
    if (!book) return null;
    return { b: book.id, c: +chapOnly[2], v: null };
  }

  return null;
}
