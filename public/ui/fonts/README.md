# UI 글꼴

WOFF2 파일을 다음 이름으로 배치하면 자동으로 적용됩니다.

```text
public/ui/fonts/
├─ ui.woff2       # 버튼, 패널 등 전체 인터페이스
├─ display.woff2  # 제목과 주요 표시
└─ card.woff2     # 카드 이름, 비용, 공격력, 체력
```

카드 글꼴만 교체하려면 원하는 글꼴을 WOFF2로 준비해 `card.woff2`라는
이름으로 넣고 브라우저를 새로고침합니다.

다른 파일명이나 웹폰트를 사용하려면 `src/ui-overhaul.css`의
`@font-face`에서 `src`를 바꿉니다. 카드 글꼴 우선순위는
`--font-card` 변수로 조절할 수 있습니다.

```css
:root {
  --font-card: '내 카드 글꼴', 'Noto Sans KR', sans-serif;
}
```

글꼴을 배포할 때는 해당 글꼴의 웹 임베딩과 재배포 라이선스를 반드시
확인하세요.
