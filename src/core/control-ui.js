import {
  gestures,
  getActionEntries,
  getContextSummary,
  getGestureAction,
  getProfileEntries,
  getWorkflowPackEntries,
  resetPackRemaps,
  selectProfile,
  selectWorkflowPack,
  setAutomationEnabled,
  setCalibrationValue,
  setGestureRemap,
  subscribeControlState,
} from './control-state.js';

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function toTitleCase(value) {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPackName(packId) {
  return getWorkflowPackEntries().find((pack) => pack.id === packId)?.name || toTitleCase(packId || 'unknown');
}

function getProfileName(profileId) {
  return getProfileEntries().find((profile) => profile.id === profileId)?.name || toTitleCase(profileId || 'unknown');
}

function getGestureName(gesture) {
  const gestureNames = {
    palm: 'Open Palm',
    fist: 'Closed Fist',
    peace: 'Peace Sign',
    thumb: 'Thumbs Up',
    index: 'Pointing',
    pinch: 'Pinch',
  };
  return gestureNames[gesture] || toTitleCase(gesture);
}

function setText(parent, selector, value) {
  const node = parent?.querySelector(selector);
  if (node) node.textContent = value;
}

function syncRangeFill(input) {
  if (!input) return;
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value || min);
  const ratio = max > min ? ((value - min) / (max - min)) * 100 : 0;
  input.style.setProperty('--range-fill', `${Math.max(0, Math.min(100, ratio))}%`);
}

function ensureWorkflowPanel(container) {
  if (!container || container.dataset.ready === 'true') return;

  container.innerHTML = `
    <div class="control-card">
      <div class="control-card-head">
        <div>
          <p class="control-label">Workflow Packs</p>
          <h3>Context Packs</h3>
        </div>
        <span class="control-badge" data-role="effective-pack-badge"></span>
      </div>
      <p class="control-muted">Choose a base pack manually, or let automation swap the effective pack from the active app context.</p>
      <div id="workflow-pack-list" class="control-chip-grid"></div>
      <div class="control-divider"></div>
      <div class="control-card-head">
        <div>
          <p class="control-label">Profiles</p>
          <h3>Reliability Profiles</h3>
        </div>
        <span class="control-badge" data-role="profile-badge"></span>
      </div>
      <div id="workflow-profile-list" class="control-chip-grid"></div>
    </div>
  `;

  container.addEventListener('click', (event) => {
    const packButton = event.target.closest('button[data-pack-id]');
    if (packButton) {
      selectWorkflowPack(packButton.dataset.packId);
      return;
    }

    const profileButton = event.target.closest('button[data-profile-id]');
    if (profileButton) {
      selectProfile(profileButton.dataset.profileId);
    }
  });

  container.dataset.ready = 'true';
}

function renderWorkflowPanel(state) {
  const container = document.getElementById('workflow-control-panel');
  if (!container) return;
  ensureWorkflowPanel(container);

  setText(container, '[data-role="effective-pack-badge"]', state.effectivePack.name);
  setText(container, '[data-role="profile-badge"]', getProfileName(state.selectedProfileId));

  const packList = container.querySelector('#workflow-pack-list');
  const profileList = container.querySelector('#workflow-profile-list');
  if (packList) {
    packList.innerHTML = getWorkflowPackEntries()
      .map(
        (pack) => `
          <button type="button" data-pack-id="${escapeHtml(pack.id)}" class="control-chip ${state.selectedPackId === pack.id ? 'active' : ''}">
            <strong>${escapeHtml(pack.name)}</strong>
            <span>${escapeHtml(pack.description)}</span>
          </button>
        `
      )
      .join('');
  }

  if (profileList) {
    profileList.innerHTML = getProfileEntries()
      .map(
        (profile) => `
          <button type="button" data-profile-id="${escapeHtml(profile.id)}" class="control-chip ${state.selectedProfileId === profile.id ? 'active' : ''}">
            <strong>${escapeHtml(profile.name)}</strong>
            <span>${escapeHtml(profile.description)}</span>
          </button>
        `
      )
      .join('');
  }
}

function ensureContextPanel(container) {
  if (!container || container.dataset.ready === 'true') return;

  container.innerHTML = `
    <div class="control-card">
      <div class="control-card-head">
        <div>
          <p class="control-label">Automation</p>
          <h3>App Context</h3>
        </div>
        <button id="automation-toggle-btn" type="button" class="control-toggle"></button>
      </div>
      <div class="context-grid">
        <div class="context-stat">
          <span class="context-stat-label">Active app</span>
          <strong data-role="active-app"></strong>
        </div>
        <div class="context-stat">
          <span class="context-stat-label">Matched pack</span>
          <strong data-role="matched-pack"></strong>
        </div>
        <div class="context-stat">
          <span class="context-stat-label">Effective pack</span>
          <strong data-role="effective-pack"></strong>
        </div>
        <div class="context-stat">
          <span class="context-stat-label">Window</span>
          <strong data-role="window-title"></strong>
        </div>
      </div>
      <div class="control-divider"></div>
      <p class="control-muted">Gestra can auto-switch packs when it sees a browser, presentation app, creator tool, or code editor in the foreground.</p>
      <div class="context-history" data-role="context-history"></div>
    </div>
  `;

  container.querySelector('#automation-toggle-btn')?.addEventListener('click', () => {
    const current = container.dataset.automationEnabled === 'true';
    setAutomationEnabled(!current);
  });

  container.dataset.ready = 'true';
}

