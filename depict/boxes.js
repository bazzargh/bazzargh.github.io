'use strict';

// given a state with a focus and depth, get the subset of the state
// that is visible, ie all boxes must have the focus as an ancestor
// and all connections must be between boxes that are visible.
function filterVisible(state) {
  var result = {
    focus: state.focus,
    depth: state.depth,
    strokes: state.strokes,
    nodes: {}
  }
  filterVisibleTree(state, result, state.focus, state.depth);
  for (var [from, node] of Object.entries(result.nodes)) {
    for (var [to, connection] of Object.entries(state.nodes[from].connections)) {
      if (Object.hasOwn(result.nodes, to)) {
        node.connections[to] = connection;
      }
    }
  }
  return result;
}

// Recursively collect visible nodes.
function filterVisibleTree(state, result, focus, depth) {
  result.nodes[focus] = structClone(state.nodes[focus]);
  result.nodes[focus].connections = {};
  if (depth <= 0) {
    result.nodes[focus].children = [];
    result.nodes[focus].title = "";
  } else {
    for (var name of state.nodes[focus].children) {
      if (!Object.hasOwn(result.nodes, name)) {
        filterVisibleTree(state, result, name, depth - 1);
      }
    }
  }
}

// animates changing values, eg positions
function animateNumber(before, after, fraction) {
  return before + fraction * (after - before);
}

// animates changing connections (arrows, lines)
// new arrows fade in, old arrows fade out, existing arrows move.
// other attributes, like stroke colour, change immediately
function animateConnection(before, after, fraction) {
  var result;
  if (before) {
    if (after) {
      result = structClone(after);
      result.opacity = 1;
    } else {
      result = structClone(before);
      result.opacity = 1 - fraction;
    }
  } else {
    result = structClone(after);
    result.opacity = fraction;
  }
  return result;
}

function structClone(state) {
  return JSON.parse(JSON.stringify(state));
}
// animates changing nodes (boxes, icons)
// new nodes fade in, old nodes fade out, existing nodes move.
// other attributes, like stroke colour, change immediately
function animateNode(before, after, fraction) {
  var result;
  if (before) {
    if (after) {
      result = structClone(after);
      for (var [k, v] of Object.entries(before)) {
        if (Object.hasOwn(after, k) && Number.isFinite(v) && Number.isFinite(after[k])) {
          result[k] = animateNumber(v, after[k], fraction);
        }
      }
      result.opacity = 1;
    } else {
      result = structClone(before);
      result.opacity = 1 - fraction;
    }
  } else {
    result = structClone(after);
    result.opacity = fraction;
  }
  return result;
}

// animate one scene graph (nodes and arrows) to another.
// assumes all the nodes and arrows in the scenes are visible.
function animate(before, after, fraction) {
  before = structClone(before);
  after = structClone(after);
  var result = {
    focus: after.focus,
    strokes: after.strokes,
    nodes: {}
  };
  for (var [name, node] of Object.entries(before.nodes)) {
    var afterNode = after.nodes[name];
    var bc = node.connections;
    var ac = after.nodes[name]?.connections || {};
    var rn = animateNode(node, afterNode, fraction);
    result.nodes[name] = rn;
    var rc = {};
    rn.connections = rc;
    for (var [other, connection] of Object.entries(bc)) {
      rc[other] = animateConnection(connection, ac[other], fraction);
    }
    for (var [other, connection] of Object.entries(ac)) {
      if (!Object.hasOwn(bc, other)) {
        rc[other] = animateConnection(null, connection, fraction);
      }
    }
  }
  for (var [name, node] of Object.entries(after.nodes)) {
    if (!Object.hasOwn(before.nodes, name)) {
      rn = animateNode(null, node, fraction);
      result.nodes[name] = rn;
      rc = {};
      rn.connections = rc;
      for (var [other, connection] of Object.entries(node.connections)) {
        rc[other] = animateConnection(null, connection, fraction);
      }
    }
  }
  return result;
}


