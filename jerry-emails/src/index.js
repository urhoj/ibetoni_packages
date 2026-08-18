// The package surface IS the template module. COPY/copyFor are deliberately not
// re-exported: nothing outside consumes them, and copyFor is unsafe when called
// with an unnormalized language — `copyFor("constructor", …)` returns undefined
// and the caller's `c.subject` throws. Internally every call goes through
// normalizeLang first, so keeping it private removes the failure mode entirely
// rather than papering over it.
module.exports = require("./templates.js");
