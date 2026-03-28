const STORAGE_KEY = 'gestra-control-state-v2';

export const gestures = ['palm', 'fist', 'peace', 'thumb', 'index', 'pinch'];

export const workflowPacks = {
  desktop: {
    id: 'desktop',
    name: 'Desktop',
    description: 'General desktop control for pointer, click, scroll, and utility actions.',
    mappings: {
      palm: 'scroll-up',
      fist: 'scroll-down',
      peace: 'screenshot',
      thumb: 'play-pause',
      index: 'move-mouse',
      pinch: 'left-click',
    },
  },
  browser: {
    id: 'browser',
    name: 'Browser',
    description: 'Touchless browsing with navigation, refresh, and media-safe controls.',
    mappings: {
      palm: 'scroll-up',
      fist: 'scroll-down',
      peace: 'browser-back',
      thumb: 'browser-forward',
      index: 'move-mouse',
      pinch: 'left-click',
    },
  },
  presentation: {
    id: 'presentation',
    name: 'Presentation',
    description: 'Distance-friendly slide control for demos, classes, and meetings.',
    mappings: {
      palm: 'next-slide',
      fist: 'previous-slide',
      peace: 'start-slideshow',
      thumb: 'blackout-slide',
      index: 'laser-pointer',
      pinch: 'end-slideshow',
    },
  },
  creator: {
    id: 'creator',
    name: 'Creator',
    description: 'Hands-busy control for recording, media, screenshots, and playback.',
    mappings: {
      palm: 'volume-up',
      fist: 'volume-down',
      peace: 'screenshot',
      thumb: 'play-pause',
      index: 'move-mouse',
      pinch: 'mute-audio',
    },
  },
  coding: {
    id: 'coding',
    name: 'Coding',
    description: 'Low-noise actions for reading, tab switching, and quick navigation.',
    mappings: {
      palm: 'scroll-up',
      fist: 'scroll-down',
      peace: 'alt-tab',
      thumb: 'refresh',
      index: 'move-mouse',
      pinch: 'left-click',
    },
  },
};

export const availableActions = {
  'scroll-up': { label: 'Scroll up', hint: 'Continuous upward scroll while held.' },
  'scroll-down': { label: 'Scroll down', hint: 'Continuous downward scroll while held.' },
  screenshot: { label: 'Screenshot', hint: 'Capture the screen or current shell.' },
  'play-pause': { label: 'Play / pause', hint: 'Toggle media playback.' },
  'move-mouse': { label: 'Move pointer', hint: 'Pointer movement mapped to the index fingertip.' },
  'left-click': { label: 'Left click', hint: 'Discrete primary click.' },
  'right-click': { label: 'Right click', hint: 'Discrete secondary click.' },
  'browser-back': { label: 'Back', hint: 'Navigate backward in browsers and file flows.' },
  'browser-forward': { label: 'Forward', hint: 'Navigate forward in browser history.' },
  refresh: { label: 'Refresh', hint: 'Refresh the current view.' },
  'next-slide': { label: 'Next slide', hint: 'Advance presentation or slideshow.' },
  'previous-slide': { label: 'Previous slide', hint: 'Go back one slide.' },
  'start-slideshow': { label: 'Start slideshow', hint: 'Begin presentation mode.' },
  'end-slideshow': { label: 'End slideshow', hint: 'Exit presentation mode.' },
  'blackout-slide': { label: 'Blackout slide', hint: 'Toggle blackout screen during slides.' },
  'laser-pointer': { label: 'Laser pointer', hint: 'Presentation pointer mode using index tracking.' },
  'volume-up': { label: 'Volume up', hint: 'Raise system output volume.' },
  'volume-down': { label: 'Volume down', hint: 'Lower system output volume.' },
  'mute-audio': { label: 'Mute audio', hint: 'Toggle mute for the active output.' },
  'alt-tab': { label: 'Switch app', hint: 'Cycle to another desktop window.' },
};

