import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { BOOK_MAP } from '../data/books';

// 화면에 띄울 때 고를 수 있는 글꼴. probe 글꼴이 설치된 경우에만 목록에 보여준다
const PROJECT_FONTS = [
  { id: 'myeongjo', label: '명조',     probe: 'Batang',      stack: "'Nanum Myeongjo','NanumMyeongjo','Batang','바탕',serif" },
  { id: 'gothic',   label: '고딕',     probe: null,          stack: "'Malgun Gothic','맑은 고딕','Apple SD Gothic Neo','Noto Sans KR',sans-serif" },
  { id: 'nanum',    label: '나눔고딕', probe: 'NanumGothic', stack: "'NanumGothic','Nanum Gothic','Malgun Gothic',sans-serif" },
  { id: 'gungsuh',  label: '궁서',     probe: 'Gungsuh',     stack: "'Gungsuh','궁서','GungsuhChe',serif" },
  { id: 'dotum',    label: '돋움',     probe: 'Dotum',       stack: "'Dotum','돋움','Malgun Gothic',sans-serif" },
];

// 글꼴이 실제로 설치되어 있는지 — 기준 글꼴과 글자 너비가 다른지로 판단
function hasFont(family) {
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    const sample = '가나다라마ABCabc';
    return ['monospace', 'serif'].some(base => {
      ctx.font = `28px ${base}`;
      const w = ctx.measureText(sample).width;
      ctx.font = `28px '${family}', ${base}`;
      return ctx.measureText(sample).width !== w;
    });
  } catch { return false; }
}

function verseNums(bible, b, c) {
  const data = bible?.[String(b)]?.[String(c)];
  return data ? Object.keys(data).map(Number).sort((x, y) => x - y) : [];
}

// 다음(dir=1)/이전(dir=-1) 절 참조. 장·권 경계를 넘어가며, 성경 끝이면 null
function stepRef(bible, { b, c, v }, dir) {
  const nums = verseNums(bible, b, c);
  const i = nums.indexOf(v);
  if (i !== -1 && nums[i + dir] !== undefined) return { b, c, v: nums[i + dir] };

  // 장 경계 — 다음/이전 장(없으면 다음/이전 권)으로
  let nb = b, nc = c + dir;
  if (nc < 1) {
    nb = b - 1;
    if (nb < 1) return null;
    nc = BOOK_MAP[nb].chapters;
  } else if (nc > (BOOK_MAP[b]?.chapters ?? 1)) {
    nb = b + 1;
    if (nb > 66) return null;
    nc = 1;
  }
  const next = verseNums(bible, nb, nc);
  if (!next.length) return null;
  return { b: nb, c: nc, v: dir > 0 ? next[0] : next[next.length - 1] };
}

function refLabel({ b, c, v }, version) {
  const info = BOOK_MAP[b];
  const name = version === 'NIV' ? (info?.en ?? info?.ko) : (info?.ko ?? '');
  return `${name} ${c}:${v}`;
}

// 글자 크기 배율: 1 = 화면에 꽉 차게, 그 아래로만 줄일 수 있다
const ZOOM_MIN = 0.5, ZOOM_MAX = 1, ZOOM_STEP = 0.05;
const clampZoom = z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));

// 창이 이미 화면을 꽉 채우고 있는지 (F11 전체화면, 설치한 앱으로 실행 등)
function alreadyFullscreen() {
  if (document.fullscreenElement) return true;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  return Math.abs(window.innerHeight - window.screen.height) <= 2;
}

