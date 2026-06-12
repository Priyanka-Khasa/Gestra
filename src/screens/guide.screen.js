// src/screens/guide-screen.js

const $ = (id) => document.getElementById(id);

const screens = {
  intro: $("intro-screen"),
  guide: $("guide-screen"),
  setup: $("login-screen"),
  permission: $("license-screen"),
  workspace: $("app-container"),
};

const buttons = {
  openFromIntro: $("open-master-guide-btn"),
  openFromWorkspace: $("open-guide-from-workspace-btn"),

  startSetup: $("guide-start-setup-btn"),
  enterWorkspace: $("guide-enter-workspace-btn"),
  backHome: $("guide-back-home-btn"),
};

function hideAllScreens() {
  Object.values(screens).forEach((screen) => {
    if (!screen) return;

    screen.classList.add("hidden");
    screen.classList.remove("flex");
  });
}

function showGuide() {
  hideAllScreens();

  if (!screens.guide) return;
  screens.guide.classList.remove("hidden");
  screens.guide.scrollTop = 0;
}

function showIntro() {
  hideAllScreens();

  screens.intro?.classList.remove("hidden");
  screens.intro?.classList.add("flex");
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

function bindGuideEvents() {
  buttons.openFromIntro?.addEventListener("click", showGuide);
  buttons.openFromWorkspace?.addEventListener("click", showGuide);

  buttons.startSetup?.addEventListener("click", showSetup);
  buttons.enterWorkspace?.addEventListener("click", showWorkspace);
  buttons.backHome?.addEventListener("click", showIntro);
}

export function initGuideScreen() {
  bindGuideEvents();
}