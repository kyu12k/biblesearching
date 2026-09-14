import { useState, useEffect } from 'react';
import BibleReader from './components/BibleReader';
import SearchPanel from './components/SearchPanel';
import CompareView from './components/CompareView';
import CopyModal          from './components/CopyModal';
import SidePanel          from './components/SidePanel';
import PWAInstallPrompt   from './components/PWAInstallPrompt';
import { useLocalStorage } from './hooks/useLocalStorage';
import { parseRef } from './utils/parseRef';
import './App.css';

const TABS = [
  { id: 'read',    label: '본문 조회' },
  { id: 'search',  label: '단어 검색' },
  { id: 'compare', label: '버전 비교' },
];

export default function App() {
  const [tab, setTab]         = useState('read');
  const [bibles, setBibles]   = useState({});
  const [version, setVersion] = useState('HRV');
  const [loading, setLoading] = useState(true);
  const [copyCtx, setCopyCtx] = useState(null);
  const [toast, setToast]     = useState(0);   // 0이면 숨김, 증가할 때마다 애니메이션 재시작
  const [loadError, setLoadError] = useState(null);
  const [gotoRef,        setGotoRef]        = useState(null);
  const [compareGotoRef, setCompareGotoRef] = useState(null);
  const [activePanel,    setActivePanel]    = useState(null);

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
  const [bmColor,    setBmColor]    = useLocalStorage('bs-bmcolor', '#a8d8f0');

  // Apply theme & font size to root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);
  useEffect(() => {
    document.documentElement.style.setProperty('--font-size-verse', `${fontSize}px`);
  }, [fontSize]);

  useEffect(() => {
    async function load() {
      try {
        const [hrv, niv] = await Promise.all([
          fetch('/data/HRV.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
          fetch('/data/NIV.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
        ]);
        setBibles({ HRV: hrv, NIV: niv });
        setLoading(false);
      } catch (err) {
        setLoadError(err);
      }
    }
    load();
  }, []);

  function navigate(b, c, v = null) {
    if (tab === 'compare') {
      setCompareGotoRef({ b, c, v });
      return;
    }
    setGotoRef({ b, c, v });
    setTab('read');
    // Add to history (deduplicated, newest first, max 30)
    const entry = {
      b, c, v,
      time: new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };
    setHistory(prev => [entry, ...prev.filter(h => !(h.b === b && h.c === c && h.v === v))].slice(0, 30));
  }

  function showToast() {
    setToast(t => t + 1);
    setTimeout(() => setToast(0), 2000);
  }

  function handleQuickNav(e) {
    e.preventDefault();
    const ref = parseRef(quickInput);
    if (!ref) { setQuickError(true); return; }
    setQuickError(false);
    setQuickInput('');
    navigate(ref.b, ref.c, ref.v);
  }

  function removeBookmark(idx) {
    setBookmarks(prev => prev.filter((_, i) => i !== idx));
  }
  function removeHistory(idx) {
    setHistory(prev => prev.filter((_, i) => i !== idx));
  }

  if (loading) {
    return (
      <div className="loading-screen">
        {loadError ? (
          <>
            <p>성경 데이터를 불러오지 못했습니다.</p>
            <p className="loading-hint">네트워크 연결을 확인한 뒤 다시 시도해 주세요.</p>
            <button className="retry-btn" onClick={() => window.location.reload()}>다시 시도</button>
          </>
        ) : (
          <>
            <div className="loading-spinner" />
            <p>성경 데이터 로딩 중...</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        {/* Quick navigation */}
        <form className={`quick-nav ${quickError ? 'error' : ''}`} onSubmit={handleQuickNav}>
          <input
            type="text"
            placeholder="요3:16"
            value={quickInput}
            onChange={e => { setQuickInput(e.target.value); setQuickError(false); }}
            enterKeyHint="go"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            title="책이름 장:절 형식으로 입력 후 Enter (예: 요3:16, 창1:1)"
          />
          <button type="submit" className="quick-go" title="이동" aria-label="이동">→</button>
          {quickError && <span className="quick-error">찾을 수 없음</span>}
        </form>

        <div className="header-actions">
          {tab === 'read' && (
            <select className="version-select" value={version} onChange={e => setVersion(e.target.value)}>
              <option value="HRV">개역한글</option>
              <option value="NIV">NIV</option>
            </select>
          )}
          <button className={`icon-btn header-icon ${activePanel === 'bookmarks' ? 'active' : ''}`}
            onClick={() => setActivePanel(p => p === 'bookmarks' ? null : 'bookmarks')} title="즐겨찾기">★</button>
          <button className={`icon-btn header-icon ${activePanel === 'notes' ? 'active' : ''}`}
            onClick={() => setActivePanel(p => p === 'notes' ? null : 'notes')} title="메모">✎</button>
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
        <div className={`tab-content${tab === 'read' ? ' active' : ''}`}>
          <BibleReader
            bible={bibles[version]}
            version={version}
            gotoRef={gotoRef}
            onCopy={(bookId, chapter, verses, chapterData) =>
              setCopyCtx({ bookId, chapter, verses, chapterData })
            }
            onToast={showToast}
            bookmarks={bookmarks}
            onBookmark={setBookmarks}
            notes={notes}
            onNote={setNotes}
            hlDuration={hlDuration}
            hlColor={hlColor}
            bmColor={bmColor}
          />
        </div>
        <div className={`tab-content${tab === 'search' ? ' active' : ''}`}>
          <SearchPanel bibles={bibles} onGoTo={(b, c, v) => navigate(b, c, v)} />
        </div>
        <div className={`tab-content${tab === 'compare' ? ' active' : ''}`}>
          <CompareView
            bibles={bibles}
            gotoRef={compareGotoRef}
            bookmarks={bookmarks}
            onBookmark={setBookmarks}
            notes={notes}
            onNote={setNotes}
            bmColor={bmColor}
            onToast={showToast}
          />
        </div>
      </main>

      {copyCtx && (
        <CopyModal {...copyCtx} version={version} onClose={() => setCopyCtx(null)}
          onCopied={() => { setCopyCtx(null); showToast(); }} />
      )}

      {toast > 0 && <div key={toast} className="toast">복사되었습니다</div>}

      <PWAInstallPrompt />

      <SidePanel
        activePanel={activePanel}
        onClose={() => setActivePanel(null)}
        bookmarks={bookmarks}
        onGoToBookmark={bm => navigate(bm.b, bm.c)}
        onRemoveBookmark={removeBookmark}
        notes={notes}
        onNote={setNotes}
        onGoToNote={(b, c, v) => navigate(b, c, v)}
        history={history}
        onGoToHistory={h => navigate(h.b, h.c, h.v)}
        onRemoveHistory={removeHistory}
        darkMode={darkMode}
        onDarkMode={setDarkMode}
        fontSize={fontSize}
        onFontSize={setFontSize}
        hlDuration={hlDuration}
        onHlDuration={setHlDuration}
        hlColor={hlColor}
        onHlColor={setHlColor}
        bmColor={bmColor}
        onBmColor={setBmColor}
      />
    </div>
  );
}