// finds the intersection between a circular arc and a box.
function intersection(cx, cy, r, x1, y1, x2, y2, x3, y3) {
  var points = [
    [false, x1, y1, y2],
    [false, x2, y1, y2],
    [true, y1, x1, x2],
    [true, y2, x1, x2],
  ];
  // fallback: the centre of the rectangle.
  // x3 y3 is the centre of the _other_ rectangle
  var z = [(x1+x2)/2, (y1+y2)/2];
  // best is thus the square of the length of the line between
  // the two circle centres; the connector should be shorter
  // than this. (this is a bug, for large curvature we will
  // end up with the fallback). Really r and the centre should
  // be determined from the two boxes
  var best = (z[0] - x3)**2 + (z[1] - y3)**2;
  for(var point of points) {
    // the circle can intersect each of 4 edges, and if
    // it does intersect, must lie between 2 bounds.
    var [swap, p, e1, e2] = point;
    var [ca, cb, ta, tb] = swap ? [cy, cx, y3, x3] : [cx, cy, x3, y3];
    // for the current edge (p) find the other half of the
    // coordinate where the circle intersects
    var d2 = r*r-(p-ca)**2;
    // the circle may not intersect the edge at all
    if (d2 >= 0) {
      var d = Math.sqrt(d2);
      // if it does, it may intersect in two places
      for (var d1 of [-d, d]) {
        var u = [p, cb + d1];
        // compare to the bounds from 'point'
        if (e1 <= u[1] && u[1] <= e2) {
          // if inside the bounds, we have an intersection.
          // is it closer than the box center to the target?
          var dz = (u[0] - ta)**2 + (u[1] - tb)**2;
          if (dz < best) {
            best = dz;
            // remember to unswap the coordinates.
            z = swap ? [u[1], u[0]] : u;
          }
        }
      }
    }
  }
  return z;
}

// keep arrows simple. curves are better than straight
// because they can't get confused with edges.
function drawConnection(from, to, connection) {
  if (!from || !to) {
    return "";
  }
  var r = 250;
  var r2 = r*r;
  // centre of 'from'
  var [x1, y1] = [from.x + from.width/2, from.y + from.height/2];
  // centre of 'to'
  var [x2, y2] = [to.x + to.width/2, to.y + to.height/2];
  // half distance between centres
  var [x1p, y1p] = [(x1 - x2)/2, (y1 - y2)/2];
  var r1p2 = y1p**2 + x1p**2;
  r2 = 4 * r1p2;
  r = Math.sqrt(r2);
  var m = -Math.sqrt((r2 - r1p2)/r1p2);
  // advances 'r' away from the midpoint of the joining line, at right
  // angles to that line; ie to the circumcentre. An interesting choice
  // is just to pick 'm', and calculate 'r'. eg if m = -1, r=sqrt(2*r1).
  // r > r1 should improve intersections.
  var [cx, cy] = [m * y1p + (x1 + x2)/2, -m * x1p + (y1 + y2)/2];
  var z1 = intersection(cx, cy, r, from.x, from.y, from.x + from.width,  from.y + from.height, x2, y2);
  var z2 = intersection(cx, cy, r, to.x, to.y, to.x + to.width,  to.y + to.height, x1, y1);
  if (!z1 || !z2) {
    return "";
  }
  var attrs = {
    d: `M ${z1[0]} ${z1[1]} A ${r} ${r} 0 0 0 ${z2[0]} ${z2[1]}`,
    stroke: connection.stroke,
    opacity: connection.opacity * 0.7,
    "stroke-width": 2,
    "fill-opacity": 0,
    "marker-end": (connection.style == "line" ? "" : `url(#head-${connection.strokeIndex})`)
  };
  if (connection.strokeIndex > 0) {
    // accessibility: don't just rely on colour
    attrs["stroke-dasharray"] = `${connection.strokeIndex * 5} 5`
  }
  if (connection.label) {
    var v = 0.09;
    var labelxy = [(1 + v)*(z2[0]+z1[0])/2 - v*cx, (1 + v)*(z2[1]+z1[1])/2 - v*cy];
    var labelwh = Math.sqrt((z2[0]-z1[0])**2 + (z2[1]-z1[1])**2);
    var g = createSVGElement("g", {});
    var filtered = createSVGElement("g", {
      filter: "url(#glow)"
    });
    var fo = createSVGElement("foreignObject", {
      x: labelxy[0] - labelwh/2,
      y: labelxy[1] - labelwh/2,
      width: labelwh,
      height: labelwh
    });
    var body = createElement("body", {
      margin: 0,
      style: `display: flex; justify-content: center; align-items: center; font-size: ${svgholder.clientWidth/60}px;`
    });
    var center = createElement("center", {});
    g.append(filtered);
    filtered.append(fo);
    g.append(createSVGElement("path", attrs));
    fo.append(body);
    body.append(center);
    center.append(connection.label);
    return g;
  } else {
    return createSVGElement("path", attrs);
  }
}

