import { h } from "./h.js";
import { createContext, useState, useEffect, useContext } from "./hooks.js";
import { debug } from "./logger.js";

const RouterContext = createContext(null);

/**
 * Router 컴포넌트: 라우팅 컨텍스트를 제공하고 URL 변경을 감지합니다. (Hash-based)
 */
export function Router({ children }) {
  const [path, setPath] = useState(
    window.location.hash ? window.location.hash.substring(1) : "/"
  );

  const navigate = (to) => {
    debug("ROUTER")("Navigating to hash:", to);
    window.location.hash = to;
  };

  useEffect(() => {
    const handleHashChange = () => {
      const newPath = window.location.hash
        ? window.location.hash.substring(1)
        : "/";
      debug("ROUTER")("hashchange event triggered. New path:", newPath);
      setPath(newPath);
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return h(RouterContext.Provider, { value: { path, navigate } }, ...children);
}

/**
 * Route 컴포넌트: 현재 경로와 일치할 때만 자식 컴포넌트를 렌더링합니다.
 */
export function Route({ path, component }) {
  const { path: currentPath } = useContext(RouterContext);

  // TODO: 동적 라우트, 중첩 라우트 지원
  if (currentPath === path) {
    return h(component, {});
  }

  return null;
}

/**
 * Link 컴포넌트: 페이지 새로고침 없이 URL을 변경합니다.
 */
export function Link({ to, children }) {
  const { navigate } = useContext(RouterContext);

  const handleClick = (e) => {
    e.preventDefault();
    navigate(to);
  };

  return h("a", { href: `#${to}`, onClick: handleClick }, ...children);
}

/**
 * useNavigate 훅: 프로그래매틱하게 URL을 변경하는 함수를 반환합니다.
 */
export function useNavigate() {
  const { navigate } = useContext(RouterContext);
  return navigate;
}

/**
 * useLocation 훅: 현재 경로 정보를 반환합니다.
 */
export function useLocation() {
  const { path } = useContext(RouterContext);
  return { pathname: path };
}
