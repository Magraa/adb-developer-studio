/**
 * ADB Developer Studio - Modern Frontend Controller
 * Redesigned according to UI Plan & Reference PNG Design Specification
 */

// State
const state = {
  activeTab: 'dashboard',
  devices: [],
  selectedDevice: '',
  recentDevices: [],
  projects: [],
  activityLog: [],
  currentScreenshotB64: '',
  currentScreenshotPath: '',
  installedPackages: []
};

// UI Element Map
const el = {
  navItems: document.querySelectorAll('.nav-item'),
  tabViews: document.querySelectorAll('.tab-view'),
  pageTitle: document.getElementById('page-title'),
  pageSubtitle: document.getElementById('page-subtitle'),
  deviceSelect: document.getElementById('device-select'),
  
  // Header Buttons
  btnHeaderPair: document.getElementById('btn-header-pair'),
  btnHeaderConnect: document.getElementById('btn-header-connect'),
  btnCommandPaletteTrigger: document.getElementById('btn-command-palette-trigger'),
  commandPaletteModal: document.getElementById('command-palette-modal'),
  paletteSearchInput: document.getElementById('palette-search-input'),
  btnRestartAdb: document.getElementById('btn-restart-adb'),

  // Hero Card Elements
  heroModelTitle: document.getElementById('hero-model-title'),
  heroMfrSub: document.getElementById('hero-mfr-sub'),
  heroTagOs: document.getElementById('hero-tag-os'),
  heroTagConn: document.getElementById('hero-tag-conn'),
  heroTagSerial: document.getElementById('hero-tag-serial'),
  heroValBattery: document.getElementById('hero-val-battery'),
  heroValStorage: document.getElementById('hero-val-storage'),
  heroValResolution: document.getElementById('hero-val-resolution'),
  heroValModel: document.getElementById('hero-val-model'),
  
  // Hero Buttons
  heroBtnScreenshot: document.getElementById('hero-btn-screenshot'),
  heroBtnLogcat: document.getElementById('hero-btn-logcat'),
  heroBtnActions: document.getElementById('hero-btn-actions'),
  heroBtnShell: document.getElementById('hero-btn-shell'),
  heroBtnScrcpy: document.getElementById('hero-btn-scrcpy'),

  // Dashboard Columns
  dashRecentDevicesList: document.getElementById('dash-recent-devices-list'),
  dashRecentProjectsList: document.getElementById('dash-recent-projects-list'),
  activityTimelineList: document.getElementById('activity-timeline-list'),
  btnClearActivity: document.getElementById('btn-clear-activity'),
  btnGotoDevices: document.getElementById('btn-goto-devices'),
  btnGotoProjects: document.getElementById('btn-goto-projects'),

  // Devices Tab
  devTabRecentList: document.getElementById('dev-tab-recent-list'),
  devTabConnectedBanner: document.getElementById('dev-tab-connected-banner'),

  // Status Bar
  sbDeviceCount: document.getElementById('sb-device-count'),
  sbTargetName: document.getElementById('sb-target-name'),
  sbTargetOs: document.getElementById('sb-target-os'),
  sbTargetAddr: document.getElementById('sb-target-addr'),

  // Toast
  toastContainer: document.getElementById('toast-container')
};

// Titles for page header
const PAGE_TITLES = {
  dashboard: { title: 'Dashboard', subtitle: 'Everything you need for faster Android development.' },
  devices: { title: 'Devices', subtitle: 'Manage and connect your Android devices.' },
  projects: { title: 'Projects', subtitle: 'Add project folders and auto-detect built APKs.' },
  remote: { title: 'Remote & Mirror', subtitle: 'On-screen virtual hardware buttons and scrcpy mirroring.' },
  screenshot: { title: 'Capture', subtitle: 'Take screenshots, copy to clipboard, or record MP4 videos.' },
  files: { title: 'File Explorer', subtitle: 'Browse phone storage, push files, or pull files to PC.' },
  logcat: { title: 'Logcat', subtitle: 'Real-time logs from your Android device.' },
  appmgr: { title: 'Actions', subtitle: 'Clear data, force stop, grant permissions, or launch intents.' },
  uitoggles: { title: 'Testing', subtitle: 'Toggle layout bounds, touch points, DPI density, and battery status.' },
  terminal: { title: 'Terminal', subtitle: 'Execute custom ADB CLI commands or run developer snippets.' },
  settings: { title: 'Settings', subtitle: 'Configure ADB executable paths and capture directories.' }
};

// Toast Notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  el.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// Python Bridge Helper
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
    return null;
  }
}

// Activity Logging Helper
async function logActivity(title, details = '', typeIcon = 'info') {
  await callBridge('log_activity', title, details, typeIcon);
  loadActivityLog();
}

async function loadActivityLog() {
  const logs = await callBridge('get_activity_log') || [];
  state.activityLog = logs;
  if (!el.activityTimelineList) return;
  el.activityTimelineList.innerHTML = '';

  if (logs.length === 0) {
    el.activityTimelineList.innerHTML = '<div class="empty-state">No recent activity logged.</div>';
    return;
  }

  logs.forEach(log => {
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `
      <span class="act-time">${log.time}</span>
      <div>
        <span class="act-title">${log.title}</span>
        ${log.details ? `<span class="act-sub">${log.details}</span>` : ''}
      </div>
    `;
    el.activityTimelineList.appendChild(item);
  });
}

if (el.btnClearActivity) {
  el.btnClearActivity.addEventListener('click', async () => {
    await callBridge('clear_activity_log');
    loadActivityLog();
  });
}

// Tab Switching
el.navItems.forEach(item => {
  item.addEventListener('click', () => {
    const tabName = item.getAttribute('data-tab');
    switchTab(tabName);
  });
});

function switchTab(tabName) {
  const prevTab = state.activeTab;
  state.activeTab = tabName;
  el.navItems.forEach(n => n.classList.toggle('active', n.getAttribute('data-tab') === tabName));
  el.tabViews.forEach(v => v.classList.toggle('active', v.id === `tab-${tabName}`));

  if (PAGE_TITLES[tabName]) {
    el.pageTitle.innerText = PAGE_TITLES[tabName].title;
    el.pageSubtitle.innerText = PAGE_TITLES[tabName].subtitle;
  }

  if (tabName === 'dashboard') { loadDashboardData(); }
  if (tabName === 'devices') { loadDevicesTab(); }
  if (tabName === 'projects') { loadProjects(); }
  if (tabName === 'screenshot') { loadCaptureTabData(); }
  if (tabName === 'files') {
    renderFMTree(fmState.currentPath);
    updateFMDeviceInfo();
    loadFiles(fmState.currentPath);
  }
  if (tabName === 'terminal') { loadSnippets(); }
  if (tabName === 'appmgr') { loadPackages(); }
  if (tabName === 'uitoggles') { loadDiagnostics(); }
  if (tabName === 'logcat') { onEnterLogcatTab(); }
  if (prevTab === 'logcat' && tabName !== 'logcat') { onLeaveLogcatTab(); }
}


// Device Selection & Hero Card Population
async function refreshDevices() {
  const devices = await callBridge('get_devices') || [];
  state.devices = devices;
  
  el.deviceSelect.innerHTML = '';
  if (devices.length === 0) {
    el.deviceSelect.innerHTML = '<option value="">No devices attached</option>';
    state.selectedDevice = '';
    updateDeviceHeroCard(null);
    renderConnectedDeviceBanner(null);
    if (state.deviceInfoPollTimer) { clearInterval(state.deviceInfoPollTimer); state.deviceInfoPollTimer = null; }
  } else {
    devices.forEach(dev => {
      const opt = document.createElement('option');
      opt.value = dev.serial.trim();
      opt.innerText = `${dev.model || dev.serial} (${dev.connection.toUpperCase()})`;
      el.deviceSelect.appendChild(opt);
    });
    
    if (!state.selectedDevice || !devices.some(d => d.serial === state.selectedDevice)) {
      state.selectedDevice = devices[0].serial.trim();
    }
    el.deviceSelect.value = state.selectedDevice;
    const current = devices.find(d => d.serial === state.selectedDevice);
    updateDeviceHeroCard(current);
    renderConnectedDeviceBanner(current);
    startDeviceInfoPolling();
  }
  
  if (el.sbDeviceCount) el.sbDeviceCount.innerText = `${devices.length} DEVICE${devices.length === 1 ? '' : 'S'} CONNECTED`;
  loadRecentDevices();
}

async function updateDeviceHeroCard(device) {
  const setElText = (id, text) => {
    const element = document.getElementById(id);
    if (element) element.innerText = text;
  };

  if (device) {
    if (el.heroModelTitle) el.heroModelTitle.innerText = device.model || device.serial;
    if (el.heroMfrSub) el.heroMfrSub.innerText = device.product || 'Android Device';
    if (el.heroTagConn) el.heroTagConn.innerText = device.connection.toUpperCase();
    if (el.heroTagSerial) el.heroTagSerial.innerText = device.serial;

    setElText('dev-hero-title', device.model || device.serial);
    setElText('dev-hero-sub', device.product || 'Android Device');
    setElText('dev-tag-conn', device.connection.toUpperCase());
    setElText('dev-tag-serial', device.serial);

    if (el.sbTargetName) el.sbTargetName.innerText = `${device.model || device.serial} (${device.connection.toUpperCase()})`;
    if (el.sbTargetAddr) el.sbTargetAddr.innerText = device.serial;

    // Fetch live hardware details
    const info = await callBridge('get_device_info', device.serial);
    if (info) {
      if (el.heroTagOs) el.heroTagOs.innerText = `Android ${info.android_version}`;
      if (el.heroValBattery) el.heroValBattery.innerText = `${info.battery_level} (${info.battery_status})`;
      if (el.heroValStorage) el.heroValStorage.innerText = info.storage_free;
      if (el.heroValResolution) el.heroValResolution.innerText = info.resolution;
      if (el.heroValModel) el.heroValModel.innerText = info.model;

      setElText('dev-tag-os', `Android ${info.android_version}`);
      setElText('dev-val-battery', `${info.battery_level} (${info.battery_status})`);
      setElText('dev-val-storage', info.storage_free);
      setElText('dev-val-resolution', info.resolution);
      setElText('dev-val-model', info.model);
      setElText('dev-val-build', info.api_level ? `API ${info.api_level}` : 'AP4A.240905.003');

      if (el.sbTargetOs) el.sbTargetOs.innerText = `Android ${info.android_version}`;
    }
  } else {
    if (el.heroModelTitle) el.heroModelTitle.innerText = 'No Target Device';
    if (el.heroMfrSub) el.heroMfrSub.innerText = 'Connect USB cable or IP address';
    if (el.heroTagConn) el.heroTagConn.innerText = 'OFFLINE';
    if (el.heroTagSerial) el.heroTagSerial.innerText = 'NONE';
    if (el.heroValBattery) el.heroValBattery.innerText = '--';
    if (el.heroValStorage) el.heroValStorage.innerText = '--';
    if (el.heroValResolution) el.heroValResolution.innerText = '--';
    if (el.heroValModel) el.heroValModel.innerText = '--';

    setElText('dev-hero-title', 'No Target Device');
    setElText('dev-hero-sub', 'Connect USB cable or IP address');
    setElText('dev-tag-conn', 'OFFLINE');
    setElText('dev-tag-serial', 'NONE');
    setElText('dev-val-battery', '--');
    setElText('dev-val-storage', '--');
    setElText('dev-val-resolution', '--');
    setElText('dev-val-model', '--');
    setElText('dev-val-build', '--');

    if (el.sbTargetName) el.sbTargetName.innerText = 'No Target';
  }
}