function chain(elt, ...children) {
  elt.append(...children);
  return {
    append: chain,
    elt: elt
  }
}

function append(elt, ...children) {
  elt.append(...children);
  return elt;
}

function drawNode(node) {
  var g = createSVGElement("g", {opacity: node.opacity});

  var fo = createSVGElement("foreignObject", {
    opacity: node.title_opacity,
    x: node.title_x,
    y: node.title_y,
    width: node.title_width,
    height: node.title_height
  });
  var body = createElement("body", {
    margin: 0
  });
  var center = createElement("center", {
    style: `font-size: ${Math.min(node.title_width/8, node.title_height/2)}px`
  });
  fo.append(body);
  body.append(center);
  center.append(node.title);
  var image = createSVGElement("image", {
    opacity: node.icon_opacity,
    href: node.icon,
    x: node.icon_x,
    y: node.icon_y,
    width: node.icon_width
  });
  //image.append(createSVGElement("title")
  g.append(
    fo,
    image,
    createSVGElement("rect", {
      opacity: node.box_opacity,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      stroke: node.stroke,
      "stroke-width": 2,
      rx: Math.min(node.width, node.height)/40,
      "fill-opacity": 0
    }),
    createSVGElement("line", {
      opacity: node.left_opacity,
      x1: node.x,
      y1: node.y,
      x2: node.x,
      y2: node.y + node.height,
      stroke: node.stroke,
      "stroke-dasharray": "2 2"
    }),
    createSVGElement("line", {
      opacity: node.top_opacity,
      x1: node.x,
      y1: node.y,
      x2: node.x + node.width,
      y2: node.y,
      stroke: node.stroke,
      "stroke-dasharray": "2 2"
    }),
  );
  return g;
}

function layout(state) {
  layoutNode(state, state.focus, 0, 0, svgholder.clientWidth, svgholder.clientHeight);
}

