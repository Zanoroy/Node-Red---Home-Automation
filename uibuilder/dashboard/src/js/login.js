(function () {
  const loginPath = "/api/auth/login";
  const sessionPath = "/api/session";
  const form = document.getElementById("loginForm");
  const usernameInput = document.getElementById("usernameInput");
  const passwordInput = document.getElementById("passwordInput");
  const rememberInput = document.getElementById("rememberDevice");
  const errorBox = document.getElementById("loginError");
  const submitButton = document.getElementById("loginSubmit");

  function redirectTarget() {
    const redirect = new URLSearchParams(window.location.search).get("rd");
    if (!redirect) return "./index.html";
    try {
      const target = decodeURIComponent(redirect);
      return target.startsWith("/") ? target : "./index.html";
    } catch (_error) {
      return "./index.html";
    }
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("d-none");
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.classList.add("d-none");
  }

  try {
    const savedUsername = window.localStorage.getItem("home.loginUsername");
    if (savedUsername) usernameInput.value = savedUsername;
    rememberInput.checked = window.localStorage.getItem("home.rememberDevice") === "true";
  } catch (_error) {
    // Login still works when browser storage is unavailable.
  }

  async function checkExistingSession() {
    const response = await fetch(sessionPath, { method: "GET", credentials: "same-origin" });
    if (!response.ok) return;
    const payload = await response.json();
    if (payload && payload.authenticated) {
      window.location.assign(redirectTarget());
    }
  }

  async function submitLogin(event) {
    event.preventDefault();
    clearError();

    const username = String(usernameInput.value || "").trim();
    const password = String(passwordInput.value || "");
    if (!username || !password) {
      showError("Username and password are required.");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Signing in...";

    try {
      const response = await fetch(loginPath, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          remember: Boolean(rememberInput?.checked)
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        showError(payload?.error || "Sign-in failed.");
        return;
      }

      try {
        window.localStorage.setItem("home.rememberDevice", String(Boolean(rememberInput?.checked)));
        if (rememberInput?.checked) {
          window.localStorage.setItem("home.loginUsername", username);
        } else {
          window.localStorage.removeItem("home.loginUsername");
        }
      } catch (_error) {
        // Authentication success does not depend on browser storage.
      }

      window.location.assign(redirectTarget());
    } catch (_error) {
      showError("Unable to reach authentication service.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Sign in";
    }
  }

  form.addEventListener("submit", submitLogin);
  checkExistingSession().catch(() => {});
})();
