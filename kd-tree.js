//_____________________________________________________________________________
// Bounded priority queue class  --  used in k-NN search
function BPQ(capacity) {
  this.capacity = capacity;
  this.elements = [];
}

BPQ.prototype.isFull = function() { 
  return this.elements.length === this.capacity; 
};

BPQ.prototype.isEmpty = function() { 
  return this.elements.length === 0; 
};

BPQ.prototype.maxPriority = function() {
  return this.elements[this.elements.length - 1].priority;
};

Object.defineProperty(BPQ.prototype, "values", {
  get: function() { return this.elements.map(function(d) { return d.value; }); }
});

// TODO: make more efficient?
BPQ.prototype.add = function(value, priority) {
  var q = this.elements,
      d = { value: value, priority: priority };
  if (this.isEmpty()) { q.push(d); } 
  else {
    for (var i = 0; i < q.length; i++) {
      if (priority < q[i].priority) {
        q.splice(i, 0, d);
        break;
      }
      else if ( (i == q.length-1) && !this.isFull() ) {
        q.push(d);
      }
    }
  }
  this.elements = q.slice(0, this.capacity);
};

//______________________________________________________________________________
// Node class  --  defines each node in the k-d tree

function Node(location, axis, subnodes, datum) {
  this.location = location;
  this.axis = axis;
  this.subnodes = subnodes;  // = children nodes = [left child, right child]
  this.datum = datum;
};

Node.prototype.toArray = function() {
  var array = [
    this.location, 
    this.subnodes[0] ? this.subnodes[0].toArray() : null, 
    this.subnodes[0] ? this.subnodes[1].toArray() : null
  ];
  array.axis = this.axis;
  return array;
};

Node.prototype.flatten = function() {
  var left = this.subnodes[0] ? this.subnodes[0].flatten() : null,
      right = this.subnodes[1] ? this.subnodes[1].flatten() : null;
  return left && right ? [this].concat(left, right) :
        left ? [this].concat(left) :
        right ? [this].concat(right) :
        [this];
};

// k-NN search
Node.prototype.find = function(target, k) {
  k = k || 1;
  
  var queue = new BPQ(k),
      scannedNodes = [];
  
  search(this);
  
  return {
  nearestNodes: queue.values,
  scannedNodes: scannedNodes,
  maxDistance: queue.maxPriority()
  };
  
  // 1-NN algorithm outlined here:
  // http://web.stanford.edu/class/cs106l/handouts/assignment-3-kdtree.pdf
  function search(node) {
    if (node === null) return;
    
    scannedNodes.push(node);
    
    // Add current point to BPQ
    queue.add(node, distance(node.location, target));
    
    // Recursively search the half of the tree that contains the test point
    if (target[node.axis] < node.location[node.axis]) {
      // Check left
      search(node.subnodes[0]);
      var otherNode = node.subnodes[1];
    }
    else {
      // Check right
      search(node.subnodes[1]);
      var otherNode = node.subnodes[0];
    }
    
    // If candidate hypersphere crosses this splitting plane, look on the
    // other side of the plane by examining the other subtree
    var delta = Math.abs(node.location[node.axis] - target[node.axis]);
    if (!queue.isFull() || delta < queue.maxPriority()) {
      search(otherNode);
    }
  }
};

// Only works for 2D
Node.prototype.lines = function(extent) {
  var x0 = extent[0][0], 
      y0 = extent[0][1],
      x1 = extent[1][0], 
      y1 = extent[1][1],
      x = this.location[0],
      y = this.location[1];
    
  if (this.axis == 0) {
    var line = [[x, y0], [x, y1]];
    var left = this.subnodes[0] ?
      this.subnodes[0].lines([[x0, y0], [x, y1]]) : null;
    var right = this.subnodes[1] ?
      this.subnodes[1].lines([[x, y0], [x1, y1]]) : null;
  } 
  else if (this.axis == 1) {
    var line = [[x0, y], [x1, y]];
    var left = this.subnodes[0] ?
      this.subnodes[0].lines([[x0, y0], [x1, y]]) : null;
    var right = this.subnodes[1] ?
      this.subnodes[1].lines([[x0, y], [x1, y1]]) : null;
  }
  
  return left && right ? [line].concat(left, right) :
        left ? [line].concat(left) :
        right ? [line].concat(right) :
        [line];
}


//______________________________________________________________________________
// k-d tree generator

function KDTree() {
  var x = function(d) { return d[0]; },
      y = function(d) { return d[1]; };
  
  function tree(data) {
    var points = data.map(function(d) { 
      var point = [x(d), y(d)];
      point.datum = d;
      return point; 
    });
    
    return treeify(points, 0);
  }
  
  tree.x = function(_) {
    if (!arguments.length) return x;
    x = _;
    return tree;
  };
  
  tree.y = function(_) {
    if (!arguments.length) return y;
    y = _;
    return tree;
  };
  
  return tree;
  
  // Adapted from https://en.wikipedia.org/wiki/K-d_tree
  function treeify(points, depth) {
      try { var k = points[0].length; }
      catch (e) { return null; }
      
      // Select axis based on depth so that axis cycles through all valid values
      var axis = depth % k;
      
      // TODO: To speed up, consider splitting points based on approximation of
      //       median; take median of random sample of points (perhaps of 1/10th 
      //       of the points)
      
      // Sort point list and choose median as pivot element
      points.sort(function(a, b) { return a[axis] - b[axis]; });
      i_median = Math.floor(points.length / 2);
      
      // Create node and construct subtrees
      var point = points[i_median],
          left_points = points.slice(0, i_median),
          right_points = points.slice(i_median + 1);
          
      return new Node(
        point,
        axis,
        [treeify(left_points, depth + 1), treeify(right_points, depth + 1)],
        point.datum
      );
    }
}


//______________________________________________________________________________
// Helper functions

function min(array, accessor) {
  return array
    .map(function(d) { return accessor(d); })
    .reduce(function(a, b) { return a < b ? a : b; });
}

function max(array, accessor) {
  return array
    .map(function(d) { return accessor(d); })
    .reduce(function(a, b) { return a > b ? a : b; });
}

function get(key) { return function(d) { return d[key]; }; }

// TODO: Make distance function work for k-dimensions

// Euclidean distance between two 2D points
function distance(p0, p1) {
  return Math.sqrt(Math.pow(p1[0] - p0[0], 2) + Math.pow(p1[1] - p0[1], 2));
}