function layoutNode(state, name, x, y, w, h, layout) {
  var node = state.nodes[name];
  if (node) {
    // todo: arrow target, padding
    node.x = x;
    node.y = y;
    node.width = w;
    node.height = h;
    node.top_opacity = layout == "column" ? 1 : 0;
    node.left_opacity = layout == "row" ? 1 : 0;
    node.box_opacity = 1 ^ (node.top_opacity | node.left_opacity);
    node.icon_opacity = node.icon ? 1 : 0;
    node.title_opacity = node.title ? 1 : 0;
    if (node.children.length == 0 && node.box_opacity) {
      node.icon_width = Math.min(w, h)/2;
      node.icon_x = x + w/2 - node.icon_width/2;
      node.icon_y = y;
      node.title_x = x;
      node.title_y = y + node.icon_width;
      node.title_width = w;
      node.title_height = node.icon_width;
      if (!node.icon) {
        // set to empty icon to get fade to work
        node.title_y = y + h/2 - node.title_height/2;
      } else {
        node.x = node.icon_x;
        node.y = node.icon_y;
        node.width = node.icon_width;
        node.height = node.icon_width;
      }
      if (!node.title) {
        node.icon_y = y + h/2 - node.icon_width/2;
        node.y = node.icon_y;
      }
    } else {
      node.icon_width = Math.min(w, h)/8;
      node.icon_x = x;
      node.icon_y = y;
      node.title_x = x + node.icon_width;
      node.title_y = y;
      node.title_width = w - 2 * node.icon_width;
      node.title_height = node.icon_width;
      var margin = 2;
      var [cx, cy, cw, ch] = [x + margin, y + margin, w - 2 * margin, h - 2 * margin]
      if (node.title || node.icon) {
        cy = node.y + margin + node.icon_width;
        ch = node.height - 2 * margin - node.icon_width;
      }
      switch(node.layout) {
        case "column":
          columnLayout(state, node, cx, cy, cw, ch);
          break;
        case "row":
          rowLayout(state, node, cx, cy, cw, ch);
          break;
        case "ring":
          ringLayout(state, node, cx, cy, cw, ch);
          break;
        default:
          zigzagLayout(state, node, cx, cy, cw, ch);
          break;
        }
    }
    node.icon = lookup_icon(node.icon)
  }
}

// a single column
function columnLayout(state, node, x, y, w, h) {
  var list = node.children;
  var ih = h/list.length;
  for (var i = 0; i < list.length; i++) {
    layoutNode(state, list[i], x, y + i * ih, w, ih, "column");
  }
}

// a single row
function rowLayout(state, node, x, y, w, h) {
  var list = node.children;
  var iw = w/list.length;
  for (var i = 0; i < list.length; i++) {
    layoutNode(state, list[i], x + i * iw, y, iw, h, "row");
  }
}

// arrange the nodes in a ring
function ringLayout(state, node, x, y, w, h) {
  var list = node.children;
  var a, r, iw, ih;
  if (list.length == 1) {
    layoutNode(state, list[0], x, y, w, h);
    return;
  }
  var a = 2 * Math.PI / list.length;
  var ratio = 2 * Math.sin(a / 2);
  const aspect = 4 / 3;
  if (w > h) {
    r = h / (1 + ratio);
    ih = r * ratio / 2;
    iw = aspect * ih;
  } else {
    r = w / (1 + ratio);
    iw = r * ratio / 2;
    ih = iw / aspect;
  }
  for (var i = 0; i < list.length; i++) {
    const angle = 2 * Math.PI - (i + 1) * a;
    const ix = x + w / 2 + (w - iw) * Math.cos(angle) / 2 - iw / 2;
    const iy = y + h / 2 - (h - ih) * Math.sin(angle) / 2 - ih / 2;
    layoutNode(state, list[i], ix, iy, iw, ih, "ring");
  }
}

// ltr-rtl alternating to fit a region.
function zigzagLayout(state, node, x, y, w, h) {
  var list = node.children;
  var best = 0
  var bn, bm, bw, bh, iw, ih;
  for (var n = 1; n <= list.length; n++) {
    var m = Math.ceil(list.length/n);
    ih = Math.min(3/4 * w/n, h/m);
    iw = Math.min(w/n, 4/3 * h/m);
    var area = iw * ih * n * m;
    if (area < best) {
      break;
    }
    [best, bn, bm, bw, bh] = [area, n, m, iw, ih];
  }
  [m, n, iw, ih] = [bm, bn, 0.9 * bw, 0.9 * bh];
  var vm = (h - m * ih) / (m + 1);
  for (var i = 0; i < list.length; i++) {
    var r = Math.floor(i * m / list.length);
    var c = i - Math.ceil(r * list.length / m);
    var nc = Math.ceil((r + 1) * list.length / m) - Math.ceil(r * list.length / m);
    var hm = (w - nc * iw) / (nc + 1);
    var offset;
    if (r % 2) {
      offset = w - (c + 1) * hm - (c + 1) * iw;
    } else {
      offset = (c + 1) * hm + c * iw;
    }
    layoutNode(state, list[i],
      x + offset,
      y + (r + 1) * vm + r * ih,
      iw, ih, "zigzag");
  }
}

