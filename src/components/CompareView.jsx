import { useState, useEffect } from 'react';
import { BOOKS, BOOK_MAP } from '../data/books';

export default function CompareView({ bibles }) {
  const [bookId, setBookId]   = useState(1);
  const [chapter, setChapter] = useState(1);

  const bookInfo   = BOOK_MAP[bookId];
  const maxChapter = bookInfo?.chapters ?? 1;

  useEffect(() => { setChapter(1); }, [bookId]);

  const versions = Object.keys(bibles).filter(v => bibles[v]);
  const allVerses = (() => {
    const sets = versions.map(v => {
      const data = bibles[v]?.[String(bookId)]?.[String(chapter)];
      return data ? Object.entries(data).sort((a, b) => +a[0] - +b[0]) : [];
    });
    const maxLen = Math.max(...sets.map(s => s.length), 0);
    return Array.from({ length: maxLen }, (_, i) => ({
      verse: sets[0]?.[i]?.[0] ?? String(i + 1),
      texts: versions.map((_, vi) => sets[vi]?.[i]?.[1] ?? ''),
    }));
  })();

  return (
    <div className="compare-view">
      <div className="compare-nav">
        <select value={bookId} onChange={e => setBookId(+e.target.value)}>
          {BOOKS.map(b => <option key={b.id} value={b.id}>{b.ko}</option>)}
        </select>
        <select value={chapter} onChange={e => setChapter(+e.target.value)}>
          {Array.from({ length: maxChapter }, (_, i) => i + 1).map(c => (
            <option key={c} value={c}>{c}장</option>
          ))}
        </select>
      </div>

      <div className="compare-title">
        {bookInfo?.ko} {chapter}장 — 버전 비교
      </div>

      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th className="verse-col">절</th>
              {versions.map(v => <th key={v}>{v === 'HRV' ? '개역한글' : 'NIV'}</th>)}
            </tr>
          </thead>
          <tbody>
            {allVerses.map(({ verse, texts }) => (
              <tr key={verse}>
                <td className="verse-col">{verse}</td>
                {texts.map((t, i) => <td key={i}>{t}</td>)}
              </tr>
            ))}
            {allVerses.length === 0 && (
              <tr><td colSpan={versions.length + 1} className="empty">데이터 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
