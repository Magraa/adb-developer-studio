/**
 * ADB Developer Studio - Main Frontend Controller
 */

// State
const state = {
  activeTab: 'devices',
  devices: [],
  selectedDevice: '',
  recentDevices: [],
  projects: [],
  currentScreenshotB64: '',
  currentScreenshotPath: '',
  logcatStreaming: false,
  logcatTimer: null,
  installedPackages: []
};

// UI Elements
const el = {
  navItems: document.querySelectorAll('.nav-item'),
  tabViews: document.querySelectorAll('.tab-view'),
  deviceSelect: document.getElementById('device-select'),
  statusPulse: document.getElementById('status-pulse'),
  selectedDeviceName: document.getElementById('selected-device-name'),
  selectedDeviceSub: document.getElementById('selected-device-sub'),
  btnRefreshDevices: document.getElementById('btn-refresh-devices'),
  
  // Wireless
  inputIp: document.getElementById('input-ip'),
  inputPort: document.getElementById('input-port'),
  btnConnectWireless: document.getElementById('btn-connect-wireless'),
  inputPairTarget: document.getElementById('input-pair-target'),
  inputPairCode: document.getElementById('input-pair-code'),
  btnPairWireless: document.getElementById('btn-pair-wireless'),
  recentDevicesList: document.getElementById('recent-devices-list'),
  
  // Projects
  btnAddProject: document.getElementById('btn-add-project'),
  projectsContainer: document.getElementById('projects-container'),
  apkDropZone: document.getElementById('apk-drop-zone'),
  btnBrowseApk: document.getElementById('btn-browse-apk'),

  // Screenshot & Rec
  btnTakeScreenshotMain: document.getElementById('btn-take-screenshot-main'),
  btnQuickScreenshot: document.getElementById('btn-quick-screenshot'),
  btnRecordScreen: document.getElementById('btn-record-screen'),
  btnCopyClipboard: document.getElementById('btn-copy-clipboard'),
  btnOpenScreenshotsFolder: document.getElementById('btn-open-screenshots-folder'),
  lblScreenshotDir: document.getElementById('lbl-screenshot-dir'),
  btnChangeSaveDir: document.getElementById('btn-change-save-dir'),
  screenshotImg: document.getElementById('screenshot-img'),
  screenshotPreviewContainer: document.getElementById('screenshot-preview-container'),

  // Logcat
  btnToggleLogcat: document.getElementById('btn-toggle-logcat'),
  lblLogcatToggle: document.getElementById('lbl-logcat-toggle'),
  btnClearLogcat: document.getElementById('btn-clear-logcat'),
  logcatSearch: document.getElementById('logcat-search'),
  logcatLevel: document.getElementById('logcat-level'),
  logcatTerminal: document.getElementById('logcat-terminal'),

  // App Mgr
  appPackageSelect: document.getElementById('app-package-select'),
  inputCustomPackage: document.getElementById('input-custom-package'),
  btnRefreshApps: document.getElementById('btn-refresh-apps'),
  btnAppClear: document.getElementById('btn-app-clear'),
  btnAppStop: document.getElementById('btn-app-stop'),
  btnAppGrant: document.getElementById('btn-app-grant'),
  btnAppUninstall: document.getElementById('btn-app-uninstall'),
  inputDeeplinkUri: document.getElementById('input-deeplink-uri'),
  btnLaunchDeeplink: document.getElementById('btn-launch-deeplink'),

  // Diagnostics & Toggles
  btnRefreshStats: document.getElementById('btn-refresh-stats'),
  chkLayoutBounds: document.getElementById('chk-layout-bounds'),
  chkPointerLocation: document.getElementById('chk-pointer-location'),
  chkStayAwake: document.getElementById('chk-stay-awake'),
  inputDpi: document.getElementById('input-dpi'),
  btnApplyDpi: document.getElementById('btn-apply-dpi'),
  btnResetDpi: document.getElementById('btn-reset-dpi'),
  
  // Stats
  statModel: document.getElementById('stat-model'),
  statAndroid: document.getElementById('stat-android'),
  statBattery: document.getElementById('stat-battery'),
  statResolution: document.getElementById('stat-resolution'),
  statStorage: document.getElementById('stat-storage'),

  toastContainer: document.getElementById('toast-container')
};

