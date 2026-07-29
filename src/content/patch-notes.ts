export interface PatchNote {
  version: string
  date: string
  title: string
  changes: string[]
}

/**
 * Keep newest first. This file is deliberately plain data so a balance patch
 * changes cards and its player-facing history in one reviewable commit.
 */
export const PATCH_NOTES: PatchNote[] = [
  {
    version: '0.2.0',
    date: '2026-07-29',
    title: '친구 메타 플레이 기반',
    changes: [
      'AI 대전과 방 코드 참가를 추가했습니다.',
      '덱 복제, 덱 코드 내보내기·불러오기를 추가했습니다.',
      'Windows 앱에 덱 파일 저장과 자동 백업을 추가했습니다.',
      '대전 종료 후 덱 수정과 재대전 흐름을 정리했습니다.',
      '비공개 밸런스 통계 기록 기반을 추가했습니다.',
    ],
  },
  {
    version: '0.1.11',
    date: '2026-07-27',
    title: '전투 안정화',
    changes: [
      '친구 방 재접속과 자리 보존을 안정화했습니다.',
      '최근 행동 로그에 소환, 파괴, 라이프 변화 정보를 보강했습니다.',
      '기본 덱 네 종류와 카드 세트 필터를 정리했습니다.',
    ],
  },
]
