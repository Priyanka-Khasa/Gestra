// src/screens/permission-screen.js

const $ = (id) => document.getElementById(id);

const screens = {
  setup: $("login-screen"),
  permission: $("license-screen"),
  workspace: $("app-container"),
};

const els = {
  consentCheck: $("license-check"),
  backBtn: $("back-to-login-btn"),
  acceptBtn: $("accept-license-btn"),
};

function hideScreen(screen) {
  if (!screen) return;
  screen.classList.add("hidden");
  screen.classList.remove("flex");
}

function showFlexScreen(screen) {
  if (!screen) return;
  screen.classList.remove("hidden");
  screen.classList.add("flex");
}

function showWorkspace() {
  hideScreen(screens.setup);
  hideScreen(screens.permission);

  if (screens.workspace) {
    screens.workspace.classList.remove("hidden");
  }
}

function goBackToSetup() {
  hideScreen(screens.permission);
  showFlexScreen(screens.setup);
}

function acceptPermission() {
  if (!els.consentCheck?.checked) {
    alert("Please accept the permission consent first.");
    return;
  }

  showWorkspace();
}

function updateAcceptButtonState() {
  if (!els.acceptBtn || !els.consentCheck) return;

  els.acceptBtn.disabled = !els.consentCheck.checked;
  els.acceptBtn.classList.toggle("opacity-50", !els.consentCheck.checked);
  els.acceptBtn.classList.toggle("cursor-not-allowed", !els.consentCheck.checked);
}

export function initPermissionScreen() {
  els.backBtn?.addEventListener("click", goBackToSetup);
  els.acceptBtn?.addEventListener("click", acceptPermission);
  els.consentCheck?.addEventListener("change", updateAcceptButtonState);

  updateAcceptButtonState();
}