// Toast Notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  el.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// PyWebView Native Bridge Call Helper
async function callBridge(fnName, ...args) {
  if (window.pywebview && window.pywebview.api && window.pywebview.api[fnName]) {
    try {
      return await window.pywebview.api[fnName](...args);
    } catch (err) {
      console.error(`Bridge Error [${fnName}]:`, err);
      showToast(`Error calling ${fnName}`, 'error');
      return null;
    }
  } else {
    console.warn(`Bridge function [${fnName}] not ready yet.`);
    return null;
  }
}

// Navigation Tabs
el.navItems.forEach(item => {
  item.addEventListener('click', () => {
    const tabName = item.getAttribute('data-tab');
    switchTab(tabName);
  });
});

function switchTab(tabName) {
  state.activeTab = tabName;
  el.navItems.forEach(n => n.classList.toggle('active', n.getAttribute('data-tab') === tabName));
  el.tabViews.forEach(v => v.classList.toggle('active', v.id === `tab-${tabName}`));

  if (tabName === 'projects') loadProjects();
  if (tabName === 'appmgr') loadPackages();
  if (tabName === 'uitoggles') loadDiagnostics();
}

// Device Selection & Loading
async function refreshDevices() {
  const devices = await callBridge('get_devices') || [];
  state.devices = devices;
  
  el.deviceSelect.innerHTML = '';
  if (devices.length === 0) {
    el.deviceSelect.innerHTML = '<option value="">No devices attached</option>';
    state.selectedDevice = '';
    updateActiveDeviceCard(null);
  } else {
    devices.forEach((dev, idx) => {
      const opt = document.createElement('option');
      opt.value = dev.serial;
      opt.innerText = `${dev.model} (${dev.serial}) [${dev.connection.toUpperCase()}]`;
      el.deviceSelect.appendChild(opt);
    });
    
    if (!state.selectedDevice || !devices.some(d => d.serial === state.selectedDevice)) {
      state.selectedDevice = devices[0].serial;
    }
    el.deviceSelect.value = state.selectedDevice;
    const current = devices.find(d => d.serial === state.selectedDevice);
    updateActiveDeviceCard(current);
  }
  
  loadRecentDevices();
}

function updateActiveDeviceCard(device) {
  if (device) {
    el.statusPulse.className = 'status-pulse online';
    el.selectedDeviceName.innerText = device.model || device.serial;
    el.selectedDeviceSub.innerText = `${device.serial} • ${device.connection.toUpperCase()}`;
  } else {
    el.statusPulse.className = 'status-pulse offline';
    el.selectedDeviceName.innerText = 'No Target';
    el.selectedDeviceSub.innerText = 'Connect via USB / IP';
  }
}

el.deviceSelect.addEventListener('change', (e) => {
  state.selectedDevice = e.target.value;
  const current = state.devices.find(d => d.serial === state.selectedDevice);
  updateActiveDeviceCard(current);
});

el.btnRefreshDevices.addEventListener('click', refreshDevices);

// Wireless Connection & Recent Devices
el.btnConnectWireless.addEventListener('click', async () => {
  const ip = el.inputIp.value.trim();
  const port = el.inputPort.value.trim() || '5555';
  if (!ip) {
    showToast('Please enter device IP address', 'error');
    return;
  }

  showToast(`Connecting to ${ip}:${port}...`, 'info');
  const res = await callBridge('connect_wireless', ip, port);
  if (res && res.success) {
    showToast(res.message, 'success');
    await refreshDevices();
  } else {
    showToast(res ? res.message : 'Connection failed', 'error');
  }
});

