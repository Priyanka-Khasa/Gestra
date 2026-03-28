const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src', 'actions.js');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/if \(response\?\.ok !== false\) \{\s*return \{ ok: true, via: 'electron' \};\s*\}/g,
  `if (response?.ok !== false) { return { ok: true, via: 'electron' }; } return { ok: false, via: 'electron', message: response?.message };`);

code = code.replace(/catch \(error\) \{\s*console\.warn\('\\[Gestra\/Renderer\\] electron performAction failed:', error\);\s*\}/g,
  `catch (error) { console.warn('[Gestra/Renderer] electron performAction failed:', error); return { ok: false, via: 'electron', message: String(error?.message || error) }; }`);

code = code.replace(/if \(response\?\.ok\) \{\s*return \{ ok: true, via: 'python' \};\s*\}/g,
  `if (response?.ok) { return { ok: true, via: 'python' }; } return { ok: false, via: 'python', message: response?.message };`);

code = code.replace(/catch \(error\) \{\s*console\.warn\('\\[Gestra\/Renderer\\] pythonBridge IPC failed:', error\);\s*\}/,
  `catch (error) { console.warn('[Gestra/Renderer] pythonBridge IPC failed:', error); return { ok: false, via: 'python', message: String(error?.message || error) }; }`);

code = code.replace(
  /if \(!silent\) \{\s*const detail = String\(error\?.message \|\| error \|\| ''\)\.trim\(\);\s*if \(detail\.includes\('No action backend available'\)\) \{\s*showToast\(getBackendUnavailableMessage\(label\)\);\s*\} else \{\s*showToast\(\`Action failed: \$\{label\}\`\);\s*\}\s*\}/,
  `if (!silent) {
      const detail = String(error?.message || error || '').trim();
      if (detail.includes('No action backend available')) {
        showToast(getBackendUnavailableMessage(label));
      } else if (detail.includes('Action logic failed:')) {
        showToast(\`Action failed: \${label} - \${detail.replace(/Error:?\\s*Action logic failed:\\s*/, '').trim()}\`);
      } else {
        showToast(\`Action failed: \${label}\`);
      }
    }`
);

code = code.replace(
  /async function invokePerformAction.*?throw new Error\(\`No action backend available for "\$\{action\}"\.\`\);\n\}/s,
  `async function invokePerformAction(action, options = null, { silent = false } = {}) {
  await yieldFocusForExternalAction(action);
  let lastError = null;
  if (window.electronAPI?.performAction && prefersElectronDesktopRoute(action)) {
    const electronResult = await tryElectronAction(action, options);
    if (electronResult.ok) return electronResult;
    if (electronResult.message) lastError = electronResult.message;
  }
  if (pythonVisionCollective) {
    const electronResult = await tryElectronAction(action, options);
    if (electronResult.ok) return electronResult;
    if (electronResult.message) lastError = electronResult.message;
  }
  const bridgeBase = normalizeBaseUrl(DEFAULT_PYTHON_BRIDGE_URL);
  const pythonResult = await tryPythonBridgeAction(action, options, bridgeBase);
  if (pythonResult.ok) return pythonResult;
  if (pythonResult.message) lastError = pythonResult.message;
  const electronResult2 = await tryElectronAction(action, options);
  if (electronResult2.ok) return electronResult2;
  if (electronResult2.message) lastError = electronResult2.message;
  const rendererResult = await tryRendererFallback(action);
  if (rendererResult.ok) return rendererResult;
  if (!silent) {
    if (lastError) console.warn(\`[Gestra/Renderer] Action logic failed: \${lastError}\`);
    else console.warn(\`[Gestra/Renderer] No backend available for action "\${action}"\`);
  }
  if (lastError) throw new Error(\`Action logic failed: \${lastError}\`);
  throw new Error(\`No action backend available for "\${action}".\`);
}`
);

fs.writeFileSync(file, code);
console.log('Fixed actions.js');
