// 로그 플래그 설정: 각 단계별로 켜고 끌 수 있으며, ALL=false로 한꺼번에 모두 끌 수 있습니다.
const LogFlags = {
  ALL: true,
  RENDER: false,
  BEGIN_WORK: false,
  COMPLETE_WORK: false,
  COMMIT_ROOT: false,
  WORK_LOOP: false,
  PERFORM_UNIT: false,
  COMMIT_WORK: false,
  APPLY_PROPS: false,
  RECONCILE: false,
  USE_STATE: false,
  SCHEDULE_UPDATE: false,
};

// 디버그용 로그 헬퍼 함수
export function debug(flag, ...args) {
  _log("log", flag, ...args);
}

export function warn(flag, ...args) {
  _log("warn", flag, ...args);
}

export function error(flag, ...args) {
  _log("error", flag, ...args);
}

export function fatal(flag, ...args) {
  _log("fatal", flag, ...args);
}

function _log(level, flag, ...args) {
  if (!LogFlags.hasOwnProperty(flag)) {
    console.error(
      `[MiniReact Error] 로그 플래그 "${flag}"가 정의되지 않았습니다.`
    );
    return;
  }

  switch (level) {
    case "log":
      if (LogFlags.ALL && LogFlags[flag]) {
        console.log(`\x1b[32m[${flag}]\x1b[0m`, ...args);
      }
      break;
    case "warn":
      console.warn(`\x1b[33m[${flag}]\x1b[0m`, ...args);
      break;
    case "error":
      console.error(`\x1b[31m[${flag}]\x1b[0m`, ...args);
      break;
    case "fatal":
      console.log(`\x1b[35m[${flag}]\x1b[0m`, ...args);
      break;
  }
}
