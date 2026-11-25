/* Udhyog Traders — theme bootstrap.
   Loaded blocking in <head> so a stored light preference paints before the
   first frame. Kept out of the pages as a file so Content-Security-Policy can
   forbid inline scripts entirely. */
(function () {
  "use strict";

  try {
    if (localStorage.getItem("udhyog-theme") === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    }
  } catch (error) {
    /* private mode - fall back to the dark default */
  }
})();
