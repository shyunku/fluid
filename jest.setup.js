// 이 파일은 모든 테스트 스위트가 실행되기 전에 한 번 실행됩니다.

// 모든 console.log 호출을 무시하도록 설정합니다.
jest.spyOn(console, "log").mockImplementation(() => {});
// console.error, console.warn 등 다른 로그도 막고 싶다면 아래와 같이 추가할 수 있습니다.
// jest.spyOn(console, 'error').mockImplementation(() => {});
// jest.spyOn(console, 'warn').mockImplementation(() => {});
