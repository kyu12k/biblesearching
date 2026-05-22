import { useState, useEffect } from 'react';
import { BOOKS, BOOK_MAP } from '../data/books';

function buildPreview({ bookId, chapter, verses, allVerses, versions, showVerseNum, showVersion, layout }) {
  const bookInfo = BOOK_MAP[bookId];
  const hrvName  = bookInfo?.abbr ?? bookInfo?.ko;
  const nivName  = bookInfo?.en   ?? bookInfo?.ko;

  const vTag = (v) => showVersion ? ` ${v}` : '';

  const verseRows = verses.map(verse => {
    const row = allVerses.find(r => r.verse === verse);
    return { verse, texts: row?.texts ?? versions.map(() => '') };
  });

  if (layout === 'grouped') {
    // A안: 버전별 묶음
    const firstV = verses[0];
    const lastV  = verses[verses.length - 1];
    const loc    = firstV === lastV ? firstV : `${firstV}-${lastV}`;
    return versions.map((v, vi) => {
      const name = v === 'NIV' ? nivName : hrvName;
      const ref  = `${name} ${chapter}:${loc}${vTag(v)}`;
      const body = verseRows.map(({ verse, texts }) => {
        const pfx = showVerseNum ? `${verse} ` : '';
        return `${pfx}${texts[vi]}`;
      }).join(' ');
      return `${ref}\n${body}`;
    }).join('\n\n');
  } else {
    // B안: 절 단위 교차
    return verseRows.map(({ verse, texts }) => {
      return versions.map((v, vi) => {
        const name  = v === 'NIV' ? nivName : hrvName;
        const ref   = `${name} ${chapter}:${verse}${vTag(v)}`;
        const pfx   = showVerseNum ? `${verse} ` : '';
        return `${pfx}${texts[vi]} (${ref})`;
      }).join(' / ');
    }).join('\n');
  }
}

function CompareCopyModal({ bookId, chapter, verses, allVerses, versions, onClose, onCopied }) {
  const [showVerseNum, setShowVerseNum] = useState(false);
  const [showVersion,  setShowVersion]  = useState(true);
  const [layout,       setLayout]       = useState('grouped'); // 'grouped' | 'interleaved'

  const isMulti  = verses.length > 1;
  const preview  = buildPreview({ bookId, chapter, verses, allVerses, versions, showVerseNum, showVersion, layout });

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
          <label><input type="checkbox" checked={showVersion}  onChange={e => setShowVersion(e.target.checked)}  /> 버전 표시</label>
          {isMulti && (
            <div className="modal-option-group">
              <span>배열 방식</span>
              <label>
                <input type="radio" name="layout" value="grouped" checked={layout === 'grouped'} onChange={() => setLayout('grouped')} />
                A — 버전별 묶음
              </label>
              <label>
                <input type="radio" name="layout" value="interleaved" checked={layout === 'interleaved'} onChange={() => setLayout('interleaved')} />
                B — 절 단위 교차
              </label>
            </div>
          )}
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
  const [bookId,   setBookId]   = useState(1);
  const [chapter,  setChapter]  = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [copyCtx,  setCopyCtx]  = useState(null);
  const [copied,   setCopied]   = useState(null);

  const bookInfo   = BOOK_MAP[bookId];
  const maxChapter = bookInfo?.chapters ?? 1;

  useEffect(() => { setChapter(1); setSelected(new Set()); }, [bookId]);
  useEffect(() => { setSelected(new Set()); }, [chapter]);

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

  function toggleVerse(verse) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(verse) ? next.delete(verse) : next.add(verse);
      return next;
    });
  }

  function openCopyModal(verses) {
    setCopyCtx({ verses });
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
        {selected.size > 0 && (
          <button className="copy-btn" onClick={() =>
            openCopyModal([...selected].sort((a, b) => +a - +b))
          }>{selected.size}절 복사</button>
        )}
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
              <tr
                key={verse}
                className={selected.has(verse) ? 'compare-selected' : ''}
                onClick={() => toggleVerse(verse)}
              >
                <td className="verse-col">{verse}</td>
                {texts.map((t, i) => <td key={i}>{t}</td>)}
                <td className="copy-col" onClick={e => e.stopPropagation()}>
                  <button
                    className={`compare-copy-btn${copied === verse ? ' copied' : ''}`}
                    onClick={() => openCopyModal([verse])}
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
          verses={copyCtx.verses}
          allVerses={allVerses}
          versions={versions}
          onClose={() => setCopyCtx(null)}
          onCopied={() => {
            if (copyCtx.verses.length === 1) {
              setCopied(copyCtx.verses[0]);
              setTimeout(() => setCopied(null), 1500);
            }
            setSelected(new Set());
            setCopyCtx(null);
          }}
        />
      )}
    </div>
  );
}