el.btnPairWireless.addEventListener('click', async () => {
  const target = el.inputPairTarget.value.trim();
  const code = el.inputPairCode.value.trim();
  if (!target || !code) {
    showToast('Enter pairing IP:Port and 6-digit pairing code', 'error');
    return;
  }
  const parts = target.split(':');
  if (parts.length !== 2) {
    showToast('Pairing target must be IP:Port format (e.g. 192.168.1.50:37123)', 'error');
    return;
  }

  showToast(`Pairing with ${target}...`, 'info');
  const res = await callBridge('pair_wireless', parts[0], parts[1], code);
  if (res && res.success) {
    showToast(res.message, 'success');
    loadRecentDevices();
  } else {
    showToast(res ? res.message : 'Pairing failed', 'error');
  }
});

async function loadRecentDevices() {
  const recents = await callBridge('get_recent_devices') || [];
  state.recentDevices = recents;
  el.recentDevicesList.innerHTML = '';

  if (recents.length === 0) {
    el.recentDevicesList.innerHTML = '<div class="empty-state">No recent devices saved yet.</div>';
    return;
  }

  recents.forEach(item => {
    const card = document.createElement('div');
    card.className = 'device-card';
    card.innerHTML = `
      <div class="dev-card-info">
        <span class="dev-card-title">${item.alias || item.ip}</span>
        <span class="dev-card-ip">${item.ip}:<span class="port-val">${item.port}</span></span>
      </div>
      <div class="dev-card-actions">
        <button class="btn btn-secondary btn-sm btn-reconnect">Reconnect</button>
        <button class="btn btn-outline btn-sm btn-edit-port" title="Edit Port">Edit Port</button>
        <button class="icon-btn-sm btn-remove-recent" title="Remove">✕</button>
      </div>
    `;

    card.querySelector('.btn-reconnect').addEventListener('click', async () => {
      showToast(`Connecting to ${item.ip}:${item.port}...`, 'info');
      const res = await callBridge('connect_wireless', item.ip, item.port);
      if (res && res.success) {
        showToast(res.message, 'success');
        refreshDevices();
      } else {
        showToast(res ? res.message : 'Connection failed. Update port if dynamic.', 'error');
      }
    });

    card.querySelector('.btn-edit-port').addEventListener('click', async () => {
      const newPort = prompt(`Update Wireless Port for ${item.ip}:`, item.port);
      if (newPort && newPort.trim() !== item.port) {
        await callBridge('update_recent_device_port', item.ip, item.port, newPort.trim());
        loadRecentDevices();
        showToast('Port updated!', 'success');
      }
    });

    card.querySelector('.btn-remove-recent').addEventListener('click', async () => {
      await callBridge('remove_recent_device', item.ip, item.port);
      loadRecentDevices();
    });

    el.recentDevicesList.appendChild(card);
  });
}

// Dev Projects & APKs
async function loadProjects() {
  const projects = await callBridge('get_projects') || [];
  state.projects = projects;
  el.projectsContainer.innerHTML = '';

  if (projects.length === 0) {
    el.projectsContainer.innerHTML = '<div class="empty-state">No project folders added. Click "Add Project Folder" to scan built APKs.</div>';
    return;
  }

  projects.forEach(p => {
    const card = document.createElement('div');
    card.className = 'project-card';
    
    let apkRowsHTML = '';
    if (p.apks && p.apks.length > 0) {
      apkRowsHTML = p.apks.map(apk => `
        <div class="apk-item">
          <div>
            <div class="apk-name">📦 ${apk.name}</div>
            <div class="apk-meta">${apk.relative_path} • ${apk.size_mb} MB • Built: ${apk.modified_str}</div>
          </div>
          <button class="btn btn-primary btn-sm btn-install-apk" data-apk-path="${apk.path}">
            ⚡ Install to Phone
          </button>
        </div>
      `).join('');
    } else {
      apkRowsHTML = '<div class="subtext margin-top-sm">No .apk files found in this project\'s build output folder.</div>';
    }

    card.innerHTML = `
      <div class="project-card-header">
        <div>
          <div class="project-title">📁 ${p.name}</div>
          <div class="project-path">${p.path}</div>
        </div>
        <button class="btn btn-outline btn-sm btn-remove-proj">Remove</button>
      </div>
      <div class="apk-list">
        ${apkRowsHTML}
      </div>
    `;

    card.querySelectorAll('.btn-install-apk').forEach(b => {
      b.addEventListener('click', async () => {
        const apkPath = b.getAttribute('data-apk-path');
        installApk(apkPath);
      });
    });

    card.querySelector('.btn-remove-proj').addEventListener('click', async () => {
      await callBridge('remove_project', p.path);
      loadProjects();
    });

    el.projectsContainer.appendChild(card);
  });
}

