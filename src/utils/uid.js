const uid = () => (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

export default uid