function renderConnectedDeviceBanner(device) {
  if (!el.devTabConnectedBanner) return;
  if (device) {
    el.devTabConnectedBanner.innerHTML = `
      <div class="dash-device-row">
        <div>
          <div class="dash-dev-title">📱 ${device.model || device.serial} <span class="badge badge-indigo">${device.connection.toUpperCase()}</span></div>
          <div class="dash-dev-sub">Serial: ${device.serial}</div>
        </div>
        <div class="btn-group">
          <button class="btn btn-outline btn-xs btn-conn-screenshot">📸 Screenshot</button>
          <button class="btn btn-outline btn-xs btn-conn-logcat">▣ Logcat</button>
          <button class="btn btn-primary btn-xs btn-conn-mirror">🖥️ Screen Mirror</button>
        </div>
      </div>
    `;
    el.devTabConnectedBanner.querySelector('.btn-conn-screenshot').addEventListener('click', takeScreenshot);
    el.devTabConnectedBanner.querySelector('.btn-conn-logcat').addEventListener('click', () => switchTab('logcat'));
    el.devTabConnectedBanner.querySelector('.btn-conn-mirror').addEventListener('click', openScreenMirroring);
  } else {
    el.devTabConnectedBanner.innerHTML = `<div class="empty-state">No devices currently connected. Click "+ Connect Device" or "Pair Device" above.</div>`;
  }
}


el.deviceSelect.addEventListener('change', (e) => {
  state.selectedDevice = e.target.value;
  const current = state.devices.find(d => d.serial === state.selectedDevice);
  updateDeviceHeroCard(current);
  if (state.activeTab === 'logcat') onEnterLogcatTab();
});

// Dashboard Data Loading
async function loadDashboardData() {
  await refreshDevices();
  await loadActivityLog();
  loadRecentProjectsDash();
}

async function loadRecentProjectsDash() {
  const projects = await callBridge('get_projects') || [];
  if (!el.dashRecentProjectsList) return;
  el.dashRecentProjectsList.innerHTML = '';

  if (projects.length === 0) {
    el.dashRecentProjectsList.innerHTML = '<div class="empty-state">No projects added.</div>';
    return;
  }

  projects.slice(0, 3).forEach(p => {
    const row = document.createElement('div');
    row.className = 'dash-device-row';
    const apk = p.apks && p.apks.length > 0 ? p.apks[0] : null;
    row.innerHTML = `
      <div>
        <div class="dash-dev-title">📦 ${p.name}</div>
        <div class="dash-dev-sub">${apk ? apk.name : 'No build APK'}</div>
      </div>
      ${apk ? `<button class="btn btn-primary btn-xs btn-dash-install" data-apk="${apk.path}">Install</button>` : ''}
    `;

    if (apk) {
      row.querySelector('.btn-dash-install').addEventListener('click', () => installApk(apk.path));
    }
    el.dashRecentProjectsList.appendChild(row);
  });
}

async function loadRecentDevices() {
  const recents = await callBridge('get_recent_devices') || [];
  state.recentDevices = recents;
  
  if (el.dashRecentDevicesList) {
    el.dashRecentDevicesList.innerHTML = '';
    if (recents.length === 0) {
      el.dashRecentDevicesList.innerHTML = '<div class="empty-state">No recent devices saved.</div>';
    } else {
      recents.slice(0, 4).forEach(item => {
        const row = document.createElement('div');
        row.className = 'dash-device-row';
        row.innerHTML = `
          <div>
            <div class="dash-dev-title">${item.alias || item.ip}</div>
            <div class="dash-dev-sub">${item.ip}:<span class="port-edit-box" title="Click to edit port">${item.port}</span></div>
          </div>
          <button class="btn btn-secondary btn-xs btn-reconnect-dash">Reconnect</button>
        `;
        row.querySelector('.port-edit-box').addEventListener('click', async () => {
          const newPort = prompt(`Update Port for ${item.ip}:`, item.port);
          if (newPort && newPort.trim() !== item.port) {
            await callBridge('update_recent_device_port', item.ip, item.port, newPort.trim());
            loadRecentDevices();
          }
        });
        row.querySelector('.btn-reconnect-dash').addEventListener('click', () => reconnectWireless(item.ip, item.port));
        el.dashRecentDevicesList.appendChild(row);
      });
    }
  }

  if (el.devTabRecentList) {
    el.devTabRecentList.innerHTML = '';
    if (recents.length === 0) {
      el.devTabRecentList.innerHTML = '<div class="empty-state">No recent devices saved.</div>';
    } else {
      recents.forEach(item => {
        const card = document.createElement('div');
        card.className = 'dash-device-row margin-top-xs';
        card.innerHTML = `
          <div>
            <div class="dash-dev-title">📱 ${item.alias || item.ip}</div>
            <div class="dash-dev-sub">${item.ip} • Port: <span class="port-edit-box" title="Click to edit port">${item.port} ✎</span></div>
          </div>
          <div class="btn-group">
            <button class="btn btn-secondary btn-xs btn-reconnect-row">Reconnect</button>
            <button class="btn btn-outline btn-xs btn-remove-row">✕</button>
          </div>
        `;
        card.querySelector('.port-edit-box').addEventListener('click', async () => {
          const newPort = prompt(`Update Port for ${item.ip}:`, item.port);
          if (newPort && newPort.trim() !== item.port) {
            await callBridge('update_recent_device_port', item.ip, item.port, newPort.trim());
            loadRecentDevices();
          }
        });
        card.querySelector('.btn-reconnect-row').addEventListener('click', () => reconnectWireless(item.ip, item.port));
        card.querySelector('.btn-remove-row').addEventListener('click', async () => {
          await callBridge('remove_recent_device', item.ip, item.port);
          loadRecentDevices();
        });
        el.devTabRecentList.appendChild(card);
      });
    }
  }
}


async function reconnectWireless(ip, port) {
  showToast(`Connecting to ${ip}:${port}...`, 'info');
  const res = await callBridge('connect_wireless', ip, port);
  if (res && res.success) {
    showToast(res.message, 'success');
    logActivity('Device Connected', `${ip}:${port}`, 'device');
    refreshDevices();
  } else {
    showToast(res ? res.message : 'Connection failed', 'error');
  }
}

// Quick Actions Cards Click Listeners
document.getElementById('qa-install-apk').addEventListener('click', () => switchTab('projects'));
document.getElementById('qa-screenshot').addEventListener('click', () => takeScreenshot());
document.getElementById('qa-logcat').addEventListener('click', () => switchTab('logcat'));
document.getElementById('qa-app-actions').addEventListener('click', () => switchTab('appmgr'));
document.getElementById('qa-deeplink').addEventListener('click', () => switchTab('appmgr'));
document.getElementById('qa-clear-data').addEventListener('click', () => switchTab('appmgr'));

if (el.btnGotoDevices) el.btnGotoDevices.addEventListener('click', () => switchTab('devices'));
if (el.btnGotoProjects) el.btnGotoProjects.addEventListener('click', () => switchTab('projects'));

// Hero Bar Action Buttons (Safe Listeners)
if (el.heroBtnScreenshot) el.heroBtnScreenshot.addEventListener('click', () => takeScreenshot());
if (el.heroBtnLogcat) el.heroBtnLogcat.addEventListener('click', () => switchTab('logcat'));
if (el.heroBtnActions) el.heroBtnActions.addEventListener('click', () => switchTab('appmgr'));
if (el.heroBtnShell) el.heroBtnShell.addEventListener('click', () => switchTab('terminal'));
if (el.heroBtnScrcpy) el.heroBtnScrcpy.addEventListener('click', () => switchTab('remote'));

// Header & Modal Triggers with Safety Checks
const modalConn = document.getElementById('modal-wireless-connect');
const modalConnIp = document.getElementById('modal-conn-ip');
const modalConnPort = document.getElementById('modal-conn-port');
const btnSubmitConnModal = document.getElementById('btn-submit-conn-modal');
const btnCloseConnModal = document.getElementById('btn-close-conn-modal');
const btnCancelConnModal = document.getElementById('btn-cancel-conn-modal');

const modalPair = document.getElementById('modal-wireless-pair');
const modalSubtabQr = document.getElementById('modal-subtab-qr');
const modalSubtabManual = document.getElementById('modal-subtab-manual');
const modalViewPairQr = document.getElementById('modal-view-pair-qr');
const modalViewPairManual = document.getElementById('modal-view-pair-manual');
const modalQrImg = document.getElementById('modal-qr-img');
const modalQrCodeVal = document.getElementById('modal-qr-code-val');
const modalQrServiceVal = document.getElementById('modal-qr-service-val');
const modalBtnRefreshQr = document.getElementById('modal-btn-refresh-qr');
const modalPairTarget = document.getElementById('modal-pair-target');
const modalPairCode = document.getElementById('modal-pair-code');
const btnSubmitPairModal = document.getElementById('btn-submit-pair-modal');
const btnClosePairModal = document.getElementById('btn-close-pair-modal');
const btnCancelPairModal = document.getElementById('btn-cancel-pair-modal');

async function openConnectModal() {
  if (!modalConn) return;
  const localIp = await callBridge('get_local_ip') || '192.168.1.100';
  if (modalConnIp) modalConnIp.value = localIp;
  if (modalConnPort) modalConnPort.value = '5555';
  modalConn.classList.remove('hidden');
  if (modalConnIp) modalConnIp.focus();
}

function closeConnectModal() {
  if (modalConn) modalConn.classList.add('hidden');
}

async function openPairModal() {
  if (!modalPair) return;
  modalPair.classList.remove('hidden');
  generateModalQRPairing();
}

function closePairModal() {
  if (modalPair) modalPair.classList.add('hidden');
}

