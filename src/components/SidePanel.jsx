import { useState } from 'react';
import { BOOK_MAP } from '../data/books';

const HL_COLORS = [
  { value: '#ffe08a', label: '노랑' },
  { value: '#a8d8f0', label: '하늘' },
  { value: '#b8f0b8', label: '연두' },
  { value: '#f0b8d8', label: '분홍' },
];

function NotesPanel({ notes, onGoTo, onDelete, onClose }) {
  const [query, setQuery] = useState('');

  const entries = Object.entries(notes)
    .map(([key, text]) => {
      const [b, c, v] = key.split('-').map(Number);
      return { b, c, v, text };
    })
    .filter(({ text }) =>
      query.trim() === '' || text.includes(query.trim())
    )
    .sort((a, b) => a.b - b.b || a.c - b.c || a.v - b.v);

  return (
    <>
      <div className="notes-search-wrap">
        <input
          className="notes-search-input"
          placeholder="메모 검색..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      {entries.length === 0
        ? <div className="empty">{query ? '검색 결과가 없습니다.' : '메모가 없습니다.\n절 옆 ✎ 버튼으로 추가하세요.'}</div>
        : entries.map(({ b, c, v, text }) => {
          const key = `${b}-${c}-${v}`;
          return (
            <div key={key} className="side-item note-item">
              <div className="side-item-ref" onClick={() => { onGoTo(b, c, v); onClose(); }}>
                <strong>{BOOK_MAP[b]?.ko} {c}:{v}</strong>
                <span className="note-preview">{text}</span>
              </div>
              <button className="remove-btn" onClick={() => onDelete(key)}>✕</button>
            </div>
          );
        })
      }
    </>
  );
}

export default function SidePanel({
  activePanel, onClose,
  bookmarks, onGoToBookmark, onRemoveBookmark,
  history, onGoToHistory, onRemoveHistory,
  notes, onNote, onGoToNote,
  darkMode, onDarkMode,
  fontSize, onFontSize,
  hlDuration, onHlDuration,
  hlColor, onHlColor,
  bmColor, onBmColor,
}) {
  if (!activePanel) return null;

  function deleteNote(key) {
    const next = { ...notes };
    delete next[key];
    onNote(next);
  }

  return (
    <div className="side-panel-overlay" onClick={onClose}>
      <div className="side-panel" onClick={e => e.stopPropagation()}>
        <div className="side-panel-header">
          <h2>
            {activePanel === 'bookmarks' && '★ 즐겨찾기'}
            {activePanel === 'notes'     && '✎ 메모'}
            {activePanel === 'history'   && '🕐 최근 본 구절'}
            {activePanel === 'settings'  && '⚙ 설정'}
          </h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="side-panel-body">
          {activePanel === 'bookmarks' && (
            bookmarks.length === 0
              ? <div className="empty">북마크가 없습니다.<br/>절 옆 ★ 버튼으로 추가하세요.</div>
              : bookmarks.map((bm, i) => (
                <div key={i} className="side-item">
                  <div className="side-item-ref" onClick={() => { onGoToBookmark(bm); onClose(); }}>
                    <strong>{BOOK_MAP[bm.b]?.ko} {bm.c}:{bm.v}</strong>
                    <span>{bm.text}...</span>
                  </div>
                  <button className="remove-btn" onClick={() => onRemoveBookmark(i)}>✕</button>
                </div>
              ))
          )}

          {activePanel === 'notes' && (
            <NotesPanel
              notes={notes}
              onGoTo={onGoToNote}
              onDelete={deleteNote}
              onClose={onClose}
            />
          )}

          {activePanel === 'history' && (
            history.length === 0
              ? <div className="empty">기록이 없습니다.</div>
              : history.map((h, i) => (
                <div key={i} className="side-item">
                  <div className="side-item-ref" onClick={() => { onGoToHistory(h); onClose(); }}>
                    <strong>{BOOK_MAP[h.b]?.ko} {h.c}장{h.v ? ` ${h.v}절` : ''}</strong>
                    <span className="side-item-time">{h.time}</span>
                  </div>
                  <button className="remove-btn" onClick={() => onRemoveHistory(i)}>✕</button>
                </div>
              ))
          )}

          {activePanel === 'settings' && (
            <div className="settings-list">
              <div className="setting-section-title">화면</div>
              <div className="setting-row">
                <label>다크 모드</label>
                <button className={`toggle-switch ${darkMode ? 'on' : ''}`} onClick={() => onDarkMode(!darkMode)}>
                  <span />
                </button>
              </div>
              <div className="setting-row">
                <label>글자 크기 <strong>{fontSize}px</strong></label>
                <input type="range" min="12" max="24" step="1" value={fontSize}
                  onChange={e => onFontSize(+e.target.value)} />
              </div>

              <div className="setting-section-title">이동 하이라이트</div>
              <div className="setting-row">
                <label>지속 시간 <strong>{hlDuration}초</strong></label>
                <input type="range" min="1" max="5" step="1" value={hlDuration}
                  onChange={e => onHlDuration(+e.target.value)} />
              </div>
              <div className="setting-row">
                <label>색상</label>
                <div className="color-swatches">
                  {HL_COLORS.map(c => (
                    <button key={c.value}
                      className={`color-swatch ${hlColor === c.value ? 'active' : ''} ${bmColor === c.value ? 'disabled' : ''}`}
                      style={{ background: c.value }}
                      title={bmColor === c.value ? '즐겨찾기 색상과 중복' : c.label}
                      onClick={() => bmColor !== c.value && onHlColor(c.value)}
                    />
                  ))}
                </div>
              </div>

              <div className="setting-section-title">즐겨찾기 하이라이트</div>
              <div className="setting-row">
                <label>색상</label>
                <div className="color-swatches">
                  {HL_COLORS.map(c => (
                    <button key={c.value}
                      className={`color-swatch ${bmColor === c.value ? 'active' : ''} ${hlColor === c.value ? 'disabled' : ''}`}
                      style={{ background: c.value }}
                      title={hlColor === c.value ? '이동 하이라이트 색상과 중복' : c.label}
                      onClick={() => hlColor !== c.value && onBmColor(c.value)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {activePanel === 'settings' && (
          <a
            className="ad-banner"
            href="https://kingsload.pages.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="ad-label">AD</span>
            가장 쉬운 계시록 암송, 킹스로드
          </a>
        )}
      </div>
    </div>
  );
}
