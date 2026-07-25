# 카드 아이콘 에셋

다음 이름으로 투명 배경 WebP 파일을 넣으면 모든 카드 화면에 자동으로
적용됩니다.

```text
public/ui/card-icons/
├─ attribute-fire.webp
├─ attribute-water.webp
├─ attribute-earth.webp
├─ attribute-dark.webp
├─ attribute-light.webp
├─ cost.webp
├─ attack.webp
├─ health.webp
└─ spell.webp
```

## 권장 규격

- 형식: 투명 배경 WebP
- 비율: 1:1
- 권장 크기: 256×256 또는 512×512
- 이미지 가장자리에 약 8~12% 안전 여백 권장
- 비용·공격력·체력 아이콘은 중앙 숫자가 올라갈 공간을 비워둘 것
- 속성과 주문 아이콘은 중앙 문자가 함께 표시되는 구도를 고려할 것

아이콘 레이어와 숫자·문자 레이어는 분리되어 있습니다. 아이콘은 원형
요소보다 8% 크게 배치되며 카드 크기에 따라 동일한 비율로 확대·축소됩니다.

## 화면에서 미세 조정하기

`src/ui-overhaul.css`의 다음 변수로 모든 카드 화면을 한 번에 조절할 수
있습니다.

```css
--card-face-value-orb: 22cqi;       /* 비용·공격력·체력 슬롯 크기 */
--card-icon-cost-size: 145%;        /* 비용 장식 이미지 크기 */
--card-icon-combat-size: 140%;      /* 공격력·체력 장식 이미지 크기 */
--card-icon-combat-bottom: 3cqi;    /* 공격력·체력 슬롯의 아래 여백 */
--card-icon-combat-y: -46%;         /* 장식만 세로로 미세 조정 */
```

- 장식을 크게 하려면 `--card-icon-combat-size`를 높입니다.
- 숫자를 포함한 공격력·체력 전체를 아래로 내리려면
  `--card-icon-combat-bottom`을 낮춥니다.
- 숫자는 유지하고 장식만 아래로 내리려면 `--card-icon-combat-y`를
  `-44%`처럼 0에 가깝게 바꿉니다.
- 비용 장식 크기는 `--card-icon-cost-size`로 조정합니다.
