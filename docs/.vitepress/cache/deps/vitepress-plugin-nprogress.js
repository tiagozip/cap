// node_modules/vitepress-plugin-nprogress/lib/vitepress-plugin-nprogress.js
var x = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
var P = { exports: {} };
(function(h, g) {
  (function(t, s) {
    h.exports = s();
  })(x, function() {
    var t = {};
    t.version = "0.2.0";
    var s = t.settings = {
      minimum: 0.08,
      easing: "ease",
      positionUsing: "",
      speed: 200,
      trickle: true,
      trickleRate: 0.02,
      trickleSpeed: 800,
      showSpinner: true,
      barSelector: '[role="bar"]',
      spinnerSelector: '[role="spinner"]',
      parent: "body",
      template: '<div class="bar" role="bar"><div class="peg"></div></div><div class="spinner" role="spinner"><div class="spinner-icon"></div></div>'
    };
    t.configure = function(e) {
      var r, n;
      for (r in e)
        n = e[r], n !== void 0 && e.hasOwnProperty(r) && (s[r] = n);
      return this;
    }, t.status = null, t.set = function(e) {
      var r = t.isStarted();
      e = l(e, s.minimum, 1), t.status = e === 1 ? null : e;
      var n = t.render(!r), o = n.querySelector(s.barSelector), a = s.speed, c = s.easing;
      return n.offsetWidth, N(function(i) {
        s.positionUsing === "" && (s.positionUsing = t.getPositioningCSS()), v(o, T(e, a, c)), e === 1 ? (v(n, {
          transition: "none",
          opacity: 1
        }), n.offsetWidth, setTimeout(function() {
          v(n, {
            transition: "all " + a + "ms linear",
            opacity: 0
          }), setTimeout(function() {
            t.remove(), i();
          }, a);
        }, a)) : setTimeout(i, a);
      }), this;
    }, t.isStarted = function() {
      return typeof t.status == "number";
    }, t.start = function() {
      t.status || t.set(0);
      var e = function() {
        setTimeout(function() {
          !t.status || (t.trickle(), e());
        }, s.trickleSpeed);
      };
      return s.trickle && e(), this;
    }, t.done = function(e) {
      return !e && !t.status ? this : t.inc(0.3 + 0.5 * Math.random()).set(1);
    }, t.inc = function(e) {
      var r = t.status;
      return r ? (typeof e != "number" && (e = (1 - r) * l(Math.random() * r, 0.1, 0.95)), r = l(r + e, 0, 0.994), t.set(r)) : t.start();
    }, t.trickle = function() {
      return t.inc(Math.random() * s.trickleRate);
    }, function() {
      var e = 0, r = 0;
      t.promise = function(n) {
        return !n || n.state() === "resolved" ? this : (r === 0 && t.start(), e++, r++, n.always(function() {
          r--, r === 0 ? (e = 0, t.done()) : t.set((e - r) / e);
        }), this);
      };
    }(), t.render = function(e) {
      if (t.isRendered())
        return document.getElementById("nprogress");
      w(document.documentElement, "nprogress-busy");
      var r = document.createElement("div");
      r.id = "nprogress", r.innerHTML = s.template;
      var n = r.querySelector(s.barSelector), o = e ? "-100" : m(t.status || 0), a = document.querySelector(s.parent), c;
      return v(n, {
        transition: "all 0 linear",
        transform: "translate3d(" + o + "%,0,0)"
      }), s.showSpinner || (c = r.querySelector(s.spinnerSelector), c && k(c)), a != document.body && w(a, "nprogress-custom-parent"), a.appendChild(r), r;
    }, t.remove = function() {
      C(document.documentElement, "nprogress-busy"), C(document.querySelector(s.parent), "nprogress-custom-parent");
      var e = document.getElementById("nprogress");
      e && k(e);
    }, t.isRendered = function() {
      return !!document.getElementById("nprogress");
    }, t.getPositioningCSS = function() {
      var e = document.body.style, r = "WebkitTransform" in e ? "Webkit" : "MozTransform" in e ? "Moz" : "msTransform" in e ? "ms" : "OTransform" in e ? "O" : "";
      return r + "Perspective" in e ? "translate3d" : r + "Transform" in e ? "translate" : "margin";
    };
    function l(e, r, n) {
      return e < r ? r : e > n ? n : e;
    }
    function m(e) {
      return (-1 + e) * 100;
    }
    function T(e, r, n) {
      var o;
      return s.positionUsing === "translate3d" ? o = { transform: "translate3d(" + m(e) + "%,0,0)" } : s.positionUsing === "translate" ? o = { transform: "translate(" + m(e) + "%,0)" } : o = { "margin-left": m(e) + "%" }, o.transition = "all " + r + "ms " + n, o;
    }
    var N = /* @__PURE__ */ function() {
      var e = [];
      function r() {
        var n = e.shift();
        n && n(r);
      }
      return function(n) {
        e.push(n), e.length == 1 && r();
      };
    }(), v = /* @__PURE__ */ function() {
      var e = ["Webkit", "O", "Moz", "ms"], r = {};
      function n(i) {
        return i.replace(/^-ms-/, "ms-").replace(/-([\da-z])/gi, function(u, f) {
          return f.toUpperCase();
        });
      }
      function o(i) {
        var u = document.body.style;
        if (i in u)
          return i;
        for (var f = e.length, p = i.charAt(0).toUpperCase() + i.slice(1), d; f--; )
          if (d = e[f] + p, d in u)
            return d;
        return i;
      }
      function a(i) {
        return i = n(i), r[i] || (r[i] = o(i));
      }
      function c(i, u, f) {
        u = a(u), i.style[u] = f;
      }
      return function(i, u) {
        var f = arguments, p, d;
        if (f.length == 2)
          for (p in u)
            d = u[p], d !== void 0 && u.hasOwnProperty(p) && c(i, p, d);
        else
          c(i, f[1], f[2]);
      };
    }();
    function S(e, r) {
      var n = typeof e == "string" ? e : b(e);
      return n.indexOf(" " + r + " ") >= 0;
    }
    function w(e, r) {
      var n = b(e), o = n + r;
      S(n, r) || (e.className = o.substring(1));
    }
    function C(e, r) {
      var n = b(e), o;
      !S(e, r) || (o = n.replace(" " + r + " ", " "), e.className = o.substring(1, o.length - 1));
    }
    function b(e) {
      return (" " + (e.className || "") + " ").replace(/\s+/gi, " ");
    }
    function k(e) {
      e && e.parentNode && e.parentNode.removeChild(e);
    }
    return t;
  });
})(P);
var y = P.exports;
var E = (h) => {
  if (typeof window > "u")
    return;
  const { router: g } = h;
  return setTimeout(() => {
    y.configure({ showSpinner: false });
    const t = g.onBeforeRouteChange, s = g.onAfterRouteChanged;
    g.onBeforeRouteChange = (l) => {
      y.start(), t == null || t(l);
    }, g.onAfterRouteChanged = (l) => {
      y.done(), s == null || s(l);
    };
  }), y;
};
export {
  E as default
};
/*! Bundled license information:

vitepress-plugin-nprogress/lib/vitepress-plugin-nprogress.js:
  (* NProgress, (c) 2013, 2014 Rico Sta. Cruz - http://ricostacruz.com/nprogress
   * @license MIT *)
*/
//# sourceMappingURL=vitepress-plugin-nprogress.js.map
