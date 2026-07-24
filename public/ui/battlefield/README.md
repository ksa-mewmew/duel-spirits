# 전장 배경 이미지 자리

`battlefield.webp`를 같은 이름으로 덮어쓰면 전투 화면 전체 배경에 자동으로 적용됩니다.

## 권장 규격

- 파일: `public/ui/battlefield/battlefield.webp`
- 형식: WebP
- 비율: 16:9
- 권장 크기: 1920×1080 또는 2560×1440
- 카드, 슬롯, 숫자, 버튼, 텍스트를 이미지에 직접 그리지 마세요.
- 중앙 전장과 좌우 HUD가 올라갈 부분은 과도하게 밝거나 복잡하지 않게 두세요.
- 상단과 하단은 플레이어 상태 바와 손패를 위해 비교적 차분하게 두는 편이 좋습니다.

## 미세 조정

`src/ui-overhaul.css`의 다음 값을 바꾸면 됩니다.

```css
--battlefield-position: 50% 50%;
--battlefield-size: cover;
--battlefield-dim: rgba(2, 7, 11, .42);
```

배경이 너무 어두우면 `--battlefield-dim`의 마지막 숫자를 낮추고, UI가 묻히면 높이세요.
