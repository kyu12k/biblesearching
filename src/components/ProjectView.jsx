import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { BOOK_MAP } from '../data/books';

// 화면에 띄울 때 고를 수 있는 글꼴. probe 글꼴이 설치된 경우에만 목록에 보여준다
const PROJECT_FONTS = [
  { id: 'kopub',    label: 'KoPub 돋움', probe: null,      stack: "'KoPubWorld Dotum','Malgun Gothic',sans-serif" },
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

// ── 여러 모니터 (Window Management API — 데스크톱 크롬·엣지) ──
// 연결된 모니터 목록을 받아 원하는 모니터에 바로 전체화면을 띄운다.
const MULTI_SCREEN = typeof window !== 'undefined' && 'getScreenDetails' in window;
let screenDetails = null;   // 한 번 받으면 모니터 연결·창 이동에 따라 계속 갱신되는 객체라 재사용
async function getScreens() {
  if (!screenDetails) screenDetails = await window.getScreenDetails();
  return screenDetails;
}
const sameScreen = (a, b) => !!a && !!b && (a === b ||
  (a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height));
// 저장용: 모니터 객체는 저장할 수 없으므로 이름과 위치만 남긴다
const screenKey = s => ({ label: s.label ?? '', left: s.left, top: s.top, width: s.width, height: s.height });
function findScreen(screens, key) {
  if (!key) return null;
  return screens.find(s => sameScreen(s, key) && (s.label ?? '') === key.label)
      ?? screens.find(s => key.label && s.label === key.label)   // 해상도·배치가 바뀐 경우
      ?? null;
}
async function screenPermissionGranted() {
  // 크롬 111 이전에는 권한 이름이 window-placement 였다
  for (const name of ['window-management', 'window-placement']) {
    try { return (await navigator.permissions.query({ name })).state === 'granted'; }
    catch { /* 지원하지 않는 이름이면 다음 이름으로 */ }
  }
  return false;
}

// 창이 이미 화면을 꽉 채우고 있는지 (F11 전체화면, 설치한 앱으로 실행 등)
function alreadyFullscreen() {
  if (document.fullscreenElement) return true;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  return Math.abs(window.innerHeight - window.screen.height) <= 2;
}

export default function ProjectView({
  bible, bibles, version, bookId, chapter, verses, onClose,
  font, onFont, zoom: rawZoom, onZoom, autoFull, onAutoFull,
  screenPref, onScreenPref,
  defaultBilingual = false,
}) {
  // 선택한 절들을 순서대로 보여주고, 양 끝에서는 앞뒤 절로 계속 이어간다
  const [list, setList] = useState(() => verses.map(v => ({ b: bookId, c: chapter, v: +v })));
  const [idx, setIdx]   = useState(0);
  const [showUI, setShowUI] = useState(true);   // 잠시 움직임이 없으면 컨트롤을 숨긴다
  const [fontOpen, setFontOpen] = useState(false);
  const [bilingual, setBilingual] = useState(defaultBilingual);
  const [isFull, setIsFull] = useState(() => !!document.fullscreenElement);
  const [fontTick, setFontTick] = useState(0);   // 웹폰트가 준비되면 크기를 다시 계산
  // 보조 모니터가 연결되어 있는지 (권한 없이 알 수 있음) — 있을 때만 모니터 버튼을 보여준다
  const [extended, setExtended] = useState(() => MULTI_SCREEN && !!window.screen.isExtended);
  const [notice, setNotice] = useState('');

  const rootRef  = useRef(null);
  const boxRef   = useRef(null);
  const textRef  = useRef(null);
  const uiTimer  = useRef(null);
  const touchX   = useRef(null);
  const noticeTimer = useRef(null);

  const zoom = clampZoom(rawZoom ?? 0.9);
  const cur = list[idx];
  const text = bible?.[String(cur.b)]?.[String(cur.c)]?.[String(cur.v)] ?? '';
  const otherVersion = version === 'NIV' ? 'HRV' : 'NIV';
  const otherText = bibles?.[otherVersion]?.[String(cur.b)]?.[String(cur.c)]?.[String(cur.v)] ?? '';

  // 설치되어 있는 글꼴만 고를 수 있게 (probe 가 없는 항목은 항상 표시)
  const fonts = useMemo(() => PROJECT_FONTS.filter(f => !f.probe || hasFont(f.probe)), []);
  const curFont = fonts.find(f => f.id === font) ?? fonts[0];

  // 고른 글꼴이 웹폰트면 다 받은 뒤에 글자 크기를 다시 맞춘다
  useEffect(() => {
    const first = curFont.stack.split(',')[0];
    let alive = true;
    document.fonts?.load(`40px ${first}`)
      .then(() => { if (alive) setFontTick(t => t + 1); })
      .catch(() => {});
    return () => { alive = false; };
  }, [curFont]);

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

  const flash = useCallback((msg) => {
    setNotice(msg);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 3500);
  }, []);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  useEffect(() => {
    if (!MULTI_SCREEN) return;
    const onChange = () => setExtended(!!window.screen.isExtended);
    window.screen.addEventListener?.('change', onChange);
    return () => window.screen.removeEventListener?.('change', onChange);
  }, []);

  // 지금 창이 있는 모니터의 다음 모니터로 전체화면을 옮긴다 (2대면 서로 왔다 갔다)
  const moveScreen = useCallback(async () => {
    if (!MULTI_SCREEN) { flash('모니터 전환은 PC용 크롬·엣지에서만 지원됩니다'); return; }
    try {
      const d = await getScreens();   // 처음에는 브라우저가 모니터 권한을 묻는다
      const screens = d.screens;
      if (screens.length < 2) { flash('연결된 다른 모니터가 없습니다'); return; }
      // 권한 창에 응답하느라 시간이 지나면 전체화면 요청이 거부되므로 한 번 더 누르게 한다
      if (navigator.userActivation && !navigator.userActivation.isActive) {
        flash('모니터 권한이 허용되었습니다. 한 번 더 누르면 옮겨집니다');
        return;
      }
      const i = screens.findIndex(x => sameScreen(x, d.currentScreen));
      const target = screens[(i + 1) % screens.length];
      await rootRef.current.requestFullscreen({ screen: target });
      onScreenPref(screenKey(target));   // 다음에 열 때도 이 모니터에서
      onAutoFull(true);
    } catch (err) {
      if (err?.name === 'NotAllowedError' && !(await screenPermissionGranted())) {
        flash('모니터 권한이 필요합니다 — 주소창 왼쪽 아이콘에서 "창 관리"를 허용해 주세요');
      } else {
        flash('다른 모니터로 옮기지 못했습니다');
      }
    }
  }, [flash, onScreenPref, onAutoFull]);

  // 키보드: ←/→ 이동, Esc 닫기, +/- 글자 크기, F 전체화면, M 모니터 전환
  useEffect(() => {
    function onKey(e) {
      const k = e.key;
      // 절 이동만으로는 컨트롤을 띄우지 않는다 (화면에 본문만 남도록)
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === ' ' || k === 'PageDown') { e.preventDefault(); go(1); }
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); go(-1); }
      else if (k === 'Escape') onClose();
      else if (k === '+' || k === '=') { onZoom(clampZoom(zoom + ZOOM_STEP)); wakeUI(); }
      else if (k === '-') { onZoom(clampZoom(zoom - ZOOM_STEP)); wakeUI(); }
      // 한글 입력 상태에서도 동작하도록 글자가 아니라 키 위치로 판단
      else if (e.ctrlKey || e.metaKey || e.altKey) return;
      else if (e.code === 'KeyF') { toggleFull(); }
      else if (e.code === 'KeyM') { e.preventDefault(); moveScreen(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose, wakeUI, zoom, onZoom, toggleFull, moveScreen]);

  // 전체화면 + 화면 꺼짐 방지.
  // 이미 F11 등으로 화면을 채우고 있으면 전체화면 API를 쓰지 않는다 —
  // 브라우저가 "전체 화면을 종료하려면 Esc 키를 누르세요" 안내를 띄우기 때문.
  // 지난번에 다른 모니터로 옮겼다면 이번에도 그 모니터에서 바로 연다.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!autoFull) return;
      let target = null;
      if (MULTI_SCREEN && screenPref && window.screen.isExtended && await screenPermissionGranted()) {
        const d = await getScreens().catch(() => null);
        const s = d && findScreen(d.screens, screenPref);
        if (s && !sameScreen(s, d.currentScreen)) target = s;
      }
      if (cancelled) return;
      if (target) rootRef.current?.requestFullscreen?.({ screen: target }).catch(() => {});
      else if (!alreadyFullscreen()) rootRef.current?.requestFullscreen?.().catch(() => {});
    })();
    let lock = null;
    navigator.wakeLock?.request('screen').then(l => { lock = l; }).catch(() => {});
    return () => {
      cancelled = true;
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
  }, [text, otherText, bilingual, zoom, curFont, fontTick]);

  function onTouchStart(e) { touchX.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    const start = touchX.current;
    touchX.current = null;
    if (start === null) return;
    const dx = e.changedTouches[0].clientX - start;
    // 스와이프는 절 이동만 (컨트롤은 그대로 숨겨둔다).
    // 가볍게 누른 경우는 아래 onClick 에서 처리 — 좌우 이동 영역은 자기 핸들러가 막는다
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  }

  const label = refLabel(cur, version);
  const otherLabel = refLabel(cur, otherVersion);

  return (
    <div
      ref={rootRef}
      className={`project-view${showUI ? '' : ' hide-ui'}`}
      style={{ fontFamily: curFont.stack }}
      onPointerMove={e => { if (e.pointerType === 'mouse') wakeUI(); }}
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

      <div className="project-controls" onClick={e => { e.stopPropagation(); wakeUI(); }}>
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
        <button className={bilingual ? 'on' : ''} onClick={() => setBilingual(v => !v)} title="한·영 함께 보기">한/EN</button>
        {extended && (
          <button onClick={moveScreen} title="다른 모니터로 옮기기 (M)">⇄ 모니터</button>
        )}
        <button className={isFull ? 'on' : ''} onClick={toggleFull} title={isFull ? '전체화면 끄기 (F)' : '전체화면 (F)'}>⛶</button>
        <button className="project-close" onClick={onClose} title="닫기 (Esc)">✕</button>
      </div>

      {notice && <div className="project-notice" role="status">{notice}</div>}
    </div>
  );
}