el.btnAddProject.addEventListener('click', async () => {
  const proj = await callBridge('add_project');
  if (proj) {
    showToast(`Added project: ${proj.name}`, 'success');
    loadProjects();
  }
});

// Drag & Drop APK File
el.apkDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  el.apkDropZone.classList.add('drag-over');
});

el.apkDropZone.addEventListener('dragleave', () => {
  el.apkDropZone.classList.remove('drag-over');
});

el.apkDropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  el.apkDropZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    if (file.name.endsWith('.apk')) {
      installApk(file.path);
    } else {
      showToast('Please drop a valid .apk file', 'error');
    }
  }
});

el.btnBrowseApk.addEventListener('click', async () => {
  const apkPath = await callBridge('select_apk_file');
  if (apkPath) {
    installApk(apkPath);
  }
});

async function installApk(apkPath) {
  if (!state.selectedDevice) {
    showToast('Select a connected target device first!', 'error');
    return;
  }
  showToast(`Installing APK to ${state.selectedDevice}... Please wait.`, 'info');
  const res = await callBridge('install_apk', state.selectedDevice, apkPath);
  if (res && res.success) {
    showToast(res.message, 'success');
  } else {
    showToast(res ? res.message : 'Installation failed', 'error');
  }
}

// Screenshot & Recording
async function takeScreenshot() {
  if (!state.selectedDevice) {
    showToast('Select a target device first!', 'error');
    return;
  }
  showToast('Capturing screenshot...', 'info');
  const res = await callBridge('take_screenshot', state.selectedDevice);
  if (res && res.success) {
    state.currentScreenshotB64 = res.image_data;
    state.currentScreenshotPath = res.file_path;
    
    el.screenshotImg.src = res.image_data;
    el.screenshotImg.classList.remove('hidden');
    
    const placeholder = el.screenshotPreviewContainer.querySelector('.preview-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    el.btnCopyClipboard.disabled = false;
    showToast('Screenshot captured & saved!', 'success');
  } else {
    showToast(res ? res.error : 'Screenshot failed', 'error');
  }
}

el.btnTakeScreenshotMain.addEventListener('click', takeScreenshot);
el.btnQuickScreenshot.addEventListener('click', takeScreenshot);

// Copy Image to Clipboard
el.btnCopyClipboard.addEventListener('click', async () => {
  if (!state.currentScreenshotB64) return;

  try {
    const response = await fetch(state.currentScreenshotB64);
    const blob = await response.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob })
    ]);
    showToast('Screenshot copied to clipboard!', 'success');
  } catch (err) {
    console.error('Clipboard copy error:', err);
    showToast('Failed to copy to clipboard directly. Image file is saved on disk.', 'error');
  }
});

el.btnRecordScreen.addEventListener('click', async () => {
  if (!state.selectedDevice) {
    showToast('Select target device first!', 'error');
    return;
  }
  showToast('Recording screen for 15s... Do not disconnect phone.', 'info');
  const res = await callBridge('record_screen', state.selectedDevice, 15);
  if (res && res.success) {
    showToast(`Recording saved: ${res.file_path}`, 'success');
  } else {
    showToast(res ? res.error : 'Screen recording failed', 'error');
  }
});