async function generateModalQRPairing() {
  const info = await callBridge('generate_qr_pairing_info');
  if (info && modalQrCodeVal && modalQrServiceVal && modalQrImg) {
    modalQrCodeVal.innerText = info.passcode;
    modalQrServiceVal.innerText = info.service_name;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(info.qr_payload)}`;
    modalQrImg.src = qrUrl;
  }
}

// Modal Toggle Listeners
if (modalSubtabQr && modalSubtabManual) {
  modalSubtabQr.addEventListener('click', () => {
    modalSubtabQr.classList.add('active');
    modalSubtabManual.classList.remove('active');
    if (modalViewPairQr) modalViewPairQr.classList.remove('hidden');
    if (modalViewPairManual) modalViewPairManual.classList.add('hidden');
  });

  modalSubtabManual.addEventListener('click', () => {
    modalSubtabManual.classList.add('active');
    modalSubtabQr.classList.remove('active');
    if (modalViewPairManual) modalViewPairManual.classList.remove('hidden');
    if (modalViewPairQr) modalViewPairQr.classList.add('hidden');
  });
}

if (modalBtnRefreshQr) modalBtnRefreshQr.addEventListener('click', generateModalQRPairing);

// Safe Event Listener Binder
function safeAddListener(idOrEl, event, handler) {
  const element = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  if (element) {
    element.addEventListener(event, handler);
  }
}

// Open Connect Triggers
safeAddListener(el.btnHeaderConnect, 'click', openConnectModal);
safeAddListener('btn-tab-connect', 'click', openConnectModal);
safeAddListener('btn-open-wireless-modal', 'click', openConnectModal);

// Open Pair Triggers
safeAddListener(el.btnHeaderPair, 'click', openPairModal);
safeAddListener('btn-tab-pair', 'click', openPairModal);
safeAddListener('btn-open-pairing-modal', 'click', openPairModal);

// Bottom Cards USB Scan Trigger
safeAddListener('btn-scan-usb', 'click', async () => {
  showToast('Scanning for USB devices...', 'info');
  await refreshDevices();
});

// Close Triggers
safeAddListener(btnCloseConnModal, 'click', closeConnectModal);
safeAddListener(btnCancelConnModal, 'click', closeConnectModal);
safeAddListener(btnClosePairModal, 'click', closePairModal);
safeAddListener(btnCancelPairModal, 'click', closePairModal);

// Connect Submission
safeAddListener(btnSubmitConnModal, 'click', async () => {
  const ip = modalConnIp ? modalConnIp.value.trim() : '';
  const port = modalConnPort && modalConnPort.value.trim() ? modalConnPort.value.trim() : '5555';
  if (!ip) return showToast('Please enter IP address', 'error');

  closeConnectModal();
  showToast(`Connecting to ${ip}:${port}...`, 'info');
  const res = await callBridge('connect_wireless', ip, port);
  if (res && res.success) {
    showToast(res.message, 'success');
    logActivity('Connected Wireless', `${ip}:${port}`, 'device');
    refreshDevices();
  } else {
    showToast(res ? res.message : 'Connection failed. Verify IP, port, and Wireless Debugging.', 'error');
  }
});

// Pair Submission
safeAddListener(btnSubmitPairModal, 'click', async () => {
  const target = modalPairTarget ? modalPairTarget.value.trim() : '';
  const code = modalPairCode ? modalPairCode.value.trim() : '';
  if (!target || !code) return showToast('Enter pairing IP:Port and 6-digit code', 'error');

  const parts = target.split(':');
  if (parts.length !== 2) return showToast('Format must be IP:Port (e.g. 192.168.1.50:37123)', 'error');

  closePairModal();
  showToast(`Pairing with ${target}...`, 'info');
  const res = await callBridge('pair_wireless', parts[0], parts[1], code);
  if (res && res.success) {
    showToast(res.message, 'success');
    logActivity('Paired Device', target, 'device');
    refreshDevices();
  } else {
    showToast(res ? res.message : 'Pairing failed. Verify IP:Port and 6-digit code.', 'error');
  }
});




// Restart ADB Server

if (el.btnRestartAdb) {
  el.btnRestartAdb.addEventListener('click', async () => {
    showToast('Restarting ADB Server...', 'info');
    const res = await callBridge('restart_adb_server');
    if (res && res.success) {
      showToast('ADB Server restarted successfully!', 'success');
      refreshDevices();
    } else {
      showToast('Failed to restart ADB server', 'error');
    }
  });
}

// Command Palette Modal (Ctrl + K)
function openCommandPalette() {
  el.commandPaletteModal.classList.remove('hidden');
  el.paletteSearchInput.focus();
}

function closeCommandPalette() {
  el.commandPaletteModal.classList.add('hidden');
}

if (el.btnCommandPaletteTrigger) {
  el.btnCommandPaletteTrigger.addEventListener('click', openCommandPalette);
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    openCommandPalette();
  }
  if (e.key === 'Escape') {
    closeCommandPalette();
  }
});

document.querySelectorAll('.palette-item').forEach(item => {
  item.addEventListener('click', () => {
    const action = item.getAttribute('data-action');
    closeCommandPalette();
    if (action === 'cmd-screenshot') takeScreenshot();
    if (action === 'cmd-install') switchTab('projects');
    if (action === 'cmd-logcat') switchTab('logcat');
    if (action === 'cmd-scrcpy') switchTab('remote');
    if (action === 'cmd-clear') switchTab('appmgr');
    if (action === 'cmd-stop') switchTab('appmgr');
    if (action === 'cmd-deeplink') switchTab('appmgr');
    if (action === 'cmd-restart') el.btnRestartAdb.click();
  });
});

// Projects Dashboard State & Controller
state.selectedProject = null;

async function loadProjects() {
  const projects = await callBridge('get_projects') || [];
  state.projects = projects;
  
  const container = document.getElementById('projects-list-container');
  if (!container) return;
  container.innerHTML = '';

  if (projects.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:40px">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;opacity:0.4"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <p>No project folders added. Click "Add Project" to get started.</p>
    </div>`;
    renderProjectDetails(null);
    renderBuildOutputs([]);
    updateBuildWatcher(projects);
    return;
  }

  // Search & Filter
  const filterType = document.getElementById('proj-filter-type')?.value || 'all';
  const sortBy = document.getElementById('proj-sort-by')?.value || 'last_built';
  const searchQuery = document.getElementById('proj-search')?.value.toLowerCase() || '';

  let filtered = projects.filter(p => {
    if (filterType !== 'all' && p.type !== filterType) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery) && !p.path.toLowerCase().includes(searchQuery)) return false;
    return true;
  });

  if (sortBy === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortBy === 'type') filtered.sort((a, b) => a.type.localeCompare(b.type));

  if (!state.selectedProject || !projects.some(p => p.path === state.selectedProject.path)) {
    state.selectedProject = filtered[0] || projects[0];
  }

  filtered.forEach(p => {
    const isSelected = state.selectedProject && state.selectedProject.path === p.path;
    const card = document.createElement('div');
    card.className = `proj-card${isSelected ? ' selected' : ''}`;
    card.dataset.path = p.path;

    // Framework icon & pill badge
    let iconHTML = '';
    let badgeClass = 'badge-android';
    if (p.type === 'Flutter') {
      badgeClass = 'badge-flutter';
      iconHTML = `<div class="proj-icon-wrapper proj-icon-flutter">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M14.314 0L2.3 12 6 15.7 18 3.7zM21.7 12l-6.2 6.2 3.7 3.8 6.2-6.3zM14.314 12L8.6 17.7l3.7 3.7 5.7-5.7z"/></svg>
      </div>`;
    } else if (p.type === 'React Native') {
      badgeClass = 'badge-rn';
      iconHTML = `<div class="proj-icon-wrapper proj-icon-rn">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>
      </div>`;
    } else {
      badgeClass = 'badge-android';
      iconHTML = `<div class="proj-icon-wrapper proj-icon-android">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18c0 .55.45 1 1 1h1v3c0 .55.45 1 1 1s1-.45 1-1v-3h4v3c0 .55.45 1 1 1s1-.45 1-1v-3h1c.55 0 1-.45 1-1V9H6v9zm13.5-12c-.55 0-1 .45-1 1v7c0 .55.45 1 1 1s1-.45 1-1V7c0-.55-.45-1-1-1zm-15 0c-.55 0-1 .45-1 1v7c0 .55.45 1 1 1s1-.45 1-1V7c0-.55-.45-1-1-1zM15.53 2.16l1.3-1.3c.2-.2.2-.51 0-.71a.498.498 0 0 0-.7 0l-1.47 1.48C13.68 1.22 12.39 1 11 1c-1.39 0-2.68.22-3.66.63L5.87.15a.498.498 0 0 0-.7 0c-.2.2-.2.51 0 .71l1.3 1.3C4.54 3.3 3 5.46 3 8h16c0-2.54-1.54-4.7-3.47-5.84zM9 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>
      </div>`;
    }

    const latest = p.latest_apk;
    const latestApkText = latest ? `${latest.name} &nbsp;•&nbsp; ${latest.size_mb} MB` : 'No APK built yet';
    const variantText = p.build_variant || (latest ? latest.variant : 'debug');
    const modeText = p.build_mode || (latest ? latest.mode : 'Debug');

    card.innerHTML = `
      <div class="proj-card-top">
        <div class="proj-card-identity">
          ${iconHTML}
          <div>
            <div class="proj-card-title-row">
              <span class="proj-card-title-text">${p.name}</span>
              <span class="proj-badge-type ${badgeClass}">${p.type}</span>
            </div>
            <div class="proj-card-path-text">${p.path}</div>
          </div>
        </div>

        <div class="proj-card-status-col">
          <div class="proj-last-built-info">
            <span style="opacity:0.6">Last built</span>
            <div class="proj-last-built-val">
              <span class="dot-green"></span>
              <span>${p.last_built}</span>
            </div>
          </div>
          <span class="proj-badge-watching">● Watching</span>
        </div>
      </div>

      <div class="proj-card-bottom">
        <div class="proj-apk-meta-group">
          <div class="proj-meta-item">
            <span class="proj-meta-label">Latest APK</span>
            <div class="proj-meta-val">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>${latestApkText}</span>
            </div>
          </div>

          <div class="proj-meta-item">
            <span class="proj-meta-label">Build Variant</span>
            <span class="proj-meta-val green">${variantText}</span>
          </div>

          <div class="proj-meta-item">
            <span class="proj-meta-label">Build Mode</span>
            <span class="proj-meta-val green">${modeText}</span>
          </div>
        </div>
      </div>

      <div class="proj-card-actions-row">
        <button class="btn btn-primary btn-xs btn-card-build">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          Build
        </button>
        <button class="btn btn-outline btn-xs btn-card-clean">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>
          Clean
        </button>
        <button class="btn btn-outline btn-xs btn-install-latest" ${!latest ? 'disabled' : ''}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Install
        </button>
        <button class="btn btn-outline btn-xs btn-open-folder" title="Open Folder">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          Open Folder
        </button>
        <button class="proj-icon-btn proj-icon-btn-danger btn-remove-project" title="Remove Project">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    `;

    // Selection listener
    const selectCard = () => {
      document.querySelectorAll('.proj-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.selectedProject = p;
      renderProjectDetails(p);
      renderBuildOutputs(p.apks || []);
    };

    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      selectCard();
    });

    if (latest) {
      card.querySelector('.btn-install-latest')?.addEventListener('click', (e) => {
        e.stopPropagation();
        installApk(latest.path);
      });
    }

    card.querySelector('.btn-open-folder')?.addEventListener('click', (e) => {
      e.stopPropagation();
      callBridge('open_folder', p.path);
    });

    card.querySelector('.btn-card-build')?.addEventListener('click', (e) => {
      e.stopPropagation();
      selectCard();
      triggerBuildProject(p, e.currentTarget);
    });

    card.querySelector('.btn-card-clean')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Clean build files for "${p.name}"?`)) {
        selectCard();
        triggerCleanProject(p);
      }
    });

    card.querySelector('.btn-remove-project')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Remove project "${p.name}" from ADB Studio? (Files won't be deleted)`)) {
        await callBridge('remove_project', p.path);
        showToast(`Removed project: ${p.name}`, 'info');
        loadProjects();
      }
    });

    container.appendChild(card);
  });

  renderProjectDetails(state.selectedProject);
  renderBuildOutputs(state.selectedProject ? state.selectedProject.apks || [] : []);
  updateBuildWatcher(projects);
}