function renderContextPanel(state) {
  const container = document.getElementById('context-control-panel');
  if (!container) return;
  ensureContextPanel(container);

  const summary = getContextSummary();
  const matchedPackText = summary.matchedPackId ? getPackName(summary.matchedPackId) : 'No pack match';
  const toggle = container.querySelector('#automation-toggle-btn');
  if (toggle) {
    toggle.textContent = state.automationEnabled ? 'Auto On' : 'Auto Off';
    toggle.classList.toggle('active', state.automationEnabled);
  }
  container.dataset.automationEnabled = String(state.automationEnabled);

  setText(container, '[data-role="active-app"]', summary.appLabel);
  setText(container, '[data-role="matched-pack"]', matchedPackText);
  setText(container, '[data-role="effective-pack"]', state.effectivePack.name);
  setText(container, '[data-role="window-title"]', summary.title || 'Waiting for context');

  const history = container.querySelector('[data-role="context-history"]');
  if (history) {
    history.innerHTML =
      (state.recentContexts || []).length > 0
        ? state.recentContexts
            .map(
              (item) =>
                `<span class="context-history-pill">${escapeHtml(item.appLabel)} &middot; ${escapeHtml(getPackName(item.matchedPackId))}</span>`
            )
            .join('')
        : '<span class="context-history-pill">No recent app context yet</span>';
  }
}

function ensureCalibrationPanel(container) {
  if (!container || container.dataset.ready === 'true') return;

  container.innerHTML = `
    <div class="control-card">
      <div class="control-card-head">
        <div>
          <p class="control-label">Calibration</p>
          <h3>Trust Controls</h3>
        </div>
        <span class="control-badge" data-role="profile-badge"></span>
      </div>
      <p class="control-muted">These values update live and persist locally, so the runtime keeps your preferred trigger timing and pointer feel.</p>
      <div class="control-field">
        <label for="dominant-hand-select">Dominant hand</label>
        <select id="dominant-hand-select" class="control-select">
          <option value="right">Right</option>
          <option value="left">Left</option>
        </select>
      </div>
      <div class="control-field">
        <label for="hold-ms-slider">Hold before trigger <span data-role="hold-ms-value"></span></label>
        <input id="hold-ms-slider" type="range" min="180" max="900" step="20" />
      </div>
      <div class="control-field">
        <label for="repeat-delay-slider">Repeat delay <span data-role="repeat-delay-value"></span></label>
        <input id="repeat-delay-slider" type="range" min="220" max="900" step="20" />
      </div>
      <div class="control-field">
        <label for="deadzone-slider-advanced">Pointer deadzone <span data-role="deadzone-value"></span></label>
        <input id="deadzone-slider-advanced" type="range" min="0.01" max="0.2" step="0.005" />
      </div>
      <div class="control-field">
        <label for="smoothness-slider">Pointer smoothing <span data-role="smoothness-value"></span></label>
        <input id="smoothness-slider" type="range" min="0.15" max="0.9" step="0.01" />
      </div>
    </div>
  `;

  container.querySelector('#dominant-hand-select')?.addEventListener('change', (event) => {
    const hand = event.target.value;
    setCalibrationValue('dominantHand', hand);
    setCalibrationValue('horizontalBias', hand === 'left' ? -0.03 : 0.03);
  });

  container.querySelector('#hold-ms-slider')?.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    syncRangeFill(event.target);
    setText(container, '[data-role="hold-ms-value"]', `${Math.round(value)}ms`);
    setCalibrationValue('holdMs', value);
  });

  container.querySelector('#repeat-delay-slider')?.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    syncRangeFill(event.target);
    setText(container, '[data-role="repeat-delay-value"]', `${Math.round(value)}ms`);
    setCalibrationValue('repeatDelayMs', value);
  });

  container.querySelector('#deadzone-slider-advanced')?.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    syncRangeFill(event.target);
    setText(container, '[data-role="deadzone-value"]', `${Math.round(value * 100)}%`);
    setCalibrationValue('deadzone', value);
  });

  container.querySelector('#smoothness-slider')?.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    syncRangeFill(event.target);
    setText(container, '[data-role="smoothness-value"]', `${Math.round(value * 100)}%`);
    setCalibrationValue('pointerSmoothness', value);
  });

  container.dataset.ready = 'true';
}

