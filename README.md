# Fluid 🫧

_경량 가상 DOM / 훅 기반 UI 라이브러리_
_(내부 모듈: **MiniReact** + **MiniJSX**)_

Fluid는 **React의 작동 방식을 최대한 간단히 재현**하면서도,
1 개의 JS 파일만으로 **가볍게 삽입**해 쓸 수 있도록 만든 실험적 프레임워크입니다.

- **MiniReact** – 가상 DOM, Fiber reconciler, 훅, 라우터 포함
- **MiniJSX** – 런타임 내장 JSX → `h()` 변환기(브라우저에서 바로 파싱)

> “React를 베낀 것이 아니라 *React*의 아이디어를 **학습용으로 최소 구현**한 프로젝트”
> — so, **React API 1:1 호환을 보장하지 않습니다.**

> **License**  
> Fluid is released under the MIT License.  
> **Please keep the original copyright & license notice** when you fork,
> redistribute, or create derivative works.

---

## 목차

1. [특징](#특징)
2. [빠른 시작](#빠른-시작)
3. [API 한눈에 보기](#api-한눈에-보기)
4. [동작 원리](#동작-원리)
5. [제한 사항](#제한-사항)
6. [라이선스 & 크레딧](#라이선스--크레딧)

---

## 특징

| 기능                                | 지원 여부 | 비고                                                |
| ----------------------------------- | --------- | --------------------------------------------------- |
| 함수형 컴포넌트                     | ✔         | `h()` 혹은 JSX 사용                                 |
| 훅 `useState/useEffect/useMemo/...` | ✔         | React와 동일한 시그니처                             |
| Keyed diffing / 삭제·삽입·이동      | ✔         | 경고 및 위치 이동 처리                              |
| Context API                         | ✔         | `createContext → Provider / useContext`             |
| Hash Router                         | ✔         | `Router / Route / Link / useNavigate / useLocation` |
| 작업 스케줄러                       | ✔         | `requestIdleCallback` 대체 포함                     |
| 자동 JSX 변환                       | ✔         | `<script type="text/jsx">` or `*.jsx` 불러오기      |
| 클래스 컴포넌트                     | ✘         | 계획 없음                                           |
| Concurrent / Suspense               | ✘         | 미지원                                              |
| Portal / Ref forwarding             | ✘         | 미지원                                              |

---

## 빠른 시작

```html
<!-- 1. 라이브러리 단일 파일 포함 -->
<script src="fluid.js"></script>
<script src="jsx.js"></script>

<!-- 2. JSX 스크립트 작성 -->
<script type="text/jsx">
  const { useState } = MiniReact;

  function Counter() {
    const [n, setN] = useState(0);
    return (
      <button onClick={() => setN(n + 1)}>
        Clicked {n} times
      </button>
    );
  }

  // 마운트
  MiniReact.render(<Counter />, document.getElementById('root'));
</script>

<div id="root"></div>
```

> **브라우저가 JSX를 그대로 읽어** MiniJSX가 자동 변환 → MiniReact `h()` 호출로 실행됩니다.

### 번들러(없음)로 쓰기

별도 빌드 체인 없이 `<script>` 한 장으로 끝나므로
**CodePen · GitHub Pages · 로컬 HTML** 어디서든 즉시 실행 가능.

---

## API 한눈에 보기

```js
/* Core */
const {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useReducer,
  useRef,
  createContext,
  useContext,
  Router,
  Route,
  Link,
  useNavigate,
  useLocation,
} = MiniReact;
```

### 훅 예시

```js
function TodoApp() {
  const [items, setItems] = useState(["🍞", "🥛"]);
  const input = useRef(null);

  useEffect(() => {
    input.current.focus();
  }, []);

  return (
    <>
      <input ref={input} />
      <button onClick={() => setItems([...items, input.current.value])}>
        add
      </button>
      <ul>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </>
  );
}
```

---

## 동작 원리 (요약)

1. **JSX → `h()`**
   MiniJSX 파서가 브라우저에서 직접 JSX를 `h(type, props, ...children)` 호출로 변환.
2. **Fiber 트리 구성**
   MiniReact가 React Fiber 모델을 단순화해 **work-in-progress** 트리를 만들고
   `requestIdleCallback`(or `rAF`) 슬롯마다 `performUnitOfWork()` 처리.
3. **commit 단계**
   `PLACEMENT / UPDATE / DELETE` 태그를 따라 **DOM 패치 + effect 실행**.
4. **훅 상태**
   각 Fiber가 `memoizedState` 링크드 리스트를 보유,
   훅 호출 순서 = 리스트 순서라는 React 패턴을 그대로 사용.

---

## 제한 사항

- **동시성(Concurrent)∙Prioritization** 미구현 → 대량 랜더링 시 React보다 버벅일 수 있음
- **class component · 오류 경계(ErrorBoundary)** 부분적·제한적 지원
- **DevTools / StrictMode / 테스트** 생태계 부재
- 브라우저 전역(`MiniReact`,`MiniJSX`) 로 등록되는 **IIFE 번들** 방식
- JSX 문법을 사용하려면 필수적으로 JSX 라이브러리도 import 해야합니다.
- Pure JS에서는 외부 .jsx 파일을 로드할 수 없습니다. (CORS Error)

---

## 라이선스 & 크레딧

_Fluid_ 는 학습 및 데모 목적의 **MIT License** 오픈소스입니다.
Facebook **React** 팀의 공개 자료·공식 코드를 참조하여
최소 재현한 프로젝트이며, React 상표권과는 무관합니다.

> Pull Request / 이슈 환영!
> “왜 작동이 이렇지?” 싶은 부분이 있으면 자유롭게 제보해주세요.