export const profilePresets = {
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    description: 'General-purpose control with moderate stability and responsiveness.',
    calibration: {
      minConfidence: 0.7,
      holdMs: 360,
      repeatDelayMs: 420,
      deadzone: 0.045,
      pointerSmoothness: 0.52,
      frameLeft: 0.08,
      frameRight: 0.92,
      frameTop: 0.08,
      frameBottom: 0.92,
      dominantHand: 'right',
      horizontalBias: 0,
    },
  },
  accessibility: {
    id: 'accessibility',
    name: 'Accessibility',
    description: 'More forgiving holds and safer triggers for low-mobility use.',
    calibration: {
      minConfidence: 0.65,
      holdMs: 560,
      repeatDelayMs: 620,
      deadzone: 0.08,
      pointerSmoothness: 0.74,
      frameLeft: 0.06,
      frameRight: 0.94,
      frameTop: 0.06,
      frameBottom: 0.94,
      dominantHand: 'right',
      horizontalBias: 0,
    },
  },
  presentation: {
    id: 'presentation',
    name: 'Presentation',
    description: 'Longer holds and wider deadzones for room-scale control.',
    calibration: {
      minConfidence: 0.68,
      holdMs: 520,
      repeatDelayMs: 700,
      deadzone: 0.1,
      pointerSmoothness: 0.68,
      frameLeft: 0.12,
      frameRight: 0.88,
      frameTop: 0.1,
      frameBottom: 0.9,
      dominantHand: 'right',
      horizontalBias: 0,
    },
  },
  creator: {
    id: 'creator',
    name: 'Creator',
    description: 'Faster triggers for recording, streaming, and media workflows.',
    calibration: {
      minConfidence: 0.72,
      holdMs: 300,
      repeatDelayMs: 360,
      deadzone: 0.04,
      pointerSmoothness: 0.48,
      frameLeft: 0.08,
      frameRight: 0.92,
      frameTop: 0.08,
      frameBottom: 0.92,
      dominantHand: 'right',
      horizontalBias: 0,
    },
  },
};

const defaultState = {
  selectedPackId: 'desktop',
  selectedProfileId: 'balanced',
  automationEnabled: true,
  remaps: {},
  calibration: { ...profilePresets.balanced.calibration },
  context: {
    processName: '',
    title: '',
    pid: 0,
    appLabel: 'No app detected',
    matchedPackId: null,
  },
  recentContexts: [],
};

const appRules = [
  { match: /chrome|msedge|firefox|brave|opera/i, label: 'Browser', packId: 'browser' },
  { match: /powerpnt|powerpoint|zoom|teams/i, label: 'Presentation', packId: 'presentation' },
  { match: /vlc|spotify|obs|audacity|premiere|resolve/i, label: 'Creator', packId: 'creator' },
  { match: /code|devenv|notepad\+\+|idea64|pycharm|webstorm|cursor/i, label: 'Coding', packId: 'coding' },
];

let state = loadState();
const listeners = new Set();

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') {
      return { ...defaultState };
    }
    return normalizeState(parsed);
  } catch {
    return { ...defaultState };
  }
}

