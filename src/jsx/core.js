import { transformJsx } from "./transformer.js";

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('script[type="text/jsx"]').forEach((script) => {
    const transformSource = (source) => {
      const transformed = transformJsx(source, true);
      const finalSrc = transformed;

      const blob = new Blob([finalSrc], { type: "text/javascript" });
      const tag = document.createElement("script");
      tag.src = URL.createObjectURL(blob);
      document.head.appendChild(tag);
    };
    // 스크립트를 일반 script 태그로 먼저 로드
    const loadScript = async () => {
      const source = await (await fetch(script.src)).text();
      transformSource(source);
    };

    if (script.src) {
      if (window.location.protocol === "file:") {
        console.warn(
          `File transformation is blocked because current location is on file system. Use inline source instead. Target:`,
          script.src
        );
      } else {
        loadScript();
      }
    } else {
      const source = script.textContent;
      // 인라인 스크립트 처리 로직...
      transformSource(source);
    }
  });
});
