class FakeNode {}

class FakeTextNode extends FakeNode {
  constructor(text) {
    super();
    this.parentNode = null;
    this._text = String(text);
  }

  get textContent() {
    return this._text;
  }

  set textContent(value) {
    this._text = String(value);
  }
}

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }

  add(...tokens) {
    tokens.forEach((token) => token && this.values.add(token));
    this.owner._syncClassName();
  }

  remove(...tokens) {
    tokens.forEach((token) => this.values.delete(token));
    this.owner._syncClassName();
  }

  contains(token) {
    return this.values.has(token);
  }

  toggle(token, force) {
    if (force === true) {
      this.values.add(token);
      this.owner._syncClassName();
      return true;
    }
    if (force === false) {
      this.values.delete(token);
      this.owner._syncClassName();
      return false;
    }
    if (this.values.has(token)) {
      this.values.delete(token);
      this.owner._syncClassName();
      return false;
    }
    this.values.add(token);
    this.owner._syncClassName();
    return true;
  }

  setFromString(value) {
    this.values = new Set(String(value || '').split(/\s+/).filter(Boolean));
    this.owner._syncClassName();
  }
}

class FakeElement extends FakeNode {
  constructor(tagName, namespaceURI) {
    super();
    this.tagName = String(tagName).toUpperCase();
    this.namespaceURI = namespaceURI || null;
    this.childNodes = [];
    this.parentNode = null;
    this.ownerDocument = null;
    this.attributes = {};
    this.style = {};
    this.dataset = {};
    this.eventListeners = {};
    this.classList = new FakeClassList(this);
    this._className = '';
    this._id = '';
    this._innerHTML = '';
    this.clientWidth = 1024;
    this.clientHeight = 768;
    this.offsetWidth = 1024;
    this.offsetHeight = 768;
  }

  _syncClassName() {
    this._className = Array.from(this.classList.values).join(' ');
  }

  get className() {
    return this._className;
  }

  set className(value) {
    this.classList.setFromString(value);
  }

  get id() {
    return this._id;
  }

  set id(value) {
    this._id = String(value);
    this.attributes.id = this._id;
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.childNodes = [];
  }

  get textContent() {
    if (this.childNodes.length === 0) return '';
    return this.childNodes.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    this._innerHTML = '';
    this.childNodes = [new FakeTextNode(value)];
    this.childNodes[0].parentNode = this;
  }

  appendChild(child) {
    if (!child) return child;
    child.parentNode = this;
    if (child instanceof FakeElement) child.ownerDocument = this.ownerDocument;
    this.childNodes.push(child);
    this._innerHTML = '';
    return child;
  }

  removeChild(child) {
    this.childNodes = this.childNodes.filter((candidate) => candidate !== child);
    child.parentNode = null;
    return child;
  }

  setAttribute(name, value) {
    if (name === 'class') {
      this.className = value;
      return;
    }
    if (name === 'id') {
      this.id = value;
      return;
    }
    this.attributes[name] = String(value);
  }

  addEventListener(type, handler) {
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push(handler);
  }

  dispatchEvent(event) {
    var type = typeof event === 'string' ? event : event.type;
    (this.eventListeners[type] || []).forEach((handler) => handler({ target: this, type: type }));
  }

  click() {
    this.dispatchEvent('click');
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    var matches = [];
    walk(this, function (node) {
      if (node instanceof FakeElement && matchesSelector(node, selector)) matches.push(node);
    });
    return matches;
  }

  getBoundingClientRect() {
    return {
      width: this.clientWidth,
      height: this.clientHeight,
      top: 0,
      left: 0,
      right: this.clientWidth,
      bottom: this.clientHeight,
    };
  }
}

class FakeDocument {
  constructor() {
    this.body = this.createElement('body');
  }

  createElement(tagName) {
    var element = new FakeElement(tagName);
    element.ownerDocument = this;
    return element;
  }

  createElementNS(namespaceURI, tagName) {
    var element = new FakeElement(tagName, namespaceURI);
    element.ownerDocument = this;
    return element;
  }

  createTextNode(text) {
    return new FakeTextNode(text);
  }

  getElementById(id) {
    return this.body.querySelector('#' + id);
  }

  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }
}

function walk(node, visit) {
  node.childNodes.forEach(function (child) {
    visit(child);
    if (child instanceof FakeElement) walk(child, visit);
  });
}

function matchesSelector(node, selector) {
  var dataMatch = selector.match(/^\[data-([a-z0-9-]+)=\"([^\"]+)\"\]$/i);
  if (dataMatch) {
    return node.dataset[toCamel(dataMatch[1])] === dataMatch[2];
  }
  if (selector.charAt(0) === '.') return node.classList.contains(selector.slice(1));
  if (selector.charAt(0) === '#') return node.id === selector.slice(1);
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, function (_, letter) {
    return letter.toUpperCase();
  });
}

function createDom() {
  var document = new FakeDocument();
  return { document: document, window: { document: document }, Node: FakeNode };
}

module.exports = { createDom, FakeElement, FakeNode };
