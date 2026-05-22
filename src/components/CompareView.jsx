import { useState, useEffect } from 'react';
import { BOOKS, BOOK_MAP } from '../data/books';

function CompareCopyModal({ bookId, chapter, verse, texts, versions, onClose, onCopied }) {
  const bookInfo = BOOK_MAP[bookId];
  const [showVerseNum, setShowVerseNum] = useState(false);
  const [showVersion,  setShowVersion]  = useState(true);
  const [separator,    setSeparator]    = useState('newline'); // 'newline' | 'slash'

  const lines = versions.map((v, i) => {
    const isNiv   = v === 'NIV';
    const name    = isNiv ? (bookInfo?.en ?? bookInfo?.ko) : (bookInfo?.abbr ?? bookInfo?.ko);
    const vTag    = showVersion ? ` ${v}` : '';
    const ref     = `${name} ${chapter}:${verse}${vTag}`;
    const numPfx  = showVerseNum ? `${verse} ` : '';
    return `${numPfx}${texts[i]} (${ref})`;
  });

  const preview = separator === 'slash' ? lines.join(' / ') : lines.join('\n');

  async function copy() {
    await navigator.clipboard.writeText(preview);
    onCopied();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>한+영 복사 옵션</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-options">
          <label><input type="checkbox" checked={showVerseNum} onChange={e => setShowVerseNum(e.target.checked)} /> 절 번호 포함</label>
          <label><input type="checkbox" checked={showVersion}  onChange={e => setShowVersion(e.target.checked)}  /> 버전 표시 (NIV / HRV)</label>
          <div className="modal-option-group">
            <span>구분 방식</span>
            <label><input type="radio" name="sep" value="newline" checked={separator === 'newline'} onChange={() => setSeparator('newline')} /> 줄바꿈</label>
            <label><input type="radio" name="sep" value="slash"   checked={separator === 'slash'}   onChange={() => setSeparator('slash')}   /> 슬래시 (/)</label>
          </div>
        </div>
        <div className="modal-preview">
          <div className="preview-label">미리보기</div>
          <pre className="preview-text">{preview}</pre>
        </div>
        <div className="modal-footer">
          <button className="copy-confirm-btn" onClick={copy}>클립보드에 복사</button>
        </div>
      </div>
    </div>
  );
}

export default function CompareView({ bibles, gotoRef }) {
  const [bookId,  setBookId]  = useState(1);
  const [chapter, setChapter] = useState(1);
  const [copyCtx, setCopyCtx] = useState(null);
  const [copied,  setCopied]  = useState(null);

  const bookInfo   = BOOK_MAP[bookId];
  const maxChapter = bookInfo?.chapters ?? 1;

  useEffect(() => { setChapter(1); }, [bookId]);

  useEffect(() => {
    if (!gotoRef) return;
    setBookId(gotoRef.b);
    setChapter(gotoRef.c);
  }, [gotoRef]);

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

  function openCopyModal(verse, texts) {
    setCopyCtx({ verse, texts });
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
                    onClick={() => openCopyModal(verse, texts)}
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

      {copyCtx && (
        <CompareCopyModal
          bookId={bookId}
          chapter={chapter}
          verse={copyCtx.verse}
          texts={copyCtx.texts}
          versions={versions}
          onClose={() => setCopyCtx(null)}
          onCopied={() => {
            setCopied(copyCtx.verse);
            setCopyCtx(null);
            setTimeout(() => setCopied(null), 1500);
          }}
        />
      )}
    </div>
  );
}