function createNode(state, node, ...styles) {
  if (!node || node == "top") {
   return;
  }
  Object.keys(state.nodes).forEach(function(key) {
    var pos = state.nodes[key].children.indexOf(node);
    if ( pos >= 0) {
      state.nodes[key].children.splice(pos, 1);
    }
  });
  if (!state.nodes[node]) {
    state.nodes[node] = {
      title: node.replace(/.*?:/, "").replaceAll("_", " "),
      icon: node.replace(/.*?:/, "").replaceAll("_", ""),
      children: [],
      connections: [],
      style: "box",
      stroke: "black"
    };
  }
  state.nodes[state.editing].children.push(node);
  updateNode(state, node, ...styles);
}

function updateNode(state, node, ...styles) {
  var props = state.nodes[node];
  if (props === null || styles.length == 0) {
    return;
  }
  var s = styles.reduce(function(p, c, i, a) {
    if (i%2==1) {
      p[a[i-1]] = c;
    };
    return p
  }, {});
  Object.assign(props, s);
}

// The command interpreter: the operations here are very simple,
// adding and removing shapes but not laying them out
function interpret(state, cmd) {
  var token = cmd.match(/([a-zA-Z0-9:_.-]+|"(\\.|[^"])*"|#|\*|```|[^\w\s\{])/g);
  if (!token) {
    return;
  }
  if (state.in_code_block) {
    state.markup.push(cmd);
    if (token[0] === '```') {
      state.in_code_block = false;
    }
    return;
  }
  var decoded = token.map(function(s) {
    if (s === null) {
      return s;
    } if (s.startsWith('"')) {
      return JSON.parse(s);
    } else if (s && s.startsWith('{')) {
      return JSON.parse(s);
    } else {
      return s;
    }
  });
  switch(token[0]) {
    case "delete":
      state.drawingOpacity = 1;
      if (decoded[1]) {
        removeNode(state, decoded[1]);
      }
      break;
    case "edit":
      state.drawingOpacity = 1;
      if (decoded[1]) {
        if (!state.nodes[decoded[1]]) {
          createNode(state, ...decoded.slice(1));
        }
        state.editing = decoded[1];
        updateNode(state, ...decoded.slice(1));
      }
      break;
    case "zoom":
      state.drawingOpacity = 1;
      if (decoded[1]) {
        if (!state.nodes[decoded[1]]) {
          createNode(state, ...decoded.slice(1));
        }
        zoomNode(state, ...decoded.slice(1));
      }
      break;
    case "add":
      state.drawingOpacity = 1;
      if (decoded[1]) {
        createNode(state, ...decoded.slice(1));
      }
      break;
    case "line":
      state.drawingOpacity = 1;
      if (!state.nodes[decoded[1]]) {
        createNode(state, ...decoded.slice(1));  
      }
      if (!state.nodes[decoded[2]]) {
        createNode(state, ...decoded.slice(2));  
      }
      connectNode(state, ...decoded);
      break;
    case "arrow":
      state.drawingOpacity = 1;
      if (!state.nodes[decoded[1]]) {
        createNode(state, ...decoded.slice(1));  
      }
      if (!state.nodes[decoded[2]]) {
        createNode(state, ...decoded.slice(2));  
      }
      connectNode(state, ...decoded);
      break;
    case "disconnect":
      state.drawingOpacity = 1;
      disconnectNode(state, decoded[1], decoded[2]);
      break;
    case "up":
      state.drawingOpacity = 1;
      zoomNode(state, parentNode(state, state.focus));
      break;
    case "slide":
      state.drawingOpacity = 0;
      break;
    case "drawing":
      state.drawingOpacity = 1;
      break;
    case "#":
      state.drawingOpacity = 0;
      state.markup = [cmd];
      break;
    case "*":
      state.drawingOpacity = 0;
      state.markup.push(cmd);
      break;
    case "```":
      state.drawingOpacity = 0;
      state.markup.push(cmd);
      state.in_code_block = true;
      break;
  }
}