function normalizeState(raw) {
  const next = {
    ...defaultState,
    ...raw,
    calibration: {
      ...defaultState.calibration,
      ...(raw?.calibration || {}),
    },
    context: {
      ...defaultState.context,
      ...(raw?.context || {}),
    },
    remaps: { ...(raw?.remaps || {}) },
    recentContexts: Array.isArray(raw?.recentContexts) ? raw.recentContexts.slice(0, 6) : [],
  };

  if (!workflowPacks[next.selectedPackId]) {
    next.selectedPackId = defaultState.selectedPackId;
  }
  if (!profilePresets[next.selectedProfileId]) {
    next.selectedProfileId = defaultState.selectedProfileId;
  }

  return next;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function emit() {
  persist();
  listeners.forEach((listener) => listener(getControlState()));
}

function update(mutator) {
  const draft = normalizeState({ ...state });
  mutator(draft);
  state = normalizeState(draft);
  emit();
}

export function initializeControlState() {
  state = normalizeState(state);
  emit();
  return getControlState();
}

export function subscribeControlState(listener) {
  listeners.add(listener);
  listener(getControlState());
  return () => listeners.delete(listener);
}

export function getControlState() {
  return {
    ...state,
    effectivePackId: getEffectivePackId(),
    effectivePack: workflowPacks[getEffectivePackId()],
  };
}

export function getEffectivePackId() {
  if (state.automationEnabled && state.context?.matchedPackId && workflowPacks[state.context.matchedPackId]) {
    return state.context.matchedPackId;
  }
  return state.selectedPackId;
}

export function getWorkflowPackEntries() {
  return Object.values(workflowPacks);
}

export function getProfileEntries() {
  return Object.values(profilePresets);
}

export function getActionEntries() {
  return Object.entries(availableActions).map(([id, meta]) => ({ id, ...meta }));
}

export function getCalibration() {
  return { ...state.calibration };
}

export function getGestureAction(gesture, packId = getEffectivePackId()) {
  const pack = workflowPacks[packId] || workflowPacks.desktop;
  const overridden = state.remaps?.[packId]?.[gesture];
  return overridden || pack.mappings[gesture] || workflowPacks.desktop.mappings[gesture] || null;
}

export function getGestureActionLabel(gesture, packId = getEffectivePackId()) {
  const action = getGestureAction(gesture, packId);
  return availableActions[action]?.label || action || 'Unmapped';
}

export function selectWorkflowPack(packId) {
  if (!workflowPacks[packId]) return;
  update((draft) => {
    draft.selectedPackId = packId;
  });
}

export function selectProfile(profileId) {
  const preset = profilePresets[profileId];
  if (!preset) return;
  update((draft) => {
    draft.selectedProfileId = profileId;
    draft.calibration = {
      ...draft.calibration,
      ...preset.calibration,
    };
  });
}

export function setAutomationEnabled(enabled) {
  update((draft) => {
    draft.automationEnabled = Boolean(enabled);
  });
}

export function setCalibrationValue(key, value) {
  update((draft) => {
    draft.calibration[key] = value;
  });
}

export function setGestureRemap(packId, gesture, action) {
  if (!workflowPacks[packId] || !gestures.includes(gesture) || !availableActions[action]) {
    return;
  }
  update((draft) => {
    draft.remaps[packId] = {
      ...(draft.remaps[packId] || {}),
      [gesture]: action,
    };
  });
}

export function resetPackRemaps(packId) {
  update((draft) => {
    delete draft.remaps[packId];
  });
}

function getMatchedRule(context) {
  const haystack = `${context?.processName || ''} ${context?.title || ''}`;
  return appRules.find((rule) => rule.match.test(haystack)) || null;
}

export function setActiveContext(context = {}) {
  const matchedRule = getMatchedRule(context);
  update((draft) => {
    const processName = String(context.processName || '').trim();
    const title = String(context.title || '').trim();
    const appLabel = matchedRule?.label || processName || title || 'No app detected';
    draft.context = {
      processName,
      title,
      pid: Number(context.pid) || 0,
      appLabel,
      matchedPackId: matchedRule?.packId || null,
    };

    const recentKey = `${processName}|${title}`;
    draft.recentContexts = [
      { key: recentKey, appLabel, matchedPackId: matchedRule?.packId || 'desktop' },
      ...draft.recentContexts.filter((item) => item.key !== recentKey),
    ].slice(0, 6);
  });
}

export function getContextSummary() {
  const current = getControlState();
  return {
    appLabel: current.context.appLabel,
    processName: current.context.processName,
    title: current.context.title,
    matchedPackId: current.context.matchedPackId,
    automationEnabled: current.automationEnabled,
    effectivePackId: current.effectivePackId,
  };
}

export function resolveLocalAssistantCommand(command) {
  const text = String(command || '').trim().toLowerCase();
  if (!text) return null;

  for (const pack of getWorkflowPackEntries()) {
    if (text.includes(`${pack.id} mode`) || text.includes(`${pack.name.toLowerCase()} mode`) || text.includes(`switch to ${pack.id}`)) {
      selectWorkflowPack(pack.id);
      return `Switched Gestra to ${pack.name} pack.`;
    }
  }

  for (const profile of getProfileEntries()) {
    if (text.includes(`${profile.id} profile`) || text.includes(`${profile.name.toLowerCase()} profile`) || text.includes(`use ${profile.id}`)) {
      selectProfile(profile.id);
      return `Applied ${profile.name} profile.`;
    }
  }

  if (text.includes('enable automation') || text.includes('turn on automation')) {
    setAutomationEnabled(true);
    return 'Context automation enabled.';
  }

  if (text.includes('disable automation') || text.includes('turn off automation')) {
    setAutomationEnabled(false);
    return 'Context automation disabled.';
  }

  const remapMatch = text.match(/\b(?:map|remap)\s+(palm|fist|peace|thumb|index|pinch)\s+to\s+([a-z -]+)\b/);
  if (remapMatch) {
    const [, gesture, rawAction] = remapMatch;
    const actionId = Object.keys(availableActions).find((id) => availableActions[id].label.toLowerCase() === rawAction.trim());
    if (actionId) {
      setGestureRemap(getEffectivePackId(), gesture, actionId);
      return `Mapped ${gesture} to ${availableActions[actionId].label} in the active workflow pack.`;
    }
  }

  if (text.includes('what mode') || text.includes('current pack') || text.includes('active pack')) {
    const current = getControlState();
    const automation = current.automationEnabled ? `automation is routing from ${current.context.appLabel}` : 'automation is off';
    return `Gestra is using the ${current.effectivePack.name} pack, ${profilePresets[current.selectedProfileId].name} profile, and ${automation}.`;
  }

  return null;
}