async function updateScreenshotDirLabel() {
  const dir = await callBridge('get_screenshot_dir') || '';
  el.lblScreenshotDir.innerText = dir;
}

el.btnOpenScreenshotsFolder.addEventListener('click', () => callBridge('open_folder'));
el.btnChangeSaveDir.addEventListener('click', async () => {
  const folder = await callBridge('select_folder');
  if (folder) {
    await callBridge('set_screenshot_dir', folder);
    updateScreenshotDirLabel();
    showToast('Screenshot save directory updated', 'success');
  }
});

// Logcat Console
el.btnToggleLogcat.addEventListener('click', () => {
  if (state.logcatStreaming) {
    stopLogcat();
  } else {
    startLogcat();
  }
});

function startLogcat() {
  if (!state.selectedDevice) {
    showToast('Select a target device first!', 'error');
    return;
  }
  state.logcatStreaming = true;
  el.lblLogcatToggle.innerText = 'Pause Stream';
  el.btnToggleLogcat.className = 'btn btn-warning btn-sm';
  
  fetchLogcatLogs();
  state.logcatTimer = setInterval(fetchLogcatLogs, 2000);
}

function stopLogcat() {
  state.logcatStreaming = false;
  el.lblLogcatToggle.innerText = 'Start Stream';
  el.btnToggleLogcat.className = 'btn btn-secondary btn-sm';
  if (state.logcatTimer) clearInterval(state.logcatTimer);
}

async function fetchLogcatLogs() {
  if (!state.selectedDevice || !state.logcatStreaming) return;
  const filterTag = el.logcatSearch.value.trim();
  const minLevel = el.logcatLevel.value;

  const logs = await callBridge('fetch_logcat', state.selectedDevice, 100, filterTag, minLevel) || [];
  
  if (logs.length > 0) {
    logs.forEach(line => {
      const lineDiv = document.createElement('div');
      let lvlClass = 'verbose';
      if (line.includes(' D/ ') || line.includes(' D ')) lvlClass = 'debug';
      else if (line.includes(' I/ ') || line.includes(' I ')) lvlClass = 'info';
      else if (line.includes(' W/ ') || line.includes(' W ')) lvlClass = 'warn';
      else if (line.includes(' E/ ') || line.includes(' E ')) lvlClass = 'error';
      
      lineDiv.className = `log-line ${lvlClass}`;
      lineDiv.innerText = line;
      el.logcatTerminal.appendChild(lineDiv);
    });

    // Auto-scroll to bottom
    el.logcatTerminal.scrollTop = el.logcatTerminal.scrollHeight;
  }
}

el.btnClearLogcat.addEventListener('click', () => {
  el.logcatTerminal.innerHTML = '';
});

// App Manager & Deep Links
async function loadPackages() {
  if (!state.selectedDevice) return;
  const packages = await callBridge('list_installed_packages', state.selectedDevice) || [];
  state.installedPackages = packages;
  
  el.appPackageSelect.innerHTML = '<option value="">Select Package...</option>';
  packages.forEach(pkg => {
    const opt = document.createElement('option');
    opt.value = pkg;
    opt.innerText = pkg;
    el.appPackageSelect.appendChild(opt);
  });
}

function getSelectedPackage() {
  return el.inputCustomPackage.value.trim() || el.appPackageSelect.value;
}

el.btnRefreshApps.addEventListener('click', loadPackages);

el.btnAppClear.addEventListener('click', async () => {
  const pkg = getSelectedPackage();
  if (!pkg) return showToast('Select or type a package name', 'error');
  const res = await callBridge('clear_app_data', state.selectedDevice, pkg);
  showToast(res && res.success ? `Cleared data for ${pkg}` : 'Failed to clear data', res && res.success ? 'success' : 'error');
});

