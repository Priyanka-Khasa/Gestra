// src/screens/setup-screen.js

const $ = (id) => document.getElementById(id);

const screens = {
  intro: $("intro-screen"),
  guide: $("guide-screen"),
  setup: $("login-screen"),
  license: $("license-screen"),
  workspace: $("app-container"),
};

const buttons = {
  startSetup: $("go-to-login-btn"),
  guideStartSetup: $("guide-start-setup-btn"),
  backToHome: $("guide-back-home-btn"),

  setupForm: $("login-form"),
  backToSetup: $("back-to-login-btn"),
  acceptLicense: $("accept-license-btn"),

  licenseCheck: $("license-check"),
  cameraCheck: $("login-email"),
  lightingCheck: $("login-password"),
};

function hideAllScreens() {
  Object.values(screens).forEach((screen) => {
    if (!screen) return;
    screen.classList.add("hidden");
    screen.classList.remove("flex");
  });
}

function showScreen(screenName) {
  hideAllScreens();

  const screen = screens[screenName];
  if (!screen) return;

  screen.classList.remove("hidden");

  if (screenName === "setup" || screenName === "license") {
    screen.classList.add("flex");
  }
}

function goToSetup() {
  showScreen("setup");
}

function goToLicense() {
  const cameraReady = buttons.cameraCheck?.checked;
  const lightingReady = buttons.lightingCheck?.checked;

  if (!cameraReady || !lightingReady) {
    alert("Please confirm camera and lighting before continuing.");
    return;
  }

  showScreen("license");
}

function enterWorkspace() {
  if (!buttons.licenseCheck?.checked) {
    alert("Please accept the desktop interaction consent first.");
    return;
  }

  showScreen("workspace");
}

function bindSetupEvents() {
  buttons.startSetup?.addEventListener("click", goToSetup);
  buttons.guideStartSetup?.addEventListener("click", goToSetup);

  buttons.backToHome?.addEventListener("click", () => {
    showScreen("intro");
  });

  buttons.setupForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    goToLicense();
  });

  buttons.backToSetup?.addEventListener("click", goToSetup);
  buttons.acceptLicense?.addEventListener("click", enterWorkspace);
}

export function initSetupScreen() {
  bindSetupEvents();
}