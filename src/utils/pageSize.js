export function getPageSize() {
  const el = document.documentElement;
  const body = document.body;

  const width = Math.max(
    el.scrollWidth, el.offsetWidth, el.clientWidth,
    body ? body.scrollWidth : 0,
    body ? body.offsetWidth : 0
  );

  const height = Math.max(
    el.scrollHeight, el.offsetHeight, el.clientHeight,
    body ? body.scrollHeight : 0,
    body ? body.offsetHeight : 0
  );

  return { width, height };
}