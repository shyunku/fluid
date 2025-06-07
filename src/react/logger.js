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
  USE_REF: false,
  USE_CONTEXT: false,
  CONTEXT: false,
  SCHEDULE_UPDATE: false,
  LIFECYCLE: false,
  ROUTER: false,
  ERROR_BOUNDARY: false,
};

const noop = () => {};

/**
 * 로그를 출력합니다.
 * @param {string} flag
 * @returns {function(...*): void}
 */
export function log(flag) {
  if (flag) {
    return console.log.bind(console, `\x1b[37m[${flag}]\x1b[0m`);
  }
  return console.log.bind(console);
}

/**
 * 디버그 로그를 출력합니다.
 * @param {string} flag
 * @returns {function(...*): void}
 */
// 디버그용 로그 헬퍼 함수
export function debug(flag) {
  if (!LogFlags.hasOwnProperty(flag)) {
    console.error(
      `[MiniReact Error] 로그 플래그 "${flag}"가 정의되지 않았습니다.`
    );
    return noop;
  }
  if (LogFlags.ALL && LogFlags[flag]) {
    return console.log.bind(console, `\x1b[32m[${flag}]\x1b[0m`);
  }
  return noop;
}

/**
 * 경고 로그를 출력합니다.
 * @param {string} flag
 * @returns {function(...*): void}
 */
export function warn(flag) {
  if (!LogFlags.hasOwnProperty(flag)) {
    console.error(
      `[MiniReact Error] 로그 플래그 "${flag}"가 정의되지 않았습니다.`
    );
    return noop;
  }
  return console.warn.bind(console, `\x1b[33m[${flag}]\x1b[0m`);
}

/**
 * 에러 로그를 출력합니다.
 * @param {string} flag
 * @returns {function(...*): void}
 */
export function error(flag) {
  if (!LogFlags.hasOwnProperty(flag)) {
    console.error(
      `[MiniReact Error] 로그 플래그 "${flag}"가 정의되지 않았습니다.`
    );
    return noop;
  }
  return console.error.bind(console, `\x1b[31m[${flag}]\x1b[0m`);
}

/**
 * 심각한 에러 로그를 출력합니다.
 * @param {string} flag
 * @returns {function(...*): void}
 */
export function fatal(flag) {
  if (!LogFlags.hasOwnProperty(flag)) {
    console.error(
      `[MiniReact Error] 로그 플래그 "${flag}"가 정의되지 않았습니다.`
    );
    return noop;
  }
  return console.error.bind(console, `\x1b[35m[${flag}]\x1b[0m`);
}