function removeNode(state, node) {
  if (!node || node == "top") {
    return;
  }
  // remove this node from its parent
  // I don't remove the actual node or any connections
  // because this works better when you resurrect it
  Object.keys(state.nodes).forEach(function(key) {
    var pos = state.nodes[key].children.indexOf(node);
    if ( pos >= 0) {
      state.nodes[key].children.splice(pos, 1);
    }
  });
}

function parentNode(state, node) {
  var parent = Object.keys(state.nodes).find(key => state.nodes[key].children.indexOf(node) >= 0);
  return parent ? parent : "top";
}

function connectNode(state, connection, from, to, ...styles) {
  if (!connection || !from || !to) {
    return;
  }
  var conn = {
    "style": connection,
    "stroke": "black",
    "strokeIndex": 0
  };
  if (styles && styles.length == 1) {
    conn.stroke = styles[0]
  }
  if (styles && styles.length > 1) {
    var s = styles.reduce(function(p, c, i, a) {
      if (i%2==1) {
        p[a[i-1]] = c;
      };
      return p
    }, {});
    Object.assign(conn, s);
  }
  if (!Object.hasOwn(state, "strokes")) {
    state.strokes = ["black"];
  }
  var strokeIndex = state.strokes.indexOf(conn.stroke);
  if (strokeIndex < 0) {
    state.strokes.push(conn.stroke);
    conn.strokeIndex = state.strokes.indexOf(conn.stroke);
  }
  state.nodes[from].connections[to] = conn;
}

function zoomNode(state,  node, ...styles) {
  var target = state.nodes[node];
  if (target) {
    state.focus = node;
    state.editing = node;
    updateNode(state, node, ...styles)
  }
}

function createElement(name, attrs) {
  var elt = document.createElementNS('http://www.w3.org/1999/xhtml', name);
  for (var [key, value] of Object.entries(attrs)) {
    elt.setAttribute(key, `${value}`);
  }
  return elt;
}

function createSVGElement(name, attrs) {
  var elt = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (var [key, value] of Object.entries(attrs)) {
    elt.setAttribute(key, `${value}`);
  }
  return elt;
}

function disconnectNode(state, from, to) {
  delete state.nodes[from].connections[to];
  delete state.nodes[to].connections[from];
}

let start = null;
let timeout = null;
let animation = null;
var beforeState = null;
var beforePositions = null;
var afterState = null;
var afterPositions = null;
var previousTimeStamp = null;

