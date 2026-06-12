// src/screens/intro-screen.js

const $ = (id) => document.getElementById(id);

const screens = {
  intro: $("intro-screen"),
  guide: $("guide-screen"),
  setup: $("login-screen"),
  workspace: $("app-container"),
};

const buttons = {
  openGuide: $("open-master-guide-btn"),
  startSetup: $("go-to-login-btn"),
  skipIntro: $("skip-intro-btn"),

  guideBack: $("guide-back-home-btn"),
  guideSetup: $("guide-start-setup-btn"),
  guideWorkspace: $("guide-enter-workspace-btn"),

  workspaceGuide: $("open-guide-from-workspace-btn"),
};

function hideAllScreens() {
  Object.values(screens).forEach((screen) => {
    if (!screen) return;

    screen.classList.add("hidden");
    screen.classList.remove("flex");
  });
}

function showIntro() {
  hideAllScreens();

  screens.intro?.classList.remove("hidden");
  screens.intro?.classList.add("flex");
}

function showGuide() {
  hideAllScreens();

  screens.guide?.classList.remove("hidden");
}

function showSetup() {
  hideAllScreens();

  screens.setup?.classList.remove("hidden");
  screens.setup?.classList.add("flex");
}

function showWorkspace() {
  hideAllScreens();

  screens.workspace?.classList.remove("hidden");
}

function bindEvents() {
  buttons.openGuide?.addEventListener("click", showGuide);

  buttons.startSetup?.addEventListener("click", showSetup);

  buttons.skipIntro?.addEventListener("click", showWorkspace);

  buttons.guideBack?.addEventListener("click", showIntro);

  buttons.guideSetup?.addEventListener("click", showSetup);

  buttons.guideWorkspace?.addEventListener("click", showWorkspace);

  buttons.workspaceGuide?.addEventListener("click", showGuide);
}

export function initIntroScreen() {
  bindEvents();
}