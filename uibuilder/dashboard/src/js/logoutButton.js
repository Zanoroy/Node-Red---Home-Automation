(function () {
  function initializeLogoutButton() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (typeof window.HomeAuth !== "undefined" && window.HomeAuth.logout) {
        await window.HomeAuth.logout();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeLogoutButton);
  } else {
    initializeLogoutButton();
  }
})();