function step(timestamp) {
  if (start === undefined) {
    start = timestamp;
  }

  const elapsed = timestamp - start;
   // Stop the animation after 500ms
  var fraction = Math.min(elapsed / 500, 1);
  if (previousTimeStamp !== timestamp) {
    var opacity = animateNumber(beforeState.drawingOpacity, afterState.drawingOpacity, fraction);
    slide.style.opacity = 1 - opacity;
    svgholder.style.opacity = opacity;

    var positions = animate(beforePositions, afterPositions, fraction);
    var fragment = new DocumentFragment();
    var g = createSVGElement("g", {id: "drawing"});
    fragment.append(g);
    var defs = createSVGElement("defs", {});
    positions.strokes.forEach((stroke, strokeIndex) => {
      var marker = createSVGElement("marker", {
        "id": `head-${strokeIndex}`,
        "markerWidth": 5,
        "markerHeight": 7,
        "refX": 5,
        "refY": 2.5,
        "orient": "auto"
        });
      var path = createSVGElement("path", {
        "d": "M 0 0 L 5 2.5 L 0 5 z",
        "fill": stroke
      });
      marker.append(path);
      defs.append(marker);
    });
    g.append(defs);
    for (var [name, node] of Object.entries(positions.nodes)) {
      g.append(drawNode(node));
    }
    for (var [name, from] of Object.entries(positions.nodes)) {
      for (var [to, connection] of Object.entries(from.connections)) {
        g.append(drawConnection(from, positions.nodes[to], connection));
      }
    }
    document.getElementById("drawing").replaceWith(fragment);
  }

  if (fraction < 1) {
    previousTimeStamp = timestamp
    window.requestAnimationFrame(step);
  } else {
    beforeState = afterState;
    beforePositions = afterPositions;
  }
}

function initialState() {
  var bare = {
    strokes: ["black"],
    nodes: {
      top: {
        connections: {},
        children: []
      }
    },
    depth: 4,
    focus: "top",
    editing: "top",
    drawingOpacity: 0
  }
  return bare;
}

// handle the initial setting of the page before we set up the event listener.
var q = new URLSearchParams(window.location.search)
if (q.get("q")) {
  document.getElementById('commands').value = q.get("q");
}

// Handle input. Debounce, when typing stops, calculate state
// at current line, calculate new layout, then animate from current.
document.addEventListener("selectionchange", function(event) {
  clearTimeout(timeout);
  // debounce for 500ms
  timeout = setTimeout(function() {
    cancelAnimationFrame(animation);
    var value = commands.value;
    history.replaceState(null, null, `?${new URLSearchParams({"q": value})}`);
    var eol = value.indexOf("\n", commands.selectionStart);
    if (eol >= 0) {
      value = value.substr(0, eol);
    }
    if (!beforeState) {
      beforeState = initialState();
      beforePositions = filterVisible(beforeState)
      layout(beforePositions);
    }
    afterState = initialState();
    var interpreter = function(cmd) { interpret(afterState, cmd); }
    value.split('\n').forEach(interpreter);
    afterPositions = filterVisible(afterState);
    layout(afterPositions);
    start = undefined;
    animation = window.requestAnimationFrame(step);
    slide.innerHTML = renderSlide(afterState.markup);
  }, 500);
});

function markdown(text) {
  return text.replace(
    /[\u0000-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u00FF]/g,
    c => '&#' + ('0000' + c.charCodeAt(0)).slice(-4) + ';'
  )
}

function renderSlide(markup) {
  var content = "";
  var in_code_block = false;
  var depth = 0;
  var next_depth = 0;
  for (var i = 0; i < markup.length; i++) {
    if (in_code_block) {
      if (markup[i].startsWith("```")) {
        content += "</pre>";
        in_code_block = false;
      } else {
        content += markup[i] + "\n";
      }
    } else if (markup[i].startsWith("#")) {
      content += `<h1>${markdown(markup[i].substring(1))}</h1>`;
    } else if (markup[i].startsWith("*")) {
      var match = markup[i].match("^([*]+)(.*)$");
      next_depth = match[1].length;
      while (depth < next_depth) {
        content += "<ul>";
        depth++;
      }
      while (depth > match[1].length) {
        content += "</ul>";
        depth--;
      }
      content += `<li>${markdown(match[2])}</li>`
    } else if (markup[i].startsWith("```")) {
      while (depth > 0) {
        content += "</ul>";
        depth--;
      }
      content += `<pre style="border: 1px solid grey; background-color: lightgrey; font-size: 1vw; width: fit-content; margin: 1vw; padding: 1vw;">`;
      in_code_block = true;
    }
  }
  return content;
}