export default function ProjectView({
  bible, bibles, version, bookId, chapter, verses, onClose,
  bgLight, onBgLight, font, onFont, zoom: rawZoom, onZoom, autoFull, onAutoFull,
  defaultBilingual = false,
}) {
  // 선택한 절들을 순서대로 보여주고, 양 끝에서는 앞뒤 절로 계속 이어간다
  const [list, setList] = useState(() => verses.map(v => ({ b: bookId, c: chapter, v: +v })));
  const [idx, setIdx]   = useState(0);
  const [showUI, setShowUI] = useState(true);   // 잠시 움직임이 없으면 컨트롤을 숨긴다
  const [fontOpen, setFontOpen] = useState(false);
  const [bilingual, setBilingual] = useState(defaultBilingual);
  const [isFull, setIsFull] = useState(() => !!document.fullscreenElement);

  const rootRef  = useRef(null);
  const boxRef   = useRef(null);
  const textRef  = useRef(null);
  const uiTimer  = useRef(null);
  const touchX   = useRef(null);

  const zoom = clampZoom(rawZoom ?? 0.9);
  const cur = list[idx];
  const text = bible?.[String(cur.b)]?.[String(cur.c)]?.[String(cur.v)] ?? '';
  const otherVersion = version === 'NIV' ? 'HRV' : 'NIV';
  const otherText = bibles?.[otherVersion]?.[String(cur.b)]?.[String(cur.c)]?.[String(cur.v)] ?? '';

  // 설치되어 있는 글꼴만 고를 수 있게 (probe 가 없는 항목은 항상 표시)
  const fonts = useMemo(() => PROJECT_FONTS.filter(f => !f.probe || hasFont(f.probe)), []);
  const curFont = fonts.find(f => f.id === font) ?? fonts[0];

  const go = useCallback((dir) => {
    // 목록 안에서는 그대로 이동, 양 끝에서는 앞뒤 절을 이어붙인다
    if (dir > 0 && idx < list.length - 1) { setIdx(idx + 1); return; }
    if (dir < 0 && idx > 0) { setIdx(idx - 1); return; }
    const next = stepRef(bible, dir > 0 ? list[list.length - 1] : list[0], dir);
    if (!next) return;                              // 성경의 처음/끝
    if (dir > 0) { setList([...list, next]); setIdx(list.length); }
    else { setList([next, ...list]); setIdx(0); }
  }, [bible, idx, list]);

  // 컨트롤 자동 숨김
  const wakeUI = useCallback(() => {
    setShowUI(true);
    clearTimeout(uiTimer.current);
    uiTimer.current = setTimeout(() => setShowUI(false), 2500);
  }, []);
  useEffect(() => {
    uiTimer.current = setTimeout(() => setShowUI(false), 2500);
    return () => clearTimeout(uiTimer.current);
  }, []);

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
      onAutoFull(false);   // 직접 끈 경우 다음에 열 때도 자동으로 켜지 않는다
    } else {
      rootRef.current?.requestFullscreen?.().then(() => onAutoFull(true)).catch(() => {});
    }
  }, [onAutoFull]);

  // 키보드: ←/→ 이동, Esc 닫기, +/- 글자 크기, b 배경, f 전체화면
  useEffect(() => {
    function onKey(e) {
      const k = e.key;
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === ' ' || k === 'PageDown') { e.preventDefault(); go(1); wakeUI(); }
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); go(-1); wakeUI(); }
      else if (k === 'Escape') onClose();
      else if (k === '+' || k === '=') { onZoom(clampZoom(zoom + ZOOM_STEP)); wakeUI(); }
      else if (k === '-') { onZoom(clampZoom(zoom - ZOOM_STEP)); wakeUI(); }
      else if (k.toLowerCase?.() === 'b') { onBgLight(!bgLight); wakeUI(); }
      else if (k.toLowerCase?.() === 'f') { toggleFull(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose, wakeUI, bgLight, onBgLight, zoom, onZoom, toggleFull]);

  // 전체화면 + 화면 꺼짐 방지.
  // 이미 F11 등으로 화면을 채우고 있으면 전체화면 API를 쓰지 않는다 —
  // 브라우저가 "전체 화면을 종료하려면 Esc 키를 누르세요" 안내를 띄우기 때문.
  useEffect(() => {
    if (autoFull && !alreadyFullscreen()) {
      rootRef.current?.requestFullscreen?.().catch(() => {});
    }
    let lock = null;
    navigator.wakeLock?.request('screen').then(l => { lock = l; }).catch(() => {});
    return () => {
      lock?.release?.().catch(() => {});
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onFsChange() { setIsFull(!!document.fullscreenElement); }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // 화면에 꽉 차도록 글자 크기 자동 계산
  useLayoutEffect(() => {
    const box = boxRef.current, el = textRef.current;
    if (!box || !el) return;
    // 먼저 화면에 꽉 차는 크기를 찾고(한 글자가 너무 커지지 않도록 상한을 둔다),
    // 거기에 사용자가 고른 배율을 곱한다. 배율이 1이면 화면에 꽉 찬다.
    const cap = Math.min(box.clientWidth * 0.16, box.clientHeight * 0.18);
    let lo = 12, hi = Math.max(20, cap);
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      el.style.fontSize = `${mid}px`;
      if (el.scrollHeight <= box.clientHeight && el.scrollWidth <= box.clientWidth) lo = mid;
      else hi = mid;
    }
    el.style.fontSize = `${lo * zoom}px`;
  }, [text, otherText, bilingual, zoom, bgLight, curFont]);

  function onTouchStart(e) { touchX.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    const start = touchX.current;
    touchX.current = null;
    if (start === null) return;
    const dx = e.changedTouches[0].clientX - start;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    wakeUI();
  }

  const label = refLabel(cur, version);
  const otherLabel = refLabel(cur, otherVersion);

  return (
    <div
      ref={rootRef}
      className={`project-view${bgLight ? ' light' : ''}${showUI ? '' : ' hide-ui'}`}
      style={{ fontFamily: curFont.stack }}
      onMouseMove={wakeUI}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={() => { setFontOpen(false); wakeUI(); }}
    >
      <div className="project-stage">
        <div className="project-fit" ref={boxRef}>
          <div className="project-text" ref={textRef}>
            <p className="project-verse">{text}</p>
            {bilingual && otherText && <p className="project-verse other">{otherText}</p>}
          </div>
        </div>
      </div>

      <div className="project-ref">
        {label}
        {bilingual && otherText && <span className="project-ref-other"> · {otherLabel}</span>}
      </div>

      <button className="project-nav prev" onClick={e => { e.stopPropagation(); go(-1); }} aria-label="이전 절">‹</button>
      <button className="project-nav next" onClick={e => { e.stopPropagation(); go(1); }} aria-label="다음 절">›</button>

      <div className="project-controls" onClick={e => e.stopPropagation()}>
        <button onClick={() => onZoom(clampZoom(zoom - ZOOM_STEP))} disabled={zoom <= ZOOM_MIN} title="글자 작게 (-)">A-</button>
        <button onClick={() => onZoom(clampZoom(zoom + ZOOM_STEP))} disabled={zoom >= ZOOM_MAX} title="글자 크게 (+)">A+</button>
        <div className="project-font-wrap">
          <button
            className={`project-font-btn${fontOpen ? ' on' : ''}`}
            style={{ fontFamily: curFont.stack }}
            onClick={() => { setFontOpen(o => !o); wakeUI(); }}
            title="글꼴 고르기"
          >{curFont.label}</button>
          {fontOpen && (
            <div className="project-font-menu">
              {fonts.map(f => (
                <button
                  key={f.id}
                  className={f.id === curFont.id ? 'sel' : ''}
                  style={{ fontFamily: f.stack }}
                  onClick={() => { onFont(f.id); setFontOpen(false); wakeUI(); }}
                >
                  <span className="project-font-name">{f.label}</span>
                  <span className="project-font-sample">하나님의 말씀</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => onBgLight(!bgLight)} title="배경 밝기 (B)">{bgLight ? '🌙' : '☀'}</button>
        <button className={bilingual ? 'on' : ''} onClick={() => setBilingual(v => !v)} title="한·영 함께 보기">한/EN</button>
        <button className={isFull ? 'on' : ''} onClick={toggleFull} title={isFull ? '전체화면 끄기 (F)' : '전체화면 (F)'}>⛶</button>
        <button className="project-close" onClick={onClose} title="닫기 (Esc)">✕</button>
      </div>
    </div>
  );
}
