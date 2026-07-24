# Duel Spirits 외부 비주얼 자산 위치

최종 이미지를 같은 경로와 이름으로 넣으면 코드 수정 없이 교체됩니다.

| 자산 | 경로 | 권장 규격 |
|---|---|---|
| 카드 프레임 | `public/ui/card-frames/card-frame.png` | 투명 PNG, 5:7, 1000×1400 이상 |
| 전장 배경 | `public/ui/battlefield/battlefield.webp` | WebP, 16:9, 1920×1080 이상 |
| 카드 일러스트 | `public/card-art/<card id>.webp` | WebP, 5:7, 1000×1400 이상 |
| UI 본문 폰트 | `public/ui/fonts/ui.woff2` | 한글 포함 WOFF2 |
| 제목·카드명 폰트 | `public/ui/fonts/display.woff2` | 한글 포함 WOFF2 |

카드별 초점과 확대는 `src/config/visual-assets.ts`에서 관리합니다. 이 방식은 `CardDefinition` 타입에 이미지 전용 필드를 추가하지 않으므로 게임 규칙 데이터와 UI 자산 설정이 서로 분리됩니다.
