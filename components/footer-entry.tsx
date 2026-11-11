import * as React from 'react';
import { createRoot } from 'react-dom/client';
import DoodleCrewFooter from './ui/doodle-crew-footer';

function goToMain() {
  const main = document.getElementById('main-content');
  if (!main) return;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  main.focus({ preventScroll: true });
  main.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'start' });
}

const root = document.getElementById('doodle-footer-root');
if (root) createRoot(root).render(
  <DoodleCrewFooter
    wordmark="LINGUA"
    brand="lingua live"
    blurb="말과 말 사이에 편안한 쉼을 더합니다."
    tagline="작은 대화가 큰 연결이 됩니다."
    columns={[]}
    actions={[{ label: '번역하러 가기', onClick: goToMain, icon: 'sparkle', variant: 'solid' }]}
    copyright="© 2026 lingua live"
    legal={[]}
    socials={[]}
    backToTop={false}
    crew={[
      { kind: 'cat', letter: 0, seat: 'front', name: '고양이', says: '반가워요!' },
      { kind: 'bird', letter: 2, seat: 'top', name: '새', says: '천천히 이야기해요.' },
      { kind: 'mushroom', letter: 4, seat: 'front', name: '버섯', says: '잠시 쉬어가요.' },
      { kind: 'ghost', letter: 5, seat: 'behind', name: '친구', says: '안녕하세요!' },
    ]}
    doodles={['star', 'heart', 'sparkle']}
    doodleCount={6}
    palette={{ background: 'var(--surface)', ink: 'var(--ink)', accent: 'var(--mark)' }}
    fontFamily="Arimo, 'Malgun Gothic', sans-serif"
    serifFamily="Arimo, 'Malgun Gothic', sans-serif"
    height="460px"
  />
);
