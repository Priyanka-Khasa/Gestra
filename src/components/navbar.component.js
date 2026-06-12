// src/components/navbar.component.js

const $ = (id) => document.getElementById(id);

const screens = {
  intro: $("intro-screen"),
  guide: $("guide-screen"),
  setup: $("login-screen"),
  permission: $("license-screen"),
  workspace: $("app-container"),
};

const buttons = {
  openGuide: $("open-guide-from-workspace-btn"),
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

  screens.guide?.classList.remove("hidden");
  if (screens.guide) screens.guide.scrollTop = 0;
}

function bindNavbarEvents() {
  buttons.openGuide?.addEventListener("click", showGuide);
}

export function initNavbar() {
  bindNavbarEvents();
}