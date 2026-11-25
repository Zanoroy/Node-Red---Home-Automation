(function () {
  const sessionPath = "/api/session";
  const logoutPath = "/api/auth/logout";
  const roleAliases = {
    admin: "admin",
    administrator: "admin",
    operator: "operator",
    view_only: "view_only",
    "view-only": "view_only",
    view_only_camera: "view_only_camera",
    "view-only-camera": "view_only_camera"
  };

  const state = {
    loaded: false,
    session: null
  };

  function normalizeRole(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return "";
    return roleAliases[normalized] || normalized;
  }

  function roleSetFromSession(session) {
    const roles = Array.isArray(session?.roles) ? session.roles : [];
    return new Set(roles.map(normalizeRole).filter(Boolean));
  }

  function buildPermissions(session) {
    const roles = roleSetFromSession(session);
    const isAdmin = roles.has("admin");
    const isOperator = roles.has("operator");
    const canViewCameras = isAdmin || isOperator || roles.has("view_only_camera");
    const canViewDashboard = isAdmin || isOperator || roles.has("view_only") || canViewCameras;
    return {
      admin: isAdmin,
      dashboardView: canViewDashboard,
      cameraView: canViewCameras,
      deviceControl: isAdmin || isOperator
    };
  }

  function getCurrentPath() {
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }

  function redirectToLogin() {
    const current = encodeURIComponent(getCurrentPath());
    const loginUrl = new URL("./login.html", window.location.href);
    loginUrl.searchParams.set("rd", getCurrentPath());
    window.location.assign(loginUrl.href);
  }

  async function loadSession() {
    const response = await fetch(sessionPath, { method: "GET", credentials: "same-origin" });
    if (response.status === 401 || response.status === 403) {
      redirectToLogin();
      throw new Error("Authentication required.");
    }
    if (!response.ok) {
      throw new Error(`Session request failed (${response.status})`);
    }

    const payload = await response.json();
    const session = {
      authenticated: Boolean(payload?.authenticated),
      user: payload?.user || null,
      roles: Array.isArray(payload?.roles) ? payload.roles.map(normalizeRole).filter(Boolean) : []
    };
    session.permissions = payload?.permissions && typeof payload.permissions === "object"
      ? payload.permissions
      : buildPermissions(session);

    if (!session.authenticated) {
      redirectToLogin();
      throw new Error("Session is not authenticated.");
    }

    state.loaded = true;
    state.session = session;
    document.body.dataset.userRole = session.permissions.admin
      ? "admin"
      : session.permissions.deviceControl
        ? "operator"
        : session.permissions.cameraView
          ? "view_only_camera"
          : "view_only";
    return session;
  }

  function hasCapability(capability) {
    const permissions = state.session?.permissions || {};
    if (capability === "dashboard:view") return Boolean(permissions.dashboardView);
    if (capability === "camera:view") return Boolean(permissions.cameraView);
    if (capability === "admin:view") return Boolean(permissions.admin);
    if (capability === "device:control") return Boolean(permissions.deviceControl);
    return false;
  }

  function enforcePageCapability() {
    const requiredCapability = String(document.body?.dataset?.requiredCapability || "").trim();
    if (!requiredCapability) return true;
    if (hasCapability(requiredCapability)) return true;
    redirectToLogin();
    return false;
  }

  function applyNavigationVisibility() {
    document.querySelectorAll("[data-nav-capability]").forEach((element) => {
      const capability = String(element.dataset.navCapability || "").trim();
      const isVisible = !capability || hasCapability(capability);
      element.hidden = !isVisible;
      element.setAttribute("aria-hidden", String(!isVisible));
    });
  }

  const ready = loadSession().then(() => {
    enforcePageCapability();
    applyNavigationVisibility();
  });

  window.HomeAuth = {
    requireReady: function () {
      return ready;
    },
    getSession: function () {
      return state.session;
    },
    can: function (capability) {
      return hasCapability(capability);
    },
    isAdmin: function () {
      return hasCapability("admin:view");
    },
    logout: async function () {
      await fetch(logoutPath, { method: "POST", credentials: "same-origin" });
      redirectToLogin();
    }
  };
})();