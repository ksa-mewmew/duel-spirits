# SOF 적용 안내

이 패키지는 사용자가 실제로 받은 **UI 상태 표시 v8**을 기준으로 카드군 2 `진화의 시작(SOF)`을 다시 병합한 버전입니다.

다음 사용자 수정도 포함합니다.

- 선택 대기 안내: `상대 턴 중 효과가 발동했습니다. 선택을 완료해 주세요.`
- 떠다니는 산맥: 비용 6, 공격력 5, 체력 5, 질풍

내부 공개 알파 작업이나 AI 관련 파일은 포함하지 않습니다.

## 패치 적용

패치 ZIP의 파일을 기존 저장소 루트에 같은 경로로 덮어쓴 뒤 실행합니다.

```bash
npm ci
npm run check
```

큰 변경이므로 별도 브랜치 적용을 권장합니다.

```bash
git switch -c sof-card-group-2
git add .
git commit -m "feat: add SOF card set and evolution mechanic"
git push -u origin sof-card-group-2
```
