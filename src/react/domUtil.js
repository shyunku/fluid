import { NodeTagType, EffectType } from "./types.js";

/* Host 부모 탐색 */
export function findHostParentFiber(fiber) {
  let p = fiber.parent;
  // 부모를 타고 올라가며 HOST 또는 HOST_ROOT 타입을 찾음
  while (p && p.tag !== NodeTagType.HOST && p.tag !== NodeTagType.HOST_ROOT) {
    p = p.parent;
  }
  return p;
}

export function findHostParentDom(fiber) {
  const parentFiber = findHostParentFiber(fiber);
  if (!parentFiber) return null;
  return parentFiber.stateNode ?? null;
}

/* Host 형제 탐색 */
export function findHostSiblingDom(fiber) {
  let node = fiber;

  // `findSibling` 루프: `PLACEMENT` 효과가 있는 형제 컴포넌트 찾기
  findSibling: while (node) {
    while (!node.sibling) {
      // 형제가 없으면 부모로 올라가서 확인
      if (
        !node.parent ||
        node.parent.tag === NodeTagType.HOST_ROOT ||
        node.parent.tag === NodeTagType.HOST
      )
        return null; // 루트까지 갔으면 없음
      node = node.parent; // 부모로 올라가기
    }

    // 형제가 있을 때, 다음 형제로 이동
    node = node.sibling;

    // HOST 컴포넌트를 찾을 때까지 내려가며 확인
    while (node.tag !== NodeTagType.HOST && node.tag !== NodeTagType.TEXT) {
      // 해당 형제가 `PLACEMENT` 태그가 붙어 있으면 건너뛰고 계속 진행
      if (node.effectTag && node.effectTag === EffectType.PLACEMENT)
        continue findSibling;
      node = node.child; // 자식으로 내려가며 찾기
    }

    // `PLACEMENT` 태그가 없는 Host 컴포넌트 찾으면 반환
    if (!(node.effectTag && node.effectTag === EffectType.PLACEMENT))
      return node.stateNode ?? null;
  }

  return null; // 결국 찾지 못한 경우
}

export function insertOrAppendDom(node, before, parentDom) {
  if (node.tag === NodeTagType.HOST || node.tag === NodeTagType.TEXT) {
    const target = node.stateNode;
    if (before) {
      parentDom.insertBefore(target, before);
    } else {
      parentDom.appendChild(target);
    }
    return;
  }
  let child = node.child;
  while (child) {
    insertOrAppendDom(child, before, parentDom);
    child = child.sibling;
  }
}
