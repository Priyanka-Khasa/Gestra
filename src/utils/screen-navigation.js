// src/utils/screen-navigation.js

const $ = (id) => document.getElementById(id);

const screenIds = {
  intro: "intro-screen",
  guide: "guide-screen",
  setup: "login-screen",
  permission: "license-screen",
  workspace: "app-container",
};

function getScreen(name) {
  return $(screenIds[name]);
}

export function hideAllScreens() {
  Object.values(screenIds).forEach((id) => {
    const screen = $(id);
    if (!screen) return;

    screen.classList.add("hidden");
    screen.classList.remove("flex");
  });
}

export function showScreen(name) {
  hideAllScreens();

  const screen = getScreen(name);
  if (!screen) return;

  screen.classList.remove("hidden");

  if (
    name === "intro" ||
    name === "setup" ||
    name === "permission"
  ) {
    screen.classList.add("flex");
  }

  if (name === "guide") {
    screen.scrollTop = 0;
  }
}

export function showIntro() {
  showScreen("intro");
}

export function showGuide() {
  showScreen("guide");
}

export function showSetup() {
  showScreen("setup");
}

export function showPermission() {
  showScreen("permission");
}

export function showWorkspace() {
  showScreen("workspace");
}