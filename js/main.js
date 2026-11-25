/* Udhyog Traders — shared interactions */
(function () {
  "use strict";

  /* Theme toggle --------------------------------------------------------- */
  var root = document.documentElement;
  var themeButtons = document.querySelectorAll("[data-theme-toggle]");

  function applyTheme(mode) {
    var light = mode === "light";

    if (light) {
      root.setAttribute("data-theme", "light");
    } else {
      root.removeAttribute("data-theme");
    }

    try {
      localStorage.setItem("udhyog-theme", light ? "light" : "dark");
    } catch (error) {
      /* storage blocked - the toggle still works for this visit */
    }

    themeButtons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(light));
      button.setAttribute(
        "aria-label",
        light ? "Switch to dark theme" : "Switch to light theme"
      );
    });
  }

  themeButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      applyTheme(root.getAttribute("data-theme") === "light" ? "dark" : "light");
    });
  });

  applyTheme(root.getAttribute("data-theme") === "light" ? "light" : "dark");

  /* Mobile navigation ---------------------------------------------------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a") && window.innerWidth <= 1000) {
        toggle.setAttribute("aria-expanded", "false");
        nav.classList.remove("is-open");
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        toggle.setAttribute("aria-expanded", "false");
        nav.classList.remove("is-open");
        toggle.focus();
      }
    });
  }

  /* Footer year ---------------------------------------------------------- */
  document.querySelectorAll("[data-year]").forEach(function (node) {
    node.textContent = String(new Date().getFullYear());
  });

  /* Scroll reveal -------------------------------------------------------- */
  var revealItems = document.querySelectorAll(".reveal");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!revealItems.length) {
    // nothing to do
  } else if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach(function (item) {
      item.classList.add("is-visible");
    });
  } else {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    revealItems.forEach(function (item, index) {
      item.style.transitionDelay = Math.min(index % 3, 2) * 70 + "ms";
      observer.observe(item);
    });
  }

  /* Contact form --------------------------------------------------------- */
  var form = document.querySelector("[data-contact-form]");

  if (form) {
    var status = form.querySelector(".form-status");
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var honeypot = form.elements.namedItem("company_website");

    /* Spam and flood guards. This is a static site with no backend, so these
       are deterrents stored in the visitor's browser - not enforcement. A real
       server-side limit belongs in whatever handler the form is pointed at. */
    var MIN_FILL_MS = 3000;
    var LIMIT_KEY = "udhyog-enquiry-log";
    var LIMIT_MAX = 3;
    var LIMIT_WINDOW_MS = 10 * 60 * 1000;
    var openedAt = Date.now();

    function recentSubmissions() {
      try {
        var stored = JSON.parse(localStorage.getItem(LIMIT_KEY) || "[]");
        if (!Array.isArray(stored)) return [];

        var now = Date.now();
        var cutoff = now - LIMIT_WINDOW_MS;

        return stored.filter(function (time) {
          return typeof time === "number" && time > cutoff && time <= now;
        });
      } catch (error) {
        return [];
      }
    }

    function recordSubmission(recent) {
      try {
        localStorage.setItem(LIMIT_KEY, JSON.stringify(recent.concat(Date.now())));
      } catch (error) {
        /* storage blocked - the limit only covers this page view */
      }
    }

    function showStatus(message, isError) {
      if (!status) return;

      status.classList.add("is-visible");
      status.classList.toggle("is-error", Boolean(isError));
      status.setAttribute("role", isError ? "alert" : "status");

      var text = status.querySelector("[data-status-text]");
      if (text) text.textContent = message;

      status.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    var validators = {
      name: function (value) {
        return value.trim().length >= 2 ? "" : "Please enter your full name.";
      },
      email: function (value) {
        return emailPattern.test(value.trim())
          ? ""
          : "Please enter a valid email address.";
      },
      phone: function (value) {
        if (!value.trim()) return "";
        var digits = value.replace(/\D/g, "");
        return digits.length >= 7 && digits.length <= 15
          ? ""
          : "Please enter a valid phone number.";
      },
      message: function (value) {
        return value.trim().length >= 15
          ? ""
          : "Please add a few details (at least 15 characters).";
      },
    };

    function fieldError(input) {
      var field = input.closest(".field");
      return field ? field.querySelector(".error") : null;
    }

    function validate(input) {
      var check = validators[input.name];
      if (!check) return true;

      var message = check(input.value);
      var error = fieldError(input);

      if (message) {
        input.setAttribute("aria-invalid", "true");
        if (error) error.textContent = message;
        return false;
      }

      input.removeAttribute("aria-invalid");
      if (error) error.textContent = "";
      return true;
    }

    form.querySelectorAll("input, textarea").forEach(function (input) {
      if (!validators[input.name]) return;

      input.addEventListener("blur", function () {
        validate(input);
      });

      input.addEventListener("input", function () {
        if (input.getAttribute("aria-invalid") === "true") validate(input);
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var inputs = Array.prototype.slice.call(
        form.querySelectorAll("input, textarea")
      );
      var firstInvalid = null;

      inputs.forEach(function (input) {
        if (!validators[input.name]) return;
        var ok = validate(input);
        if (!ok && !firstInvalid) firstInvalid = input;
      });

      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      var recent = recentSubmissions();

      if (recent.length >= LIMIT_MAX) {
        var waitMinutes = Math.max(
          1,
          Math.ceil((recent[0] + LIMIT_WINDOW_MS - Date.now()) / 60000)
        );

        showStatus(
          "You have sent " +
            recent.length +
            " enquiries in the last few minutes. Please wait about " +
            waitMinutes +
            (waitMinutes === 1 ? " minute" : " minutes") +
            ", or call +91 98250 41230 and we will take the details over the phone.",
          true
        );
        return;
      }

      // Honeypot filled, or submitted faster than a person could read the form:
      // report success so bots learn nothing, but record nothing.
      var botLike =
        Boolean(honeypot && honeypot.value) || Date.now() - openedAt < MIN_FILL_MS;

      if (!botLike) {
        recordSubmission(recent);

        // Static site: no backend wired up. Replace this with a form endpoint
        // (e.g. Formspree, Web3Forms) or your own handler when deploying.
        var firstName = (form.elements.namedItem("name").value || "there")
          .trim()
          .split(" ")[0];

        showStatus(
          "Thank you, " +
            firstName +
            ". Your enquiry has been recorded — our team responds within one business day.",
          false
        );
      }

      form.reset();
    });
  }
})();