function renderProjectDetails(p) {
  const container = document.getElementById('proj-details-body');
  if (!container) return;

  if (!p) {
    container.innerHTML = '<div class="empty-state" style="padding:20px">No project selected</div>';
    return;
  }

  let iconSVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="color:var(--accent-cyan)"><path d="M6 18c0 .55.45 1 1 1h1v3c0 .55.45 1 1 1s1-.45 1-1v-3h4v3c0 .55.45 1 1 1s1-.45 1-1v-3h1c.55 0 1-.45 1-1V9H6v9z"/></svg>';

  container.innerHTML = `
    <div class="proj-det-hero">
      ${iconSVG}
      <div>
        <div class="proj-det-title">
          <span>${p.name}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.6;cursor:pointer"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </div>
        <div class="proj-det-sub">${p.type} Project</div>
      </div>
    </div>

    <div class="proj-det-path-row">
      <span>${p.path}</span>
      <button class="icon-btn-xs" onclick="callBridge('open_folder', '${p.path.replace(/\\/g, '\\\\')}')" title="Open Folder">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      </button>
    </div>

    <div class="proj-det-grid">
      <div class="proj-det-meta">
        <span class="proj-det-label">Type</span>
        <span class="proj-det-val">${p.type}</span>
      </div>
      <div class="proj-det-meta">
        <span class="proj-det-label">Platform</span>
        <span class="proj-det-val">${p.platform || 'Android'}</span>
      </div>
      <div class="proj-det-meta">
        <span class="proj-det-label">Created</span>
        <span class="proj-det-val">${p.created || 'Unknown'}</span>
      </div>
      <div class="proj-det-meta">
        <span class="proj-det-label">Last Built</span>
        <span class="proj-det-val">${p.last_built}</span>
      </div>
    </div>

    <div style="font-size:11.5px;color:var(--success);font-weight:600;display:flex;align-items:center;gap:6px">
      <span class="dot-green"></span>
      <span>Status: Watching for builds</span>
    </div>
  `;
}

function renderBuildOutputs(apks) {
  const container = document.getElementById('proj-outputs-body');
  if (!container) return;

  if (!apks || apks.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:15px">No build outputs found in build folder.</div>';
    return;
  }

  container.innerHTML = apks.map((apk, idx) => `
    <div class="proj-output-row">
      <div>
        <div class="proj-output-name">
          <span>${apk.name}</span>
          ${idx === 0 ? '<span class="proj-badge-active" style="font-size:9px;padding:1px 5px">Latest</span>' : ''}
        </div>
        <div class="proj-output-meta">${apk.size_mb} MB &nbsp;•&nbsp; ${apk.time_ago}</div>
      </div>
      <button class="btn btn-outline btn-xs btn-dl-apk" onclick="installApk('${apk.path.replace(/\\/g, '\\\\')}')" title="Install to Phone">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
    </div>
  `).join('');
}

function updateBuildWatcher(projects) {
  const countEl = document.getElementById('bw-badge-count');
  if (countEl) countEl.innerText = `${projects.length} Active`;

  const buildsList = document.getElementById('bw-builds-list');
  if (!buildsList) return;

  const recentBuilds = [];
  projects.forEach(p => {
    if (p.latest_apk) {
      recentBuilds.push({
        projName: p.name,
        apk: p.latest_apk
      });
    }
  });

  recentBuilds.sort((a, b) => b.apk.modified - a.apk.modified);

  if (recentBuilds.length === 0) {
    buildsList.innerHTML = '<div class="empty-state" style="padding:15px">No builds detected. Drop an APK or build a project.</div>';
    return;
  }

  buildsList.innerHTML = recentBuilds.slice(0, 3).map(item => `
    <div class="proj-build-item">
      <div class="proj-build-left">
        <span class="dot-green"></span>
        <span class="proj-build-time">${item.apk.time_ago}</span>
        <span class="proj-build-app">${item.projName}</span>
        <span class="proj-build-file">${item.apk.name} (${item.apk.size_mb} MB)</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="proj-badge-active" style="font-size:9px">New Build</span>
        <button class="btn btn-primary btn-xs" onclick="installApk('${item.apk.path.replace(/\\/g, '\\\\')}')">Install</button>
      </div>
    </div>
  `).join('');
}

// Build & Clean Action Event Listeners
async function triggerBuildProject(proj, btnEl) {
  proj = proj || state.selectedProject;
  if (!proj) return showToast('Select a project first', 'error');
  showToast(`Building ${proj.name} (${proj.type})... Please wait`, 'info');

  const origHtml = btnEl ? btnEl.innerHTML : null;
  if (btnEl) { btnEl.disabled = true; btnEl.innerText = 'Building...'; }

  const res = await callBridge('build_project', proj.path, 'debug');

  if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = origHtml; }

  if (res && res.success) {
    showToast(res.message, 'success');
    logActivity('Project Built', proj.name, 'build');
    await loadProjects();
    if (res.latest_apk && state.selectedDevice) {
      if (confirm(`Build complete! Install ${res.latest_apk.name} to target device now?`)) {
        installApk(res.latest_apk.path);
      }
    }
  } else {
    const errMsg = res ? res.message : 'Build failed';
    showToast(errMsg, 'error');
    if (res && res.output) {
      console.error('Build output:', res.output);
      logActivity('Build Failed', `${proj.name}: ${errMsg}`, 'error');
    }
  }
}

async function triggerCleanProject(proj) {
  proj = proj || state.selectedProject;
  if (!proj) return showToast('Select a project first', 'error');
  showToast(`Cleaning ${proj.name}...`, 'info');

  const res = await callBridge('clean_project', proj.path);
  showToast(res && res.success ? `Cleaned ${proj.name}!` : 'Clean failed', res && res.success ? 'success' : 'error');
  if (res && res.success) {
    logActivity('Project Cleaned', proj.name, 'clean');
    loadProjects();
  }
}

safeAddListener('btn-refresh-outputs', 'click', () => {
  if (state.selectedProject) {
    loadProjects();
    showToast('Refreshed project build outputs', 'info');
  }
});

// Search & Filter Listeners
const projSearchInput = document.getElementById('proj-search');
if (projSearchInput) projSearchInput.addEventListener('input', loadProjects);
const projFilterSelect = document.getElementById('proj-filter-type');
if (projFilterSelect) projFilterSelect.addEventListener('change', loadProjects);
const projSortSelect = document.getElementById('proj-sort-by');
if (projSortSelect) projSortSelect.addEventListener('change', loadProjects);

// APK Drop Zone
const dropZone = document.getElementById('apk-drop-zone');
if (dropZone) {
  dropZone.addEventListener('click', () => document.getElementById('btn-browse-apk')?.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    const apk = files.find(f => f.name.endsWith('.apk'));
    if (apk) {
      showToast(`Installing ${apk.name}...`, 'info');
      await installApk(apk.path || apk.name);
    } else {
      showToast('Please drop an .apk file', 'error');
    }
  });
}

const dropBrowseLink = document.getElementById('drop-browse-link');
if (dropBrowseLink) dropBrowseLink.addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('btn-browse-apk')?.click(); });

safeAddListener('btn-add-project', 'click', async () => {
  const proj = await callBridge('add_project');
  if (proj) {
    showToast(`Added project: ${proj.name}`, 'success');
    logActivity('Project Added', proj.name, 'project');
    loadProjects();
  }
});

async function installApk(apkPath) {
  if (!state.selectedDevice) return showToast('Select a connected target device first!', 'error');
  showToast(`Installing APK to ${state.selectedDevice}...`, 'info');
  const res = await callBridge('install_apk', state.selectedDevice, apkPath);
  if (res && res.success) {
    showToast(res.message, 'success');
    logActivity('APK Installed', state.selectedDevice, 'apk');
  } else {
    showToast(res ? res.message : 'Installation failed', 'error');
  }
}

// Device Info Auto-Refresh (battery, storage) every 30s
let deviceInfoPollTimer = null;
function startDeviceInfoPolling() {
  if (deviceInfoPollTimer) clearInterval(deviceInfoPollTimer);
  deviceInfoPollTimer = setInterval(async () => {
    if (!state.selectedDevice) return;
    const info = await callBridge('get_device_info', state.selectedDevice);
    if (!info) return;
    // Update dashboard hero
    if (el.heroValBattery) el.heroValBattery.innerText = `${info.battery_level} (${info.battery_status})`;
    if (el.heroValStorage) el.heroValStorage.innerText = info.storage_free;
    // Update devices tab
    const setEl = (id, txt) => { const e = document.getElementById(id); if (e) e.innerText = txt; };
    setEl('dev-val-battery', `${info.battery_level} (${info.battery_status})`);
    setEl('dev-val-storage', info.storage_free);
    // Update capture tab
    const batVal = document.getElementById('cap-info-battery-val');
    if (batVal) batVal.innerText = `${info.battery_level} (${info.battery_status})`;
    setEl('cap-info-status', info.battery_status === 'Charging' ? '● Charging' : '● Connected');
    // Update statusbar
    if (el.sbTargetOs) el.sbTargetOs.innerText = `Android ${info.android_version}`;
  }, 30000);
}


// File Manager State
const fmState = {
  currentPath: '/sdcard',
  history: [],
  historyIndex: -1,
  selectedFiles: new Set(),
  viewMode: 'list' // 'list' or 'grid'
};

