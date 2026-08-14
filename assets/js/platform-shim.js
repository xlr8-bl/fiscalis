/* ==================================================================
   platform-shim.js
   The animation bundle was authored against a page framework whose
   runtime is no longer shipped. It touches that runtime in exactly
   four places:

     env("editor")     -> is the page open in the visual editor
     destroy()         -> tear down bound interactions before a swap
     ready()           -> re-bind them after a swap
     require("ix2")    -> hand back the interactions engine

   This page has no interaction bindings (no data-w-id attributes),
   so the engine has nothing to bind, tear down or rebuild. The three
   lifecycle calls are already written null-safe in the bundle; only
   env() is a hard reference, which is why its absence used to throw
   and leave the hero hidden.

   This stub answers those four calls and nothing else, which lets the
   original 45 KB runtime be removed outright.
   ================================================================== */
(function (global) {
  'use strict';

  if (global.Webflow) return; // real runtime present: leave it alone

  var noop = function () {};

  global.Webflow = {
    // Never the editor: this is a static build.
    env: function () { return false; },

    // No bound interactions, so there is nothing to tear down or rebind.
    destroy: noop,
    ready: noop,

    // The bundle guards this with `let m = require("ix2"); m && m.init()`,
    // so returning undefined cleanly skips the interactions engine.
    require: function () { return undefined; },

    // Present for parity with the shape the bundle expects.
    push: noop
  };
})(window);
