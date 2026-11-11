# 모션 가이드

나뭇잎 배경 모션은 `public/motion.css`에 독립되어 있습니다. 공통 변수 `--motion-fall-duration`, `--motion-drift-duration`, `--motion-leaf-opacity`로 속도와 강도를 조절할 수 있습니다. 이미지 보드의 나뭇잎을 사용하며, 장식 레이어는 포인터 이벤트와 스크린 리더에서 제외됩니다.

나중에 컴포넌트 레퍼런스를 적용할 때는 해당 컴포넌트의 기능과 상태 변화에 맞춰 별도 클래스를 추가하고, 장식 모션과 충돌하지 않도록 합니다. `prefers-reduced-motion: reduce`에서 움직임을 제거하거나 최소화하고, 텍스트·버튼 조작과 마이크 입력을 방해하지 않도록 확인합니다.