async function loadFiles(dirPath) {
  if (!state.selectedDevice) {
    showToast('Select a device first', 'error');
    return;
  }

  const path = dirPath || fmState.currentPath;

  // Track history
  if (path !== fmState.currentPath || fmState.history.length === 0) {
    if (fmState.historyIndex < fmState.history.length - 1) {
      fmState.history = fmState.history.slice(0, fmState.historyIndex + 1);
    }
    fmState.history.push(path);
    fmState.historyIndex = fmState.history.length - 1;
  }
  fmState.currentPath = path;
  fmState.selectedFiles.clear();

  // Update breadcrumb
  updateFMBreadcrumb(path);

  const container = document.getElementById('device-files-list');
  if (!container) return;
  container.innerHTML = '<div class="empty-state" style="padding:30px"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:6px;opacity:0.4;display:block;margin:0 auto 8px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>Loading...</div>';

  const res = await callBridge('list_files', state.selectedDevice, path);

  if (!res || !res.success) {
    container.innerHTML = `<div class="empty-state" style="padding:30px;color:var(--danger)">Failed to read directory.<br><small>${res ? res.error || '' : ''}</small></div>`;
    return;
  }

  const items = res.items || [];

  // Update status bar
  const folders = items.filter(i => i.is_dir).length;
  const files = items.filter(i => !i.is_dir).length;
  const statusCount = document.getElementById('fm-status-count');
  if (statusCount) statusCount.innerText = `${folders} folder${folders !== 1 ? 's' : ''}, ${files} file${files !== 1 ? 's' : ''}`;

  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:40px">This folder is empty.</div>';
    return;
  }

  container.innerHTML = '';
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = `fm-row${item.is_dir ? ' fm-row-is-dir' : ''}`;
    row.dataset.path = item.path;
    row.dataset.isDir = item.is_dir ? '1' : '0';

    const fileIcon = item.is_dir
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="fm-folder-icon"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`
      : getFileIcon(item.name);

    const ext = item.name.includes('.') ? item.name.split('.').pop().toUpperCase() : 'FILE';
    const fileType = item.is_dir ? 'Folder' : (ext + ' File');

    row.innerHTML = `
      <div class="fm-col-check"><input type="checkbox" class="fm-row-check" data-path="${item.path}"></div>
      <div class="fm-row-name">${fileIcon}<span>${item.name}</span></div>
      <div class="fm-row-size">${item.size}</div>
      <div class="fm-row-type">${fileType}</div>
      <div class="fm-row-modified">${item.modified || '--'}</div>
    `;

    row.addEventListener('click', (e) => {
      if (e.target.type === 'checkbox') return;
      if (item.is_dir) {
        loadFiles(item.path);
      } else {
        // Select/deselect
        row.classList.toggle('selected');
        if (row.classList.contains('selected')) {
          fmState.selectedFiles.add(item.path);
        } else {
          fmState.selectedFiles.delete(item.path);
        }
        updateFMSelection();
      }
    });

    row.querySelector('.fm-row-check').addEventListener('change', (e) => {
      if (e.target.checked) { fmState.selectedFiles.add(item.path); row.classList.add('selected'); }
      else { fmState.selectedFiles.delete(item.path); row.classList.remove('selected'); }
      updateFMSelection();
    });

    container.appendChild(row);
  });
}

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const colors = { apk: '#10B981', png: '#8B5CF6', jpg: '#8B5CF6', jpeg: '#8B5CF6', mp4: '#F59E0B', mov: '#F59E0B', txt: '#6B7280', md: '#6B7280', log: '#6B7280', zip: '#F97316', rar: '#F97316', pdf: '#EF4444', json: '#06B6D4', xml: '#06B6D4' };
  const color = colors[ext] || 'currentColor';
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;
}

function updateFMBreadcrumb(path) {
  const pills = document.getElementById('fm-path-pills');
  if (!pills) return;
  const parts = path.split('/').filter(Boolean);
  pills.innerHTML = '';
  let accumulated = '';
  parts.forEach((part, i) => {
    accumulated += '/' + part;
    const pill = document.createElement('span');
    pill.className = 'fm-path-pill' + (i === parts.length - 1 ? ' active' : '');
    pill.innerText = part;
    const capPath = accumulated;
    pill.addEventListener('click', () => loadFiles(capPath));
    pills.appendChild(pill);
    if (i < parts.length - 1) {
      const sep = document.createElement('span');
      sep.style.color = 'rgba(255,255,255,0.2)';
      sep.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>';
      pills.appendChild(sep);
    }
  });
}

function updateFMSelection() {
  const count = fmState.selectedFiles.size;
  const selEl = document.getElementById('fm-status-selected');
  if (selEl) selEl.innerText = count === 0 ? '0 items selected' : `${count} item${count > 1 ? 's' : ''} selected`;

  const hasSelection = count > 0;
  const buttons = ['btn-fm-download', 'btn-fm-dl-quick', 'btn-fm-delete', 'btn-fm-rename', 'btn-fm-perms', 'btn-fm-props'];
  buttons.forEach(id => { const b = document.getElementById(id); if (b) b.disabled = !hasSelection; });
}

async function updateFMDeviceInfo() {
  if (!state.selectedDevice) return;
  const info = await callBridge('get_device_info', state.selectedDevice);
  if (!info) return;

  const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.innerText = val; };
  setEl('fm-dev-name', info.model || state.selectedDevice);
  setEl('fm-dev-android', `Android ${info.android_version}`);
  setEl('fm-dev-serial', state.selectedDevice);
  setEl('fm-dev-model', info.model || '--');
  setEl('fm-dev-battery', info.battery_level || '--');

  const statusDot = document.getElementById('fm-dev-status-dot');
  const statusTxt = document.getElementById('fm-dev-status-text');
  if (statusDot) { statusDot.className = 'status-dot status-dot-online'; }
  if (statusTxt) statusTxt.innerText = `Connected (${state.devices.find(d => d.serial === state.selectedDevice)?.connection?.toUpperCase() || 'ADB'})`;

  // Parse storage from info.storage_free e.g. "42.8G free of 128G"
  const storMatch = (info.storage_free || '').match(/([\d.]+)\S* free of ([\d.]+)(\S*)/);
  if (storMatch) {
    const avail = parseFloat(storMatch[1]);
    const total = parseFloat(storMatch[2]);
    const unit = storMatch[3];
    const used = (total - avail).toFixed(1);
    const pct = Math.min(100, Math.round((used / total) * 100));
    setEl('fm-stor-avail', `${avail} ${unit}B`);
    setEl('fm-stor-used', `${used} ${unit}B`);
    setEl('fm-stor-total', `${total} ${unit}B`);
    const fill = document.getElementById('fm-storage-fill');
    if (fill) fill.style.width = pct + '%';
  }
}

// FM Tree root items to show
const FM_ROOTS = ['/sdcard', '/storage/emulated/0', '/data/local/tmp', '/sdcard/Download', '/sdcard/DCIM', '/sdcard/Pictures', '/sdcard/Movies'];

function renderFMTree(currentPath) {
  const tree = document.getElementById('fm-tree');
  if (!tree) return;
  tree.innerHTML = '';
  FM_ROOTS.forEach(root => {
    const item = document.createElement('div');
    item.className = 'fm-tree-item' + (currentPath.startsWith(root) ? ' active' : '');
    const label = root.split('/').filter(Boolean).pop() || root;
    item.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="fm-tree-chevron"><polyline points="9 18 15 12 9 6"/></svg>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="fm-tree-icon"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <span title="${root}">${label}</span>`;
    item.addEventListener('click', () => loadFiles(root));
    tree.appendChild(item);
  });
}

// File Manager Toolbar Events
safeAddListener('btn-path-up', 'click', () => {
  const parent = fmState.currentPath.split('/').slice(0, -1).join('/') || '/';
  loadFiles(parent);
});
safeAddListener('btn-refresh-files', 'click', () => loadFiles(fmState.currentPath));
safeAddListener('btn-fm-back', 'click', () => { if (fmState.historyIndex > 0) { fmState.historyIndex--; loadFiles(fmState.history[fmState.historyIndex]); } });
safeAddListener('btn-fm-back2', 'click', () => { if (fmState.historyIndex > 0) { fmState.historyIndex--; loadFiles(fmState.history[fmState.historyIndex]); } });
safeAddListener('btn-fm-forward', 'click', () => { if (fmState.historyIndex < fmState.history.length - 1) { fmState.historyIndex++; loadFiles(fmState.history[fmState.historyIndex]); } });
safeAddListener('btn-fm-forward2', 'click', () => { if (fmState.historyIndex < fmState.history.length - 1) { fmState.historyIndex++; loadFiles(fmState.history[fmState.historyIndex]); } });

const handleUpload = async () => {
  if (!state.selectedDevice) return showToast('Select device first', 'error');
  const filePath = await callBridge('select_any_file');
  if (filePath) {
    showToast(`Uploading ${filePath.split('\\').pop() || filePath}...`, 'info');
    const res = await callBridge('push_file', state.selectedDevice, filePath, fmState.currentPath);
    if (res && res.success) { showToast('File uploaded!', 'success'); loadFiles(fmState.currentPath); }
    else showToast(res ? res.message : 'Upload failed', 'error');
  }
};
safeAddListener('btn-push-file', 'click', handleUpload);
safeAddListener('btn-fm-upload', 'click', handleUpload);

safeAddListener('btn-fm-download', 'click', async () => {
  if (fmState.selectedFiles.size === 0) return;
  const path = [...fmState.selectedFiles][0];
  showToast(`Downloading...`, 'info');
  const res = await callBridge('pull_file', state.selectedDevice, path);
  if (res && res.success) showToast(`Downloaded to: ${res.file_path}`, 'success');
  else showToast(res ? res.message : 'Download failed', 'error');
});
safeAddListener('btn-fm-dl-quick', 'click', () => document.getElementById('btn-fm-download')?.click());

const selectAllCb = document.getElementById('fm-select-all');
if (selectAllCb) {
  selectAllCb.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    document.querySelectorAll('.fm-row-check').forEach(cb => {
      cb.checked = isChecked;
      const path = cb.getAttribute('data-path');
      const row = cb.closest('.fm-row');
      if (isChecked) {
        fmState.selectedFiles.add(path);
        if (row) row.classList.add('selected');
      } else {
        fmState.selectedFiles.delete(path);
        if (row) row.classList.remove('selected');
      }
    });
    updateFMSelection();
  });
}

const fmSearchEl = document.getElementById('fm-search');
if (fmSearchEl) {
  fmSearchEl.addEventListener('input', () => {
    const q = fmSearchEl.value.toLowerCase();
    document.querySelectorAll('.fm-row').forEach(row => {
      const name = row.querySelector('.fm-row-name span')?.innerText?.toLowerCase() || '';
      row.style.display = q ? (name.includes(q) ? '' : 'none') : '';
    });
  });
}

// ==================== LOGCAT ====================

const LOGCAT_MAX_CLIENT_ENTRIES = 8000;
const LOGCAT_POLL_MS = 700;
const LOGCAT_PID_REFRESH_MS = 4000;

const logcatState = {
  target: '',
  sinceSeq: 0,
  paused: false,
  entries: [],
  pollTimer: null,
  recentSearches: [],
  pkgFilter: '',
  pkgPids: [],
  lastPidResolve: 0,
  initialized: false
};

