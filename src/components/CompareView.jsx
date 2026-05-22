import { useState, useEffect } from 'react';
import { BOOKS, BOOK_MAP } from '../data/books';

function buildPreview({ bookId, chapter, verses, allVerses, versions, showVerseNum, showVersion, layout }) {
  const bookInfo = BOOK_MAP[bookId];
  const hrvName  = bookInfo?.abbr ?? bookInfo?.ko;
  const nivName  = bookInfo?.en   ?? bookInfo?.ko;
  const vTag     = (v) => showVersion ? ` ${v}` : '';

  const verseRows = verses.map(verse => {
    const row = allVerses.find(r => r.verse === verse);
    return { verse, texts: row?.texts ?? versions.map(() => '') };
  });

  if (layout === 'grouped') {
    const loc = verses.length === 1 ? verses[0] : `${verses[0]}-${verses[verses.length - 1]}`;
    return versions.map((v, vi) => {
      const name = v === 'NIV' ? nivName : hrvName;
      const ref  = `${name} ${chapter}:${loc}${vTag(v)}`;
      const body = verseRows.map(({ verse, texts }) =>
        (showVerseNum ? `${verse} ` : '') + texts[vi]
      ).join(' ');
      return `${ref}\n${body}`;
    }).join('\n\n');
  } else {
    return verseRows.map(({ verse, texts }) =>
      versions.map((v, vi) => {
        const name = v === 'NIV' ? nivName : hrvName;
        const ref  = `${name} ${chapter}:${verse}${vTag(v)}`;
        return (showVerseNum ? `${verse} ` : '') + `${texts[vi]} (${ref})`;
      }).join(' / ')
    ).join('\n');
  }
}

function CompareCopyModal({ bookId, chapter, verses, allVerses, versions, onClose, onCopied }) {
  const [showVerseNum, setShowVerseNum] = useState(false);
  const [showVersion,  setShowVersion]  = useState(true);
  const [layout,       setLayout]       = useState('grouped');

  const isMulti = verses.length > 1;
  const preview = buildPreview({ bookId, chapter, verses, allVerses, versions, showVerseNum, showVersion, layout });

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
              <label><input type="radio" name="layout" value="grouped"     checked={layout === 'grouped'}     onChange={() => setLayout('grouped')}     /> A — 버전별 묶음</label>
              <label><input type="radio" name="layout" value="interleaved" checked={layout === 'interleaved'} onChange={() => setLayout('interleaved')} /> B — 절 단위 교차</label>
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

export default function CompareView({ bibles, gotoRef, bookmarks, onBookmark, notes, onNote, bmColor, onToast }) {
  const [bookId,      setBookId]      = useState(1);
  const [chapter,     setChapter]     = useState(1);
  const [selected,    setSelected]    = useState(new Set());
  const [copyCtx,     setCopyCtx]     = useState(null);
  const [copied,      setCopied]      = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [noteText,    setNoteText]    = useState('');

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

  function isBookmarked(v) {
    return (bookmarks ?? []).some(bm => bm.b === bookId && bm.c === chapter && bm.v === +v);
  }

  function toggleBookmark(v, texts) {
    const key = { b: bookId, c: chapter, v: +v };
    if (isBookmarked(v)) {
      onBookmark((bookmarks ?? []).filter(bm => !(bm.b === key.b && bm.c === key.c && bm.v === key.v)));
    } else {
      const text = (texts[0] ?? '').slice(0, 60);
      onBookmark([...(bookmarks ?? []), { ...key, text }]);
    }
  }

  function getNote(v) { return (notes ?? {})[`${bookId}-${chapter}-${v}`] ?? ''; }

  function openNoteEditor(v) { setEditingNote(v); setNoteText(getNote(v)); }

  function saveNote() {
    const key = `${bookId}-${chapter}-${editingNote}`;
    const next = { ...(notes ?? {}) };
    if (noteText.trim()) next[key] = noteText.trim();
    else delete next[key];
    onNote(next);
    setEditingNote(null);
  }

  function copyChapter() {
    const allV = allVerses.map(r => r.verse);
    setCopyCtx({ verses: allV, isChapter: true });
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
        <div className="reader-nav-right">
          <button className="icon-btn" onClick={copyChapter} title="장 전체 복사">📋</button>
          {selected.size > 0 && (
            <button className="copy-btn" onClick={() =>
              openCopyModal([...selected].sort((a, b) => +a - +b))
            }>{selected.size}절 복사</button>
          )}
        </div>
      </div>

      <div className="compare-title">
        {bookInfo?.ko} {chapter}장 — 버전 비교
      </div>

      <div className="compare-verses">
        {allVerses.map(({ verse, texts }) => {
          const bmd     = isBookmarked(verse);
          const note    = getNote(verse);
          const bmStyle = bmd ? { backgroundColor: bmColor ?? '#a8d8f0' } : {};
          return (
            <div
              key={verse}
              className={`compare-verse-block${selected.has(verse) ? ' compare-selected' : ''}`}
              style={bmStyle}
              onClick={() => toggleVerse(verse)}
            >
              <div className="compare-verse-header">
                <span className="compare-verse-num">{verse}</span>
                <div className="compare-verse-texts">
                  {versions.map((v, i) => (
                    <div key={v} className="compare-verse-row">
                      <span className="compare-verse-label">{v === 'HRV' ? '한' : 'EN'}</span>
                      <span className={`compare-verse-text${v === 'NIV' ? ' niv' : ''}`}>{texts[i]}</span>
                    </div>
                  ))}
                </div>
                <div className="compare-verse-actions" onClick={e => e.stopPropagation()}>
                  <button
                    className={`action-btn${bmd ? ' bookmarked' : ''}`}
                    onClick={() => toggleBookmark(verse, texts)}
                    title={bmd ? '북마크 해제' : '북마크'}
                  >★</button>
                  <button
                    className={`action-btn${note ? ' has-note' : ''}`}
                    onClick={() => openNoteEditor(verse)}
                    title="메모"
                  >✎</button>
                  <button
                    className={`action-btn${copied === verse ? ' copied' : ''}`}
                    onClick={() => openCopyModal([verse])}
                    title="구절 복사"
                  >⎘</button>
                </div>
              </div>
              {note && editingNote !== verse && (
                <div className="verse-note" onClick={e => { e.stopPropagation(); openNoteEditor(verse); }}>
                  📝 {note}
                </div>
              )}
              {editingNote === verse && (
                <div className="note-editor" onClick={e => e.stopPropagation()}>
                  <textarea
                    autoFocus
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="메모를 입력하세요..."
                    rows={3}
                  />
                  <div className="note-editor-btns">
                    <button onClick={saveNote}>저장</button>
                    <button onClick={() => setEditingNote(null)}>취소</button>
                    {getNote(verse) && (
                      <button className="delete-note" onClick={() => {
                        const next = { ...(notes ?? {}) };
                        delete next[`${bookId}-${chapter}-${verse}`];
                        onNote(next);
                        setEditingNote(null);
                      }}>삭제</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {allVerses.length === 0 && (
          <div className="empty" style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>데이터 없음</div>
        )}
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
            onToast?.();
          }}
        />
      )}
    </div>
  );
}
