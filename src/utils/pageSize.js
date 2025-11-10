const getPageSize = ()=>{
  const el = document.documentElement;
  const b = document.body || {};
  const w = Math.max(el.scrollWidth, el.offsetWidth, el.clientWidth, b.scrollWidth || 0, b.offsetWidth || 0);
  const h = Math.max(el.scrollHeight, el.offsetHeight, el.clientHeight, b.scrollHeight || 0, b.offsetHeight || 0);
  return { width: w, height: h };
}

export default getPageSize