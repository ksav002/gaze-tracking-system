export function getViewportSize() {
  const root = document.documentElement;

  return {
    w: root.clientWidth || window.innerWidth,
    h: root.clientHeight || window.innerHeight,
  };
}
