import { useState, useEffect } from 'react';
import { BOOKS, BOOK_MAP } from '../data/books';

export default function CompareView({ bibles }) {
  const [bookId, setBookId]   = useState(1);
  const [chapter, setChapter] = useState(1);
  const [copied, setCopied]   = useState(null);

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

  function copyBoth(verse, texts) {
    const ref   = `${BOOK_MAP[bookId]?.ko} ${chapter}:${verse}`;
    const enRef = `${BOOK_MAP[bookId]?.en} ${chapter}:${verse}`;
    const lines = versions.map((v, i) =>
      v === 'HRV' ? `${ref} ${texts[i]}` : `${enRef} ${texts[i]}`
    ).join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setCopied(verse);
      setTimeout(() => setCopied(null), 1500);
    });
  }

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
        <button className="nav-btn" onClick={() => setChapter(c => Math.max(1, c - 1))} disabled={chapter <= 1}>◀</button>
        <button className="nav-btn" onClick={() => setChapter(c => Math.min(maxChapter, c + 1))} disabled={chapter >= maxChapter}>▶</button>
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
              <th className="copy-col"></th>
            </tr>
          </thead>
          <tbody>
            {allVerses.map(({ verse, texts }) => (
              <tr key={verse}>
                <td className="verse-col">{verse}</td>
                {texts.map((t, i) => <td key={i}>{t}</td>)}
                <td className="copy-col">
                  <button
                    className={`compare-copy-btn${copied === verse ? ' copied' : ''}`}
                    onClick={() => copyBoth(verse, texts)}
                  >{copied === verse ? '✓' : '복사'}</button>
                </td>
              </tr>
            ))}
            {allVerses.length === 0 && (
              <tr><td colSpan={versions.length + 2} className="empty">데이터 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
