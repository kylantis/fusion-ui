
class K_TrieNode {
  constructor(parent, value) {
    this.c = {};
    this.p = parent;
    this.v = value;
  }

  getChildren() {
    return this.c;
  }

  getParent() {
    return this.p;
  }

  getValue() {
    return this.v;
  }
}

class K_Trie {
  constructor(splitter, nodeCache) {
    this.n = nodeCache;
    this.s = splitter;
    this.r = new K_TrieNode();
  }

  getRoot() {
    return this.r;
  }

  getSplitter() {
    return this.s;
  }

  getNodeCache() {
    return this.n;
  }

  insert(word, segments) {
    let node = this.getNodeCache()[word];

    if (node) {
      return node;
    }

    node = this.getRoot();

    if (!word) return node;

    if (!segments) {
      segments = this.getSplitter()(word);
    }

    for (const segment of segments) {
      if (!node.getChildren()[segment]) {
        node.getChildren()[segment] = new K_TrieNode(node, segment);
      }
      node = node.getChildren()[segment];
    }

    this.getNodeCache()[word] = node;

    return node;
  }

  getReverseWord(node) {
    const arr = [];
    let n = node;

    while (n.getValue()) {
      arr.unshift(n.getValue());
      n = n.getParent();
    }

    return arr.join('');
  }

  getNode(word) {
    let node = this.getNodeCache()[word];

    if (node) {
      return node;
    }

    node = this.getRoot();

    if (!word) return node;

    for (const segment of this.getSplitter()(word)) {
      if (!node.getChildren()[segment]) {
        return null;
      }
      node = node.getChildren()[segment];
    }

    return node;
  }

  getLeafs(node, predicate) {
    const arr = [];

    for (const childNode of Object.values(node.getChildren())) {
      if (!predicate || (typeof predicate == "function" && predicate(childNode))) {

        if (childNode.getValue() != '.') {
          arr.push(childNode);
        }
      }

      arr.push(...this.getLeafs(childNode, predicate));
    }

    return arr;
  }
}

module.exports = K_Trie;