function initLogcatTabOnce() {
  if (logcatState.initialized) return;
  logcatState.initialized = true;

  const search = document.getElementById('logcat-search');
  const regexChk = document.getElementById('chk-logcat-regex');
  const wrapChk = document.getElementById('chk-logcat-wrap');
  const tagFilter = document.getElementById('logcat-tag-filter');
  const pkgSelect = document.getElementById('logcat-package-select');
  const table = document.querySelector('.logcat-table');
  const tableWrap = document.getElementById('logcat-table-wrap');

  let searchDebounce = null;
  search.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => renderLogcatFull(), 150);
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && search.value.trim()) addLogcatRecentSearch(search.value.trim());
  });

  regexChk.addEventListener('change', renderLogcatFull);
  document.querySelectorAll('.chk-logcat-level').forEach(chk => chk.addEventListener('change', renderLogcatFull));
  tagFilter.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => renderLogcatFull(), 150);
  });

  wrapChk.addEventListener('change', () => {
    table.classList.toggle('wrap-lines', wrapChk.checked);
  });

  pkgSelect.addEventListener('change', async () => {
    logcatState.pkgFilter = pkgSelect.value;
    await refreshLogcatPackagePids();
    renderLogcatFull();
  });

  tableWrap.addEventListener('scroll', () => {
    const btnBottom = document.getElementById('btn-logcat-bottom');
    const nearBottom = tableWrap.scrollHeight - tableWrap.scrollTop - tableWrap.clientHeight < 40;
    const autoscroll = document.getElementById('chk-logcat-autoscroll').checked;
    btnBottom.style.visibility = (!autoscroll && !nearBottom) ? 'visible' : 'hidden';
  });

  document.getElementById('btn-logcat-bottom').addEventListener('click', () => {
    tableWrap.scrollTop = tableWrap.scrollHeight;
  });

  document.getElementById('btn-logcat-pause').addEventListener('click', toggleLogcatPause);
  document.getElementById('btn-logcat-clear').addEventListener('click', clearLogcatLogs);
  document.getElementById('btn-logcat-export').addEventListener('click', exportLogcatLogs);
  document.getElementById('btn-logcat-clear-recent').addEventListener('click', () => {
    logcatState.recentSearches = [];
    renderLogcatRecentChips();
  });
  document.getElementById('btn-logcat-save-filter').addEventListener('click', saveLogcatFilter);
  document.getElementById('btn-logcat-load-filter').addEventListener('click', loadLogcatFilterPrompt);
  document.getElementById('btn-logcat-popout').addEventListener('click', async () => {
    const res = await callBridge('open_logcat_window');
    if (!res || !res.success) showToast('Could not open a new window', 'error');
  });
}

function updateLogcatDeviceBadge() {
  const dot = document.getElementById('logcat-device-dot');
  const nameEl = document.getElementById('logcat-device-name');
  const current = state.devices.find(d => d.serial === state.selectedDevice);
  if (current) {
    dot.className = 'status-pulse online';
    nameEl.innerText = `${current.model || current.serial} (${current.connection.toUpperCase()})`;
  } else {
    dot.className = 'status-pulse offline';
    nameEl.innerText = 'No device selected';
  }
}

async function onEnterLogcatTab() {
  initLogcatTabOnce();
  updateLogcatDeviceBadge();

  if (!state.selectedDevice) {
    updateLogcatStreamStatus('stopped', 'No device selected');
    return;
  }

  if (logcatState.target !== state.selectedDevice) {
    if (logcatState.target) await callBridge('stop_logcat_stream', logcatState.target);
    logcatState.target = state.selectedDevice;
    logcatState.sinceSeq = 0;
    logcatState.entries = [];
    document.getElementById('logcat-tbody').innerHTML = '';
    await loadLogcatPackages();
  }

  if (!logcatState.paused) await resumeLogcatStreaming();
  else updateLogcatStreamStatus('paused', 'Paused');
}

function onLeaveLogcatTab() {
  stopLogcatPolling();
}

async function resumeLogcatStreaming() {
  if (!logcatState.target) return showToast('Select target device first!', 'error');
  const res = await callBridge('start_logcat_stream', logcatState.target);
  if (!res || !res.success) {
    updateLogcatStreamStatus('stopped', 'Failed to start');
    return showToast((res && res.message) || 'Could not start logcat', 'error');
  }
  logcatState.paused = false;
  updateLogcatPauseButton();
  updateLogcatStreamStatus('streaming', 'Streaming logs...');
  startLogcatPolling();
}

function stopLogcatPolling() {
  if (logcatState.pollTimer) clearInterval(logcatState.pollTimer);
  logcatState.pollTimer = null;
}

function startLogcatPolling() {
  stopLogcatPolling();
  pollLogcatOnce();
  logcatState.pollTimer = setInterval(pollLogcatOnce, LOGCAT_POLL_MS);
}

function toggleLogcatPause() {
  if (logcatState.paused) {
    resumeLogcatStreaming();
  } else {
    logcatState.paused = true;
    stopLogcatPolling();
    updateLogcatPauseButton();
    updateLogcatStreamStatus('paused', 'Paused');
  }
}

function updateLogcatPauseButton() {
  const icon = document.getElementById('logcat-pause-icon');
  const label = document.getElementById('logcat-pause-label');
  if (logcatState.paused) {
    icon.innerHTML = '<polygon points="6 3 20 12 6 21 6 3"/>';
    label.innerText = 'Resume';
  } else {
    icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    label.innerText = 'Pause';
  }
}

function updateLogcatStreamStatus(kind, text) {
  const dot = document.getElementById('logcat-stream-dot');
  const statusText = document.getElementById('logcat-stream-status-text');
  if (dot) dot.className = `status-pulse ${kind}`;
  if (statusText) statusText.innerText = text;
}

async function pollLogcatOnce() {
  if (!logcatState.target || logcatState.paused) return;

  if (logcatState.pkgFilter && Date.now() - logcatState.lastPidResolve > LOGCAT_PID_REFRESH_MS) {
    await refreshLogcatPackagePids();
  }

  const res = await callBridge('poll_logcat_stream', logcatState.target, logcatState.sinceSeq);
  if (!res) return;

  if (!res.running && logcatState.entries.length === 0 && res.total_buffered === 0) {
    updateLogcatStreamStatus('stopped', 'Device disconnected or stream stopped');
  }

  logcatState.sinceSeq = res.last_seq;
  if (res.entries && res.entries.length > 0) {
    appendLogcatEntries(res.entries);
  }
  updateLogcatCountText(res.total_buffered);
}

function appendLogcatEntries(newEntries) {
  logcatState.entries.push(...newEntries);
  if (logcatState.entries.length > LOGCAT_MAX_CLIENT_ENTRIES) {
    logcatState.entries.splice(0, logcatState.entries.length - LOGCAT_MAX_CLIENT_ENTRIES);
  }

  const tbody = document.getElementById('logcat-tbody');
  const emptyRow = tbody.querySelector('.logcat-empty-row');
  if (emptyRow) emptyRow.remove();

  const ctx = getLogcatFilterContext();
  const frag = document.createDocumentFragment();
  let matched = 0;

  newEntries.forEach(entry => {
    if (!logcatEntryPassesFilters(entry, ctx)) return;
    frag.appendChild(buildLogcatRow(entry, ctx.search, ctx.isRegex));
    matched++;
  });

  if (matched > 0) {
    tbody.appendChild(frag);
    const tableWrap = document.getElementById('logcat-table-wrap');
    const autoscroll = document.getElementById('chk-logcat-autoscroll').checked;
    if (autoscroll) tableWrap.scrollTop = tableWrap.scrollHeight;
  }
}

function getLogcatFilterContext() {
  const levelSet = new Set(Array.from(document.querySelectorAll('.chk-logcat-level:checked')).map(c => c.value));
  const search = document.getElementById('logcat-search').value.trim();
  const isRegex = document.getElementById('chk-logcat-regex').checked;
  let regexObj = null;
  let regexError = false;
  if (search && isRegex) {
    try { regexObj = new RegExp(search, 'i'); } catch (e) { regexError = true; }
  }
  return {
    levelSet,
    tagFilter: document.getElementById('logcat-tag-filter').value.trim().toLowerCase(),
    pkgFilter: logcatState.pkgFilter,
    pkgPids: logcatState.pkgPids,
    search,
    isRegex,
    regexObj,
    regexError
  };
}

function logcatEntryPassesFilters(entry, ctx) {
  if (!ctx.levelSet.has(entry.level)) return false;
  if (ctx.tagFilter && !entry.tag.toLowerCase().includes(ctx.tagFilter)) return false;

  if (ctx.pkgFilter && (ctx.pkgPids.length === 0 || !ctx.pkgPids.includes(String(entry.pid)))) return false;

  if (ctx.search) {
    const haystack = `${entry.tag} ${entry.message} ${entry.pid}`;
    if (ctx.isRegex) {
      if (!ctx.regexError && ctx.regexObj && !ctx.regexObj.test(haystack)) return false;
    } else if (!haystack.toLowerCase().includes(ctx.search.toLowerCase())) {
      return false;
    }
  }

  return true;
}

