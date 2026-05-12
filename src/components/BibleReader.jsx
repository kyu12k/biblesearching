import { useState, useEffect, useRef } from 'react';
import { BOOKS, BOOK_MAP } from '../data/books';

export default function BibleReader({ bible, version, onCopy, gotoRef, bookmarks, onBookmark, notes, onNote, hlDuration, hlColor }) {
  const [bookId, setBookId]           = useState(1);
  const [chapter, setChapter]         = useState(1);
  const [selected, setSelected]       = useState(new Set());
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText]       = useState('');
  const [hlVerse, setHlVerse]         = useState(null);
  const verseListRef   = useRef(null);
  const verseEls       = useRef({});
  const gotoChapterRef = useRef(null);

  const bookInfo    = BOOK_MAP[bookId];
  const maxChapter  = bookInfo?.chapters ?? 1;
  const bookData    = bible?.[String(bookId)];
  const chapterData = bookData?.[String(chapter)];
  const verses      = chapterData
    ? Object.entries(chapterData).sort((a, b) => +a[0] - +b[0])
    : [];

  useEffect(() => {
    if (gotoChapterRef.current !== null) {
      setChapter(gotoChapterRef.current);
      gotoChapterRef.current = null;
    } else {
      setChapter(1);
    }
    setSelected(new Set());
  }, [bookId]);

  useEffect(() => { setSelected(new Set()); }, [chapter]);

  useEffect(() => {
    if (!gotoRef) return;
    gotoChapterRef.current = gotoRef.c;
    setBookId(gotoRef.b);
    setChapter(gotoRef.c);
    if (gotoRef.v) {
      setHlVerse(String(gotoRef.v));
      setTimeout(() => setHlVerse(null), (hlDuration ?? 2) * 1000);
    }
  }, [gotoRef]);

  useEffect(() => {
    if (!hlVerse) return;
    const el = verseEls.current[hlVerse];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [hlVerse]);

  function toggleVerse(v) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  }

  function prevChapter() {
    if (chapter > 1) { setChapter(c => c - 1); }
    else if (bookId > 1) { const nb = bookId - 1; setBookId(nb); setChapter(BOOK_MAP[nb].chapters); }
  }
  function nextChapter() {
    if (chapter < maxChapter) { setChapter(c => c + 1); }
    else if (bookId < 66) { setBookId(b => b + 1); setChapter(1); }
  }

  function isBookmarked(v) {
    return bookmarks.some(bm => bm.b === bookId && bm.c === chapter && bm.v === +v);
  }

  function toggleBookmark(v) {
    const key = { b: bookId, c: chapter, v: +v };
    if (isBookmarked(v)) {
      onBookmark(bookmarks.filter(bm => !(bm.b === key.b && bm.c === key.c && bm.v === key.v)));
    } else {
      const text = chapterData?.[v] ?? '';
      onBookmark([...bookmarks, { ...key, text: text.slice(0, 60) }]);
    }
  }

  function getNote(v) { return notes[`${bookId}-${chapter}-${v}`] ?? ''; }

  function openNoteEditor(v) { setEditingNote(v); setNoteText(getNote(v)); }

  function saveNote() {
    const key = `${bookId}-${chapter}-${editingNote}`;
    if (noteText.trim()) onNote({ ...notes, [key]: noteText.trim() });
    else { const n = { ...notes }; delete n[key]; onNote(n); }
    setEditingNote(null);
  }

  function copyVerse(v, text) {
    const name = bookInfo?.abbr ?? bookInfo?.ko;
    navigator.clipboard.writeText(`${text} (${name} ${chapter}:${v})`);
  }

  function copyChapter() {
    const NL = String.fromCharCode(10);
    const lines = verses.map(([v, t]) => v + ' ' + t).join(NL);
    navigator.clipboard.writeText(bookInfo?.ko + ' ' + chapter + '장' + NL + lines);
  }

  return (
    <div className="bible-reader">
      <div className="reader-nav">
        <select value={bookId} onChange={e => setBookId(+e.target.value)}>
          {BOOKS.map(b => <option key={b.id} value={b.id}>{b.ko}</option>)}
        </select>
        <select value={chapter} onChange={e => setChapter(+e.target.value)}>
          {Array.from({ length: maxChapter }, (_, i) => i + 1).map(c => (
            <option key={c} value={c}>{c}장</option>
          ))}
        </select>
        <div className="nav-btns">
          <button onClick={prevChapter} disabled={bookId === 1 && chapter === 1} title="이전 장">◀</button>
          <button onClick={nextChapter} disabled={bookId === 66 && chapter === maxChapter} title="다음 장">▶</button>
        </div>
        <div className="reader-nav-right">
          <button className="icon-btn" onClick={copyChapter} title="장 전체 복사">📋</button>
          {selected.size > 0 && (
            <button className="copy-btn" onClick={() =>
              onCopy(bookId, chapter, [...selected].sort((a, b) => +a - +b), chapterData)
            }>
              {selected.size}절 복사
            </button>
          )}
        </div>
      </div>

      <div className="chapter-title">
        {bookInfo?.ko} {chapter}장
        <span className="version-badge">{version}</span>
      </div>

      <div className="verses" ref={verseListRef}>
        {verses.map(([v, text]) => {
          const bmd  = isBookmarked(v);
          const note = getNote(v);
          const isHl = hlVerse === v;
          return (
            <div
              key={v}
              ref={el => verseEls.current[v] = el}
              className={`verse-block${selected.has(v) ? ' selected' : ''}${isHl ? ' highlighted' : ''}`}
              style={isHl ? { '--hl-color': hlColor ?? '#ffe08a', '--hl-dur': (hlDuration ?? 2) + 's' } : {}}
            >
              <div className="verse" onClick={() => toggleVerse(v)}>
                <span className="verse-num">{v}</span>
                <span className="verse-text">{text}</span>
                <div className="verse-actions" onClick={e => e.stopPropagation()}>
                  <button
                    className={`action-btn${bmd ? ' bookmarked' : ''}`}
                    onClick={() => toggleBookmark(v)}
                    title={bmd ? '북마크 해제' : '북마크'}
                  >★</button>
                  <button
                    className={`action-btn${note ? ' has-note' : ''}`}
                    onClick={() => openNoteEditor(v)}
                    title="메모"
                  >✎</button>
                  <button
                    className="action-btn"
                    onClick={() => copyVerse(v, text)}
                    title="구절 복사"
                  >⎘</button>
                </div>
              </div>
              {note && editingNote !== v && (
                <div className="verse-note" onClick={() => openNoteEditor(v)}>
                  📝 {note}
                </div>
              )}
              {editingNote === v && (
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
                    {getNote(v) && (
                      <button className="delete-note" onClick={() => {
                        const n = { ...notes };
                        delete n[`${bookId}-${chapter}-${v}`];
                        onNote(n);
                        setEditingNote(null);
                      }}>삭제</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {verses.length === 0 && <div className="empty">본문을 불러오는 중...</div>}
      </div>
    </div>
  );
}
