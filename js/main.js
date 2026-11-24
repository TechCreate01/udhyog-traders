/* Udhyog Traders — shared interactions */
(function () {
  "use strict";

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

      // Static site: no backend wired up. Replace this with a form endpoint
      // (e.g. Formspree, Web3Forms) or your own handler when deploying.
      if (status) {
        status.classList.add("is-visible");
        status.setAttribute("role", "status");
        status.querySelector("[data-status-text]").textContent =
          "Thank you, " +
          (form.elements.namedItem("name").value || "there").trim().split(" ")[0] +
          ". Your enquiry has been recorded — our team responds within one business day.";
        status.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      form.reset();
    });
  }
})();
