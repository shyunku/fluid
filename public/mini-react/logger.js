// 로그 플래그 설정: 각 단계별로 켜고 끌 수 있으며, ALL=false로 한꺼번에 모두 끌 수 있습니다.
const LogFlags = {
  ALL: true,
  RENDER: false,
  BEGIN_WORK: false,
  COMPLETE_WORK: false,
  COMMIT_ROOT: true,
  WORK_LOOP: false,
  PERFORM_UNIT: false,
  COMMIT_WORK: true,
  APPLY_PROPS: false,
  RECONCILE: false,
  USE_STATE: false,
  SCHEDULE_UPDATE: false,
};

// 디버그용 로그 헬퍼 함수
export function debug(flag, ...args) {
  if (LogFlags.ALL && LogFlags[flag]) {
    console.log(`\x1b[32m[${flag}]\x1b[0m`, ...args);
  }
}