function renderCalibrationPanel(state) {
  const container = document.getElementById('calibration-control-panel');
  if (!container) return;
  ensureCalibrationPanel(container);

  const c = state.calibration;
  setText(container, '[data-role="profile-badge"]', getProfileName(state.selectedProfileId).toUpperCase());

  const dominantHand = container.querySelector('#dominant-hand-select');
  const holdSlider = container.querySelector('#hold-ms-slider');
  const repeatSlider = container.querySelector('#repeat-delay-slider');
  const deadzoneSlider = container.querySelector('#deadzone-slider-advanced');
  const smoothnessSlider = container.querySelector('#smoothness-slider');

  if (dominantHand && document.activeElement !== dominantHand) dominantHand.value = c.dominantHand;
  if (holdSlider && document.activeElement !== holdSlider) holdSlider.value = String(c.holdMs);
  if (repeatSlider && document.activeElement !== repeatSlider) repeatSlider.value = String(c.repeatDelayMs);
  if (deadzoneSlider && document.activeElement !== deadzoneSlider) deadzoneSlider.value = String(c.deadzone);
  if (smoothnessSlider && document.activeElement !== smoothnessSlider) smoothnessSlider.value = String(c.pointerSmoothness);
  syncRangeFill(holdSlider);
  syncRangeFill(repeatSlider);
  syncRangeFill(deadzoneSlider);
  syncRangeFill(smoothnessSlider);

  setText(container, '[data-role="hold-ms-value"]', `${Math.round(c.holdMs)}ms`);
  setText(container, '[data-role="repeat-delay-value"]', `${Math.round(c.repeatDelayMs)}ms`);
  setText(container, '[data-role="deadzone-value"]', `${Math.round(c.deadzone * 100)}%`);
  setText(container, '[data-role="smoothness-value"]', `${Math.round(c.pointerSmoothness * 100)}%`);
}

function ensureRemapPanel(container) {
  if (!container || container.dataset.ready === 'true') return;

  container.innerHTML = `
    <div class="control-card">
      <div class="control-card-head">
        <div>
          <p class="control-label">Remapping</p>
          <h3>Gesture Actions</h3>
        </div>
        <button id="reset-remaps-btn" type="button" class="control-toggle">Reset</button>
      </div>
      <p class="control-muted">Changes apply to the current effective pack: <strong data-role="effective-pack-name"></strong>.</p>
      <div class="remap-grid" id="remap-grid"></div>
    </div>
  `;

  const remapGrid = container.querySelector('#remap-grid');
  if (remapGrid) {
    remapGrid.innerHTML = gestures
      .map(
        (gesture) => `
          <label class="remap-row">
            <span class="remap-gesture">${escapeHtml(getGestureName(gesture))}</span>
            <select class="control-select" data-gesture="${escapeHtml(gesture)}"></select>
          </label>
        `
      )
      .join('');
  }

  remapGrid?.addEventListener('change', (event) => {
    const select = event.target.closest('select[data-gesture]');
    if (!select) return;
    const effectivePackId = container.dataset.effectivePackId;
    setGestureRemap(effectivePackId, select.dataset.gesture, select.value);
  });

  container.querySelector('#reset-remaps-btn')?.addEventListener('click', () => {
    if (container.dataset.effectivePackId) {
      resetPackRemaps(container.dataset.effectivePackId);
    }
  });

  container.dataset.ready = 'true';
}

function renderRemapPanel(state) {
  const container = document.getElementById('remap-control-panel');
  if (!container) return;
  ensureRemapPanel(container);

  container.dataset.effectivePackId = state.effectivePackId;
  setText(container, '[data-role="effective-pack-name"]', getPackName(state.effectivePackId));

  const actions = getActionEntries();
  container.querySelectorAll('select[data-gesture]').forEach((select) => {
    const gesture = select.dataset.gesture;
    const currentAction = getGestureAction(gesture);
    const optionsMarkup = actions
      .map(
        (action) =>
          `<option value="${escapeHtml(action.id)}" ${currentAction === action.id ? 'selected' : ''}>${escapeHtml(action.label)}</option>`
      )
      .join('');

    if (select.innerHTML !== optionsMarkup) {
      select.innerHTML = optionsMarkup;
    } else if (select.value !== currentAction) {
      select.value = currentAction;
    }
  });
}

function renderSummary(state) {
  const packEl = document.getElementById('active-pack-chip');
  const appEl = document.getElementById('active-app-chip');
  const automationEl = document.getElementById('automation-chip');
  if (packEl) packEl.textContent = state.effectivePack.name;
  if (appEl) appEl.textContent = state.context.appLabel;
  if (automationEl) automationEl.textContent = state.automationEnabled ? 'Auto routing on' : 'Auto routing off';
}

export function initControlUi() {
  return subscribeControlState((state) => {
    renderWorkflowPanel(state);
    renderContextPanel(state);
    renderCalibrationPanel(state);
    renderRemapPanel(state);
    renderSummary(state);
  });
}