el.btnAppStop.addEventListener('click', async () => {
  const pkg = getSelectedPackage();
  if (!pkg) return showToast('Select or type a package name', 'error');
  const res = await callBridge('force_stop_app', state.selectedDevice, pkg);
  showToast(res && res.success ? `Force stopped ${pkg}` : 'Failed to force stop', res && res.success ? 'success' : 'error');
});

el.btnAppGrant.addEventListener('click', async () => {
  const pkg = getSelectedPackage();
  if (!pkg) return showToast('Select or type a package name', 'error');
  showToast(`Granting runtime permissions for ${pkg}...`, 'info');
  const res = await callBridge('grant_all_permissions', state.selectedDevice, pkg);
  showToast(res ? res.message : 'Grant permissions failed', res && res.success ? 'success' : 'error');
});

el.btnAppUninstall.addEventListener('click', async () => {
  const pkg = getSelectedPackage();
  if (!pkg) return showToast('Select or type a package name', 'error');
  if (confirm(`Are you sure you want to uninstall ${pkg}?`)) {
    const res = await callBridge('uninstall_package', state.selectedDevice, pkg);
    showToast(res && res.success ? `Uninstalled ${pkg}` : 'Uninstall failed', res && res.success ? 'success' : 'error');
    loadPackages();
  }
});

el.btnLaunchDeeplink.addEventListener('click', async () => {
  const uri = el.inputDeeplinkUri.value.trim();
  if (!uri) return showToast('Enter deep link URI (e.g. myapp://screen)', 'error');
  const res = await callBridge('launch_deep_link', state.selectedDevice, uri);
  showToast(res && res.success ? `Launched deep link: ${uri}` : 'Failed to launch deep link', res && res.success ? 'success' : 'error');
});

// UI System Toggles & Diagnostics
async function loadDiagnostics() {
  if (!state.selectedDevice) return;
  const info = await callBridge('get_device_info', state.selectedDevice);
  if (info) {
    el.statModel.innerText = `${info.manufacturer} ${info.model}`;
    el.statAndroid.innerText = `Android ${info.android_version} (API ${info.api_level})`;
    el.statBattery.innerText = `${info.battery_level} (${info.battery_status})`;
    el.statResolution.innerText = info.resolution;
    el.statStorage.innerText = info.storage_free;
  }
}

el.btnRefreshStats.addEventListener('click', loadDiagnostics);

el.chkLayoutBounds.addEventListener('change', async (e) => {
  if (!state.selectedDevice) return;
  await callBridge('set_layout_bounds', state.selectedDevice, e.target.checked);
  showToast(`Layout bounds ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
});

el.chkPointerLocation.addEventListener('change', async (e) => {
  if (!state.selectedDevice) return;
  await callBridge('set_pointer_location', state.selectedDevice, e.target.checked);
  showToast(`Pointer location ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
});

el.chkStayAwake.addEventListener('change', async (e) => {
  if (!state.selectedDevice) return;
  await callBridge('set_stay_awake', state.selectedDevice, e.target.checked);
  showToast(`Stay awake ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
});

el.btnApplyDpi.addEventListener('click', async () => {
  const dpi = el.inputDpi.value.trim();
  if (!dpi) return;
  await callBridge('set_display_density', state.selectedDevice, dpi);
  showToast(`Applied density DPI: ${dpi}`, 'success');
  loadDiagnostics();
});

el.btnResetDpi.addEventListener('click', async () => {
  await callBridge('set_display_density', state.selectedDevice, 'reset');
  showToast('Reset display density to default', 'success');
  loadDiagnostics();
});

// Init on Load
window.addEventListener('pywebviewready', () => {
  refreshDevices();
  updateScreenshotDirLabel();
});

// Fallback init if pywebview is already attached
setTimeout(() => {
  refreshDevices();
  updateScreenshotDirLabel();
}, 600);