function highlightLogcatText(text, term, isRegex) {
  if (!term) return escapeHtml(text);
  try {
    const re = isRegex ? new RegExp(`(${term})`, 'ig') : new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
    return escapeHtml(text).replace(re, '<mark>$1</mark>');
  } catch (e) {
    return escapeHtml(text);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.innerText = str;
  return div.innerHTML;
}

function buildLogcatRow(entry, search, isRegex) {
  const tr = document.createElement('tr');
  tr.className = `logcat-row-${entry.level.toLowerCase()}`;
  tr.innerHTML = `
    <td class="lc-col-time">${entry.time}</td>
    <td class="lc-col-level"><span class="logcat-level-pill lc-pill-${entry.level.toLowerCase()}">${entry.level}</span></td>
    <td class="lc-col-pid">${entry.pid}</td>
    <td class="lc-col-tid">${entry.tid}</td>
    <td class="lc-col-tag">${highlightLogcatText(entry.tag, search, isRegex)}</td>
    <td class="lc-col-msg">${highlightLogcatText(entry.message, search, isRegex)}</td>
  `;
  return tr;
}

function renderLogcatFull() {
  const tbody = document.getElementById('logcat-tbody');
  const ctx = getLogcatFilterContext();

  tbody.innerHTML = '';
  const frag = document.createDocumentFragment();
  let matched = 0;

  logcatState.entries.forEach(entry => {
    if (!logcatEntryPassesFilters(entry, ctx)) return;
    frag.appendChild(buildLogcatRow(entry, ctx.search, ctx.isRegex));
    matched++;
  });

  if (matched === 0) {
    tbody.innerHTML = `<tr class="logcat-empty-row"><td colspan="6">${logcatState.entries.length === 0 ? 'Waiting for logs...' : 'No logs match the current filters.'}</td></tr>`;
  } else {
    tbody.appendChild(frag);
    const tableWrap = document.getElementById('logcat-table-wrap');
    if (document.getElementById('chk-logcat-autoscroll').checked) tableWrap.scrollTop = tableWrap.scrollHeight;
  }

  updateLogcatCountText(logcatState.entries.length, matched);
}

function updateLogcatCountText(totalBuffered, matchedOverride) {
  const countEl = document.getElementById('logcat-count-text');
  const shown = matchedOverride !== undefined ? matchedOverride : document.getElementById('logcat-tbody').querySelectorAll('tr:not(.logcat-empty-row)').length;
  countEl.innerText = `Showing ${shown} of ${totalBuffered} lines`;
}

async function refreshLogcatPackagePids() {
  logcatState.lastPidResolve = Date.now();
  if (!logcatState.pkgFilter || !logcatState.target) {
    logcatState.pkgPids = [];
    return;
  }
  logcatState.pkgPids = await callBridge('resolve_package_pids', logcatState.target, logcatState.pkgFilter) || [];
}

async function loadLogcatPackages() {
  if (!logcatState.target) return;
  const packages = await callBridge('list_installed_packages', logcatState.target) || [];
  const select = document.getElementById('logcat-package-select');
  const prevValue = select.value;
  select.innerHTML = '<option value="">All Packages</option>';
  packages.forEach(pkg => {
    const opt = document.createElement('option');
    opt.value = pkg;
    opt.innerText = pkg;
    select.appendChild(opt);
  });
  select.value = packages.includes(prevValue) ? prevValue : '';
  logcatState.pkgFilter = select.value;
}

function addLogcatRecentSearch(term) {
  logcatState.recentSearches = logcatState.recentSearches.filter(t => t !== term);
  logcatState.recentSearches.unshift(term);
  logcatState.recentSearches = logcatState.recentSearches.slice(0, 6);
  renderLogcatRecentChips();
}

function renderLogcatRecentChips() {
  const container = document.getElementById('logcat-recent-chips');
  if (logcatState.recentSearches.length === 0) {
    container.innerHTML = '<span class="logcat-recent-empty">No recent searches</span>';
    return;
  }
  container.innerHTML = '';
  logcatState.recentSearches.forEach(term => {
    const chip = document.createElement('span');
    chip.className = 'logcat-recent-chip';
    chip.innerHTML = `<span class="chip-label"></span><span class="chip-x">×</span>`;
    chip.querySelector('.chip-label').innerText = term;
    chip.querySelector('.chip-label').addEventListener('click', () => {
      document.getElementById('logcat-search').value = term;
      renderLogcatFull();
    });
    chip.querySelector('.chip-x').addEventListener('click', (e) => {
      e.stopPropagation();
      logcatState.recentSearches = logcatState.recentSearches.filter(t => t !== term);
      renderLogcatRecentChips();
    });
    container.appendChild(chip);
  });
}

async function clearLogcatLogs() {
  if (logcatState.target) await callBridge('clear_logcat_stream', logcatState.target);
  logcatState.entries = [];
  logcatState.sinceSeq = 0;
  document.getElementById('logcat-tbody').innerHTML = '<tr class="logcat-empty-row"><td colspan="6">Waiting for logs...</td></tr>';
  updateLogcatCountText(0, 0);
  showToast('Logcat buffer cleared', 'info');
}

async function exportLogcatLogs() {
  const rows = document.getElementById('logcat-tbody').querySelectorAll('tr:not(.logcat-empty-row)');
  if (rows.length === 0) return showToast('No logs to export', 'error');

  const ctx = getLogcatFilterContext();
  const lines = logcatState.entries
    .filter(e => logcatEntryPassesFilters(e, ctx))
    .map(e => `${e.time} ${e.pid} ${e.tid} ${e.level} ${e.tag}: ${e.message}`);

  const deviceLabel = (state.devices.find(d => d.serial === logcatState.target) || {}).model || logcatState.target || 'device';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `logcat_${deviceLabel.replace(/\s+/g, '_')}_${stamp}.txt`;

  const res = await callBridge('export_text_file', lines.join('\n'), filename);
  if (res && res.success) showToast(`Exported to ${res.path}`, 'success');
}

async function saveLogcatFilter() {
  const name = prompt('Save current filter as:');
  if (!name || !name.trim()) return;
  const config = {
    search: document.getElementById('logcat-search').value.trim(),
    regex: document.getElementById('chk-logcat-regex').checked,
    levels: Array.from(document.querySelectorAll('.chk-logcat-level')).filter(c => c.checked).map(c => c.value),
    tag: document.getElementById('logcat-tag-filter').value.trim(),
    package: document.getElementById('logcat-package-select').value
  };
  await callBridge('save_logcat_filter', name.trim(), config);
  showToast(`Saved filter "${name.trim()}"`, 'success');
}

async function loadLogcatFilterPrompt() {
  const filters = await callBridge('get_logcat_filters') || [];
  if (filters.length === 0) return showToast('No saved filters yet', 'info');

  const names = filters.map(f => f.name).join('\n');
  const chosen = prompt(`Saved filters:\n${names}\n\nType a name to load it:`);
  if (!chosen) return;
  const match = filters.find(f => f.name === chosen.trim());
  if (!match) return showToast(`No saved filter named "${chosen}"`, 'error');

  const cfg = match.config || {};
  document.getElementById('logcat-search').value = cfg.search || '';
  document.getElementById('chk-logcat-regex').checked = !!cfg.regex;
  document.querySelectorAll('.chk-logcat-level').forEach(chk => {
    chk.checked = !cfg.levels || cfg.levels.includes(chk.value);
  });
  document.getElementById('logcat-tag-filter').value = cfg.tag || '';
  const pkgSelect = document.getElementById('logcat-package-select');
  if (cfg.package && [...pkgSelect.options].some(o => o.value === cfg.package)) {
    pkgSelect.value = cfg.package;
  } else {
    pkgSelect.value = '';
  }
  logcatState.pkgFilter = pkgSelect.value;
  await refreshLogcatPackagePids();
  renderLogcatFull();
  showToast(`Loaded filter "${match.name}"`, 'success');
}

// Capture Tab & Screenshot Logic
let currentZoomLevel = 59;
let currentScreenshotData = null;

async function loadCaptureTabData() {
  const saveDir = await callBridge('get_screenshot_dir') || 'C:\\Users\\...\\Pictures\\ADB Studio';
  const videoDir = await callBridge('get_video_dir') || 'C:\\Users\\...\\Videos\\ADB Studio';
  const settings = await callBridge('get_capture_settings') || {};

  const inputSaveLoc = document.getElementById('input-save-loc');
  const inputRecLoc = document.getElementById('input-rec-loc');
  const chkAutoCopy = document.getElementById('chk-auto-copy');
  const chkAutoOpen = document.getElementById('chk-auto-open');
  const selectFormat = document.getElementById('select-img-format');
  const selectQuality = document.getElementById('select-img-quality');

  if (inputSaveLoc) inputSaveLoc.value = saveDir;
  if (inputRecLoc) inputRecLoc.value = videoDir;
  if (chkAutoCopy && settings.auto_copy_clipboard !== undefined) chkAutoCopy.checked = settings.auto_copy_clipboard;
  if (chkAutoOpen && settings.auto_open_folder !== undefined) chkAutoOpen.checked = settings.auto_open_folder;
  if (selectFormat && settings.image_format) selectFormat.value = settings.image_format;
  if (selectQuality && settings.image_quality) selectQuality.value = settings.image_quality;

  // Load Device Info in Capture Sidebar
  if (state.selectedDevice) {
    const info = await callBridge('get_device_info', state.selectedDevice);
    if (info) {
      document.getElementById('cap-info-model').innerText = info.model || state.selectedDevice;
      document.getElementById('cap-info-android').innerText = info.android_version || '--';
      document.getElementById('cap-info-resolution').innerText = info.resolution || '--';
      document.getElementById('cap-info-density').innerText = info.density ? `${info.density} DPI` : '420 DPI';
      const batEl = document.getElementById('cap-info-battery-val');
      if (batEl) batEl.innerText = `${info.battery_level} (${info.battery_status})`;
      else document.getElementById('cap-info-battery').innerText = `${info.battery_level} (${info.battery_status})`;
      document.getElementById('cap-info-status').innerText = '● Connected';

    }
  }

  loadRecentCapturesGallery();
}

async function loadRecentCapturesGallery() {
  const gallery = document.getElementById('recent-captures-gallery');
  if (!gallery) return;
  gallery.innerHTML = '';

  const captures = await callBridge('get_recent_captures') || [];
  if (captures.length === 0) {
    gallery.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">No recent captures found. Click "Take Screenshot" to capture screen.</div>';
    return;
  }

  captures.forEach(item => {
    const card = document.createElement('div');
    card.className = 'cap-thumb-card';
    card.innerHTML = `
      <div class="cap-thumb-phone">
        <div class="cap-thumb-notch"></div>
        <div class="cap-thumb-screen">
          <img src="${item.b64}" class="cap-thumb-img" alt="" loading="lazy">
        </div>
        <div class="cap-thumb-homeind"></div>
      </div>
      <div class="cap-thumb-meta">
        <span class="cap-thumb-time">${item.time_str}</span>
        <span class="cap-thumb-size">${item.size_str}</span>
      </div>
      <div class="cap-thumb-actions">
        <button class="cap-action-btn btn-copy-thumb" title="Copy">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="cap-action-btn btn-folder-thumb" title="Open Folder">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </button>
        <button class="cap-action-btn btn-select-cap" title="Set as Preview" data-b64="${item.b64}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </button>
      </div>
    `;


    card.querySelector('.btn-copy-thumb').addEventListener('click', async () => {
      await copyB64ToClipboard(item.b64);
      showToast('Screenshot copied to clipboard!', 'success');
    });

    card.querySelector('.btn-folder-thumb').addEventListener('click', () => {
      callBridge('open_folder', item.path);
    });

    card.querySelector('.btn-select-cap').addEventListener('click', () => {
      currentScreenshotData = item.b64;
      const imgEl = document.getElementById('screenshot-img');
      const placeholderEl = document.getElementById('cap-placeholder');
      if (imgEl) { imgEl.src = item.b64; imgEl.classList.remove('hidden'); }
      if (placeholderEl) placeholderEl.classList.add('hidden');
      showToast('Loaded in preview', 'success');
    });

    gallery.appendChild(card);
  });
}

async function takeScreenshot() {
  if (!state.selectedDevice) return showToast('Select target device first!', 'error');

  showToast('Capturing screenshot...', 'info');
  const res = await callBridge('take_screenshot', state.selectedDevice);
  if (res && res.success) {
    currentScreenshotData = res.image_data;
    const imgEl = document.getElementById('screenshot-img');
    const placeholderEl = document.getElementById('cap-placeholder');
    const btnCopy = document.getElementById('btn-copy-clipboard');

    if (imgEl) {
      imgEl.src = res.image_data;
      imgEl.classList.remove('hidden');
    }
    if (placeholderEl) placeholderEl.classList.add('hidden');
    if (btnCopy) btnCopy.disabled = false;

    // Check Auto-copy setting
    const autoCopy = document.getElementById('chk-auto-copy')?.checked;
    if (autoCopy) {
      await copyB64ToClipboard(res.image_data);
      showToast('Captured & copied to clipboard!', 'success');
    } else {
      showToast('Screenshot saved!', 'success');
    }

    logActivity('Captured Screenshot', res.file_path, 'screenshot');
    loadRecentCapturesGallery();
  } else {
    showToast(res ? res.error : 'Screenshot capture failed', 'error');
  }
}

// Copy Base64 Image to Clipboard
async function copyB64ToClipboard(b64Data) {
  try {
    const res = await fetch(b64Data);
    const blob = await res.blob();
    if (navigator.clipboard && window.ClipboardItem) {
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
    }
  } catch (e) {
    console.error('Clipboard copy failed:', e);
  }
}

// Zoom Bar Controls
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomFit = document.getElementById('btn-zoom-fit');
const lblZoomVal = document.getElementById('lbl-zoom-val');

if (btnZoomOut) {
  btnZoomOut.addEventListener('click', () => {
    currentZoomLevel = Math.max(30, currentZoomLevel - 15);
    updateZoomDisplay();
  });
}
if (btnZoomIn) {
  btnZoomIn.addEventListener('click', () => {
    currentZoomLevel = Math.min(150, currentZoomLevel + 15);
    updateZoomDisplay();
  });
}
if (btnZoomFit) {
  btnZoomFit.addEventListener('click', () => {
    currentZoomLevel = 59;
    updateZoomDisplay();
  });
}

function updateZoomDisplay() {
  if (lblZoomVal) lblZoomVal.innerText = `${currentZoomLevel}%`;
  const img = document.getElementById('screenshot-img');
  if (img) img.style.transform = `scale(${currentZoomLevel / 100})`;
}

// Attach Screenshot & Option Listeners
const btnTakeScreenshotMain = document.getElementById('btn-take-screenshot-main');
if (btnTakeScreenshotMain) btnTakeScreenshotMain.addEventListener('click', takeScreenshot);

const btnCopyClipboard = document.getElementById('btn-copy-clipboard');
if (btnCopyClipboard) {
  btnCopyClipboard.addEventListener('click', async () => {
    if (currentScreenshotData) {
      await copyB64ToClipboard(currentScreenshotData);
      showToast('Copied screenshot to clipboard!', 'success');
    }
  });
}

const btnChangeSaveDir = document.getElementById('btn-change-save-dir');
if (btnChangeSaveDir) {
  btnChangeSaveDir.addEventListener('click', async () => {
    const dir = await callBridge('select_folder');
    if (dir) {
      await callBridge('set_screenshot_dir', dir);
      document.getElementById('input-save-loc').value = dir;
      showToast(`Save folder updated: ${dir}`, 'success');
    }
  });
}

const btnChangeVideoDir = document.getElementById('btn-change-video-dir');
if (btnChangeVideoDir) {
  btnChangeVideoDir.addEventListener('click', async () => {
    const dir = await callBridge('select_folder');
    if (dir) {
      await callBridge('set_video_dir', dir);
      document.getElementById('input-rec-loc').value = dir;
      showToast(`Video folder updated: ${dir}`, 'success');
    }
  });
}

const btnRecordScreen = document.getElementById('btn-record-screen');
if (btnRecordScreen) {
  btnRecordScreen.addEventListener('click', async () => {
    if (!state.selectedDevice) return showToast('Select target device first!', 'error');
    const dur = document.getElementById('select-rec-duration')?.value || '60';
    showToast(`Recording screen for ${dur} seconds...`, 'info');
    const res = await callBridge('record_screen', state.selectedDevice, parseInt(dur));
    if (res && res.success) {
      showToast(`Recording saved to: ${res.file_path}`, 'success');
      logActivity('Recorded Screen MP4', res.file_path, 'video');
    } else {
      showToast(res ? res.error : 'Screen recording failed', 'error');
    }
  });
}

async function loadPackages() {
  if (!state.selectedDevice) return;
  const packages = await callBridge('list_installed_packages', state.selectedDevice) || [];
  state.installedPackages = packages;
  const select = document.getElementById('app-package-select');
  if (!select) return;
  select.innerHTML = '<option value="">Select Package...</option>';
  packages.forEach(pkg => {
    const opt = document.createElement('option');
    opt.value = pkg;
    opt.innerText = pkg;
    select.appendChild(opt);
  });
}

function getSelectedPackage() {
  return document.getElementById('input-custom-package').value.trim() || document.getElementById('app-package-select').value;
}

document.getElementById('btn-app-clear').addEventListener('click', async () => {
  const pkg = getSelectedPackage();
  if (!pkg) return showToast('Select or type a package name', 'error');
  const res = await callBridge('clear_app_data', state.selectedDevice, pkg);
  showToast(res && res.success ? `Cleared data for ${pkg}` : 'Clear failed', res && res.success ? 'success' : 'error');
  if (res && res.success) logActivity('Cleared App Data', pkg, 'clear');
});

document.getElementById('btn-app-stop').addEventListener('click', async () => {
  const pkg = getSelectedPackage();
  if (!pkg) return showToast('Select or type a package name', 'error');
  const res = await callBridge('force_stop_app', state.selectedDevice, pkg);
  showToast(res && res.success ? `Force stopped ${pkg}` : 'Force stop failed', res && res.success ? 'success' : 'error');
  if (res && res.success) logActivity('Force Stopped App', pkg, 'stop');
});

document.getElementById('btn-launch-deeplink').addEventListener('click', async () => {
  const uri = document.getElementById('input-deeplink-uri').value.trim();
  if (!uri) return showToast('Enter deep link URI', 'error');
  const res = await callBridge('launch_deep_link', state.selectedDevice, uri);
  showToast(res && res.success ? `Launched: ${uri}` : 'Failed to launch', res && res.success ? 'success' : 'error');
  if (res && res.success) logActivity('Launched Deep Link', uri, 'deeplink');
});

// Remote Control Keyevents Delegation
document.addEventListener('click', async (e) => {
  const remoteBtn = e.target.closest('.remote-btn');
  if (remoteBtn) {
    const key = remoteBtn.getAttribute('data-key');
    const action = remoteBtn.getAttribute('data-action');
    if (!state.selectedDevice) {
      showToast('Select a target device first!', 'error');
      return;
    }
    if (action === 'open-camera') {
      // Use intent to open camera reliably
      const res = await callBridge('send_adb_shell', state.selectedDevice, 'am start -a android.media.action.STILL_IMAGE_CAMERA');
      showToast(res && res.success ? 'Camera opened' : 'Failed to open camera', res && res.success ? 'info' : 'error');
      return;
    }
    if (action === 'brightness-down') {
      const res = await callBridge('change_brightness', state.selectedDevice, -20);
      showToast(res && res.success ? 'Brightness decreased' : 'Failed', res && res.success ? 'info' : 'error');
      return;
    }
    if (action === 'brightness-up') {
      const res = await callBridge('change_brightness', state.selectedDevice, 20);
      showToast(res && res.success ? 'Brightness increased' : 'Failed', res && res.success ? 'info' : 'error');
      return;
    }
    if (key) {
      const res = await callBridge('send_keyevent', state.selectedDevice, key);
      if (!res || !res.success) showToast('Failed to send keyevent', 'error');
    }
  }
});

// Built-in Screen Mirroring & Fallback Stream
let mirrorStreamTimer = null;
let mirrorStreamActive = false;

const modalScreenMirror = document.getElementById('modal-screen-mirror');
const lblMirrorDeviceName = document.getElementById('lbl-mirror-device-name');
const mirrorStreamImg = document.getElementById('mirror-stream-img');
const btnToggleMirrorStream = document.getElementById('btn-toggle-mirror-stream');
const btnCloseMirrorModal = document.getElementById('btn-close-mirror-modal');
const btnMirrorTakeScreenshot = document.getElementById('btn-mirror-take-screenshot');

async function openScreenMirroring() {
  if (!state.selectedDevice) return showToast('Select a target device first!', 'error');

  showToast('Attempting to launch scrcpy...', 'info');
  const scrcpyRes = await callBridge('launch_scrcpy', state.selectedDevice);
  if (scrcpyRes && scrcpyRes.success) {
    showToast(scrcpyRes.message, 'success');
    logActivity('Launched Screen Mirror', state.selectedDevice, 'mirror');
  } else {
    // Fall back to built-in live screenshot stream modal
    showToast('scrcpy not found in PATH. Opening built-in Live Screen Mirror...', 'info');
    if (lblMirrorDeviceName) lblMirrorDeviceName.innerText = `Target: ${state.selectedDevice}`;
    modalScreenMirror.classList.remove('hidden');
    startMirrorStream();
    logActivity('Opened Built-in Live Mirror', state.selectedDevice, 'mirror');
  }
}

function startMirrorStream() {
  mirrorStreamActive = true;
  if (btnToggleMirrorStream) btnToggleMirrorStream.innerText = 'Pause Stream';
  fetchMirrorFrame();
  mirrorStreamTimer = setInterval(fetchMirrorFrame, 400);
}

function stopMirrorStream() {
  mirrorStreamActive = false;
  if (btnToggleMirrorStream) btnToggleMirrorStream.innerText = 'Resume Stream';
  if (mirrorStreamTimer) clearInterval(mirrorStreamTimer);
}

async function fetchMirrorFrame() {
  if (!state.selectedDevice || !mirrorStreamActive) return;
  const res = await callBridge('take_screenshot_silent', state.selectedDevice);
  if (res && res.success && mirrorStreamImg) {
    mirrorStreamImg.src = res.image_data;
  }
}

if (btnCloseMirrorModal) {
  btnCloseMirrorModal.addEventListener('click', () => {
    stopMirrorStream();
    modalScreenMirror.classList.add('hidden');
  });
}

if (btnToggleMirrorStream) {
  btnToggleMirrorStream.addEventListener('click', () => {
    if (mirrorStreamActive) stopMirrorStream();
    else startMirrorStream();
  });
}

if (btnMirrorTakeScreenshot) {
  btnMirrorTakeScreenshot.addEventListener('click', takeScreenshot);
}

const btnLaunchScrcpy = document.getElementById('btn-launch-scrcpy');
if (btnLaunchScrcpy) {
  btnLaunchScrcpy.addEventListener('click', openScreenMirroring);
}

// Browse APK Handler
const btnBrowseApk = document.getElementById('btn-browse-apk');
if (btnBrowseApk) {
  btnBrowseApk.addEventListener('click', async () => {
    const apkPath = await callBridge('select_apk_file');
    if (apkPath) {
      installApk(apkPath);
    }
  });
}

// Remote Text Injector
const btnSendRemoteText = document.getElementById('btn-send-remote-text');
const inputRemoteText = document.getElementById('input-remote-text');
if (btnSendRemoteText && inputRemoteText) {
  btnSendRemoteText.addEventListener('click', async () => {
    if (!state.selectedDevice) return showToast('Select a target device first!', 'error');
    const text = inputRemoteText.value;
    if (!text) return showToast('Type text to inject', 'error');
    const res = await callBridge('input_text', state.selectedDevice, text);
    showToast(res && res.success ? 'Text injected to phone!' : 'Failed to send text', res && res.success ? 'success' : 'error');
    if (res && res.success) logActivity('Injected Text Input', text, 'text');
  });
}

// Popout Window Mode (e.g. the standalone Logcat window)
let popoutModeApplied = false;
function initPopoutModeIfNeeded() {
  if (popoutModeApplied) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('popout') === 'logcat') {
    popoutModeApplied = true;
    document.body.classList.add('popout-mode');
    switchTab('logcat');
  }
}

// Init on PyWebView Ready
window.addEventListener('pywebviewready', () => {
  loadDashboardData();
  initPopoutModeIfNeeded();
});

setTimeout(() => {
  loadDashboardData();
  initPopoutModeIfNeeded();
}, 500);

