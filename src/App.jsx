import { useState, useEffect } from 'react';
import BibleReader from './components/BibleReader';
import SearchPanel from './components/SearchPanel';
import CompareView from './components/CompareView';
import CopyModal          from './components/CopyModal';
import SidePanel          from './components/SidePanel';
import PWAInstallPrompt   from './components/PWAInstallPrompt';
import { useLocalStorage } from './hooks/useLocalStorage';
import { parseRef } from './utils/parseRef';
import { BOOK_MAP } from './data/books';
import './App.css';

const TABS = [
  { id: 'read',    label: '본문 조회' },
  { id: 'search',  label: '검색' },
  { id: 'compare', label: '버전 비교' },
];

export default function App() {
  const [tab, setTab]         = useState('read');
  const [bibles, setBibles]   = useState({});
  const [version, setVersion] = useState('HRV');
  const [loading, setLoading] = useState(true);
  const [copyCtx, setCopyCtx] = useState(null);
  const [toast, setToast] = useState(false);
  const [gotoRef, setGotoRef] = useState(null);
  const [activePanel, setActivePanel] = useState(null);

  // Quick navigation input
  const [quickInput, setQuickInput] = useState('');
  const [quickError, setQuickError] = useState(false);

  // Persistent state
  const [bookmarks, setBookmarks] = useLocalStorage('bs-bookmarks', []);
  const [history,   setHistory]   = useLocalStorage('bs-history',   []);
  const [notes,     setNotes]     = useLocalStorage('bs-notes',     {});
  const [darkMode,  setDarkMode]  = useLocalStorage('bs-dark',      false);
  const [fontSize,  setFontSize]  = useLocalStorage('bs-fontsize',  15);
  const [hlDuration, setHlDuration] = useLocalStorage('bs-hldur',   2);
  const [hlColor,    setHlColor]    = useLocalStorage('bs-hlcolor', '#ffe08a');

  // Apply theme & font size to root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);
  useEffect(() => {
    document.documentElement.style.setProperty('--font-size-verse', `${fontSize}px`);
  }, [fontSize]);

  useEffect(() => {
    async function load() {
      const [hrv, niv] = await Promise.all([
        fetch('/data/HRV.json').then(r => r.json()),
        fetch('/data/NIV.json').then(r => r.json()),
      ]);
      setBibles({ HRV: hrv, NIV: niv });
      setLoading(false);
    }
    load();
  }, []);

  function navigate(b, c, v = null) {
    setGotoRef({ b, c, v });
    setTab('read');
    // Add to history (deduplicated, newest first, max 30)
    const entry = {
      b, c,
      time: new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };
    setHistory(prev => [entry, ...prev.filter(h => !(h.b === b && h.c === c))].slice(0, 30));
  }

  function handleQuickNav(e) {
    if (e.key !== 'Enter') { setQuickError(false); return; }
    const ref = parseRef(quickInput);
    if (!ref) { setQuickError(true); return; }
    setQuickError(false);
    setQuickInput('');
    navigate(ref.b, ref.c);
  }

  function removeBookmark(idx) {
    setBookmarks(prev => prev.filter((_, i) => i !== idx));
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>성경 데이터 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">✝ 성경 검색</span>

        {/* Quick navigation */}
        <div className={`quick-nav ${quickError ? 'error' : ''}`}>
          <input
            type="text"
            placeholder="요3:16"
            value={quickInput}
            onChange={e => { setQuickInput(e.target.value); setQuickError(false); }}
            onKeyDown={handleQuickNav}
            title="책이름 장:절 형식으로 입력 후 Enter (예: 요3:16, 창1:1)"
          />
          {quickError && <span className="quick-error">찾을 수 없음</span>}
        </div>

        <div className="header-actions">
          {tab === 'read' && (
            <select className="version-select" value={version} onChange={e => setVersion(e.target.value)}>
              <option value="HRV">개역한글</option>
              <option value="NIV">NIV</option>
            </select>
          )}
          <button className={`icon-btn header-icon ${activePanel === 'bookmarks' ? 'active' : ''}`}
            onClick={() => setActivePanel(p => p === 'bookmarks' ? null : 'bookmarks')} title="즐겨찾기">★</button>
          <button className={`icon-btn header-icon ${activePanel === 'history' ? 'active' : ''}`}
            onClick={() => setActivePanel(p => p === 'history' ? null : 'history')} title="최근 기록">🕐</button>
          <button className={`icon-btn header-icon ${activePanel === 'settings' ? 'active' : ''}`}
            onClick={() => setActivePanel(p => p === 'settings' ? null : 'settings')} title="설정">⚙</button>
        </div>
      </header>

      <nav className="tab-nav">
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {tab === 'read' && (
          <BibleReader
            bible={bibles[version]}
            version={version}
            gotoRef={gotoRef}
            onCopy={(bookId, chapter, verses, chapterData) =>
              setCopyCtx({ bookId, chapter, verses, chapterData })
            }
            onToast={() => { setToast(true); setTimeout(() => setToast(false), 2000); }}
            bookmarks={bookmarks}
            onBookmark={setBookmarks}
            notes={notes}
            onNote={setNotes}
            hlDuration={hlDuration}
            hlColor={hlColor}
          />
        )}
        {tab === 'search' && (
          <SearchPanel bibles={bibles} onGoTo={(b, c, v) => navigate(b, c, v)} />
        )}
        {tab === 'compare' && (
          <CompareView bibles={bibles} />
        )}
      </main>

      {copyCtx && (
        <CopyModal {...copyCtx} version={version} onClose={() => setCopyCtx(null)}
          onCopied={() => { setCopyCtx(null); setToast(true); setTimeout(() => setToast(false), 2000); }} />
      )}

      {toast && <div className="toast">복사되었습니다</div>}

      <PWAInstallPrompt />

      <SidePanel
        activePanel={activePanel}
        onClose={() => setActivePanel(null)}
        bookmarks={bookmarks}
        onGoToBookmark={bm => navigate(bm.b, bm.c)}
        onRemoveBookmark={removeBookmark}
        history={history}
        onGoToHistory={h => navigate(h.b, h.c)}
        darkMode={darkMode}
        onDarkMode={setDarkMode}
        fontSize={fontSize}
        onFontSize={setFontSize}
        hlDuration={hlDuration}
        onHlDuration={setHlDuration}
        hlColor={hlColor}
        onHlColor={setHlColor}
      />
    </div>
  );
}
