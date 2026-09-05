export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === false || value === null || value === undefined) {
      // skip
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function on(node, event, handler, opts) {
  node.addEventListener(event, handler, opts);
}

export function clear(node) {
  node.replaceChildren();
}

export function fmt(n, decimals = 1) {
  return n.toLocaleString('es', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
