// 앱(서비스 워커) 업데이트 처리
//
// 설치한 앱은 화면과 성경 데이터를 기기에 저장된 것에서 꺼내 쓰고, 새 버전은 뒤에서 받아 둔다.
// 받은 새 버전은 화면을 새로 불러와야 적용되는데, 폰에서 앱을 껐다 켜는 건 대개 뒤로 보냈다가
// 꺼내는 것이라 화면을 새로 불러오지 않는다. 그래서 새 버전이 적용되면:
//  - 앱을 켠 직후(아직 아무것도 하지 않았을 때)면 바로 새로고침
//  - 사용 중이면 새로고침하지 않고 안내만 띄운다 (크게 보기 도중에 화면이 바뀌면 안 되므로)
// 그리고 앱으로 다시 돌아올 때마다 새 버전이 있는지 확인한다.
import { useSyncExternalStore } from 'react';

const LAUNCH_WINDOW_MS = 15000;   // '켠 직후'로 보는 시간
const startedAt = Date.now();
let interacted = false;
let updateReady = false;
const listeners = new Set();

// 사용 중인지: 한 번이라도 조작했거나, 켠 지 오래됐거나, 크게 보기·복사 창·옆 패널이 열려 있으면
function inUse() {
  return interacted || Date.now() - startedAt > LAUNCH_WINDOW_MS ||
    !!document.querySelector('.project-view, .modal-overlay, .side-panel-overlay');
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  for (const ev of ['pointerdown', 'keydown', 'wheel']) {
    window.addEventListener(ev, () => { interacted = true; }, { capture: true, passive: true });
  }

  // 처음 설치될 때도 controllerchange 가 오므로, 이미 서비스 워커가 있던 경우만 업데이트로 본다
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    if (!inUse()) { reloading = true; window.location.reload(); return; }
    updateReady = true;
    listeners.forEach(l => l());
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(reg => {
      // 앱으로 돌아올 때마다(뒤에 며칠씩 떠 있던 경우 포함) 새 버전 확인
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    }).catch(() => {});
  });
}

// 사용 중에 새 버전이 준비되었는지 (안내 띄우기용)
export function useUpdateReady() {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb); },
    () => updateReady,
  );
}
