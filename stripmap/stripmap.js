"use strict";

function normalize_angle(theta, lo) {
  while (theta < lo) {
    theta += 2 * Math.PI;
  }
  while (lo + 2 * Math.PI <= theta) {
    theta -= 2 * Math.PI;
  }
  return theta;
}

function closed_open_sector(lo, hi) {
  lo = normalize_angle(lo, 0);
  hi = normalize_angle(hi, lo);
  if (hi == lo) {
    hi += 2 * Math.PI;
  }
  return [lo, hi];
}

function intersection(lo1, hi1, lo2, hi2) {
  if (lo2 < lo1) {
    [lo1, hi1, lo2, hi2] = [lo2, hi2, lo1, hi1];
  }
  if (hi1 < lo2) {
    // the wraparound case is missed out in the ZS paper
    return [lo1, Math.min(hi1, hi2 - 2 * Math.PI)];
  } else {
    return [lo2, Math.min(hi1, hi2)];  
  }
}

function polar_coords(p1, p2) {
  var dx = p2[0] - p1[0];
  var dy = p2[1] - p1[1];
  return [Math.sqrt(dx * dx + dy * dy), Math.atan2(dy, dx)];
}

// Modified Zhao-Saalfeld. ZS intends to be a polyline smoothing
// algorithm that results in a polyline that lies no more than some
// width w from the original. The variants presented in the paper
// do not actually provide that guarantee when the line doubles back;
// see the splitting criteria below.
function stripmap(w, points) {
  var start = 0;
  var strips = [];
  while (start < points.length - 2) {
    var furthest, furthest_r = -1, lo, hi;
    for (var i = start + 1; i < points.length; i++) {
      var [r, theta] = polar_coords(points[start], points[i]);
      var angle = Math.asin(Math.min(1, w/r));
      var [lo_i, hi_i] = closed_open_sector(theta - angle, theta + angle);
      if (i == start + 1) {
        [lo, hi] = [lo_i, hi_i];
      } else {
        [lo, hi] = intersection(lo, hi, lo_i, hi_i);
        if (hi <= lo) {
          break;
        }
      }
      theta = normalize_angle(theta, lo);
      if (theta < hi && furthest_r < r) {
        furthest = i;
        furthest_r = r;
      }
    }
    strips.push(points.slice(start, furthest + 1));
    start = furthest;
  }
  return strips;
}

function flood_fill(origin, accepts) {
  var [ox, oy] = origin.map(Math.floor);
  var todo = [[ox, oy], [ox - 1, oy], [ox + 1, oy], [ox, oy - 1], [ox, oy + 1]];
  var images = [];
  var seen = {};
  while (todo.length > 0) {
      var [x, y] = todo.pop();
      var key = x + "," + y;
      if (seen[key]) {
        continue;
      }
      seen[key] = true;
  
    if (accepts(x, y)) {
      images.push([x, y]);
      todo.push([x-1, y]);
      todo.push([x-1, y-1]);
      todo.push([x+1, y]);
      todo.push([x, y+1]);
    }
  } 
  return images;
}

// Check if tile and strip intersect with separating axis theorem.
function make_collider(a, b, w) {
  var [ax, ay] = a;
  var [bx, by] = b;
  var [r, angle] = polar_coords(a, b);
  var ca = Math.cos(-angle);
  var sa = Math.sin(-angle);
  var axs = [ax + w * sa, ax - w * sa, bx + w * sa, bx - w * sa];
  var ays = [ay + w * ca, ay - w * ca, by + w * ca, by - w * ca];
  var xmin = Math.min.apply(null, axs);
  var xmax = Math.max.apply(null, axs);
  var ymin = Math.min.apply(null, ays);
  var ymax = Math.max.apply(null, ays);

  return function(cx, cy) {
    if ((cx + 1) < xmin || xmax < cx
      || (cy + 1) < ymin || ymax < cy) {
      return false;
    }
    var x = cx - ax;
    var y = cy - ay;
    var xs = [
          x * ca - y * sa,
          (x + 1) * ca - y * sa,
          x * ca - (y + 1) * sa,
          (x + 1) * ca - (y + 1) * sa
          ];
    var ys = [
          x * sa + y * ca,
          (x + 1) * sa + y * ca,
          x * sa + (y + 1) * ca,
          (x + 1) * sa + (y + 1) * ca
          ];
    var cymax = Math.max.apply(null, ys);
    var cymin = Math.min.apply(null, ys);
    var cxmax = Math.max.apply(null, xs);
    var cxmin = Math.min.apply(null, xs);
    if (cymax < -w || w < cymin
    || cxmax < 0 || r < cxmin) {
      return false;
    }
    return true;
  };
}

function render_strip(width, strip, zoom, canvas_container) {
  var scale = 256;
  var first = strip[0];
  var last = strip[strip.length - 1];
  var images = flood_fill(first, make_collider(first, last, width));
  var canvas = document.createElement("canvas");
  canvas.setAttribute("style", "display: block;")
    var [height, angle] = polar_coords(first, last);
  canvas.width = 2* width * scale;
  canvas.height = height * scale;
  canvas_container.appendChild(canvas);
  var ctx = canvas.getContext('2d');
  var overlay = function() {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(canvas.width, 0);
    ctx.stroke();
    compass(ctx, 40, 40, angle, 35);
    ctx.save();
    ctx.translate(width*scale, 0);
    ctx.rotate(Math.PI/2 - angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (var p of strip) {
      ctx.lineTo((p[0] - first[0])*scale, (p[1] - first[1])*scale);
    }
    ctx.stroke();
    ctx.restore();
  };
  var loaded = new Map();
  for (var tile of images) {
    mktile(ctx, zoom, width, scale, tile, strip[0], angle, overlay, images, loaded);  
  }
}

function compass(ctx, x, y, angle, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI/2 - angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, r/2);
  ctx.lineTo(-r/10, r/2-r/10);
  ctx.lineTo(r/10, r/2-r/10);
  ctx.lineTo(0, r/2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, 2*Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r/10, r/2 + r/10);
  ctx.lineTo(r/10, r - r/10);
  ctx.lineTo(-r/10, r/2 + r/10);
  ctx.lineTo(-r/10, r - r/10);
  ctx.stroke();
  ctx.restore();
}

function mktile(ctx, zoom, width, scale, tile, origin, angle, overlay, images, loaded) {
  var img = new Image();
  var src = "https://c.tile.openstreetmap.org/" + zoom + "/" + tile[0] + "/" + tile[1] + ".png";
  img.addEventListener("load", function() {
      var x = (tile[0] - origin[0])*scale;
      var y = (tile[1] - origin[1])*scale;
      ctx.save();
      ctx.translate(width * scale, 0);
      ctx.rotate(Math.PI/2 - angle);
      ctx.drawImage(img, x, y);
      ctx.restore();
      loaded.set(src, true);
      if (loaded.size == images.length) {
        overlay();      
      } else {
        //console.log("loaded: " + loaded.size + " images: " + images.length);
      }
    });
  img.src = src;
}

