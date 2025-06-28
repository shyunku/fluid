export class Cache {
  // 최상위 컴포넌트
  static rootComponent = null;

  // 최상위 노드 (DOM 노드)
  static rootTarget = null;

  // 최상위 Fiber
  static rootFiber = null;

  // 현재 렌더링 중인 Root Fiber
  static currentRoot = null;

  // 삭제할 Fiber List
  static deletions = [];

  // 다음 작업 단위
  static nextUnitOfWork = null;

  // 작업 루프 예약 여부
  static workLoopScheduled = false;

  // 현재 렌더링 중인 Fiber
  static wipFiber = null;

  // alternate(current) 훅 리스트를 순회하는 포인터
  static currentHook = null;

  // wip 훅 리스트를 순회하는 포인터
  static wipHook = null;

  // 렌더링
  static renderFunc = null;

  // 중복 예약 방지
  static scheduled = false;

  // 대기 중인 Effect List
  static pendingEffects = [];

  // Context 스택
  static contextStack = [];

  // 컨텍스트 변경에 따른 강제 리렌더링 카운터
  static forceRenderDescendantsCount = 0;

  // 렌더링 중 업데이트가 발생했는지 여부
  static updatePending = false;
}
