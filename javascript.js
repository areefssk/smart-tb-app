/* ==================== API Shim: จำลอง google.script.run ด้วย fetch() ====================
 * ใช้แทน google.script.run ตัวจริง (ซึ่งมีให้เฉพาะตอนรันอยู่ใน iframe sandbox ของ GAS เท่านั้น)
 * เพื่อให้โค้ดเดิมทั้งหมดที่เรียก google.script.run.withSuccessHandler(...).functionName(...)
 * ทำงานได้เหมือนเดิมทุกจุด โดยไม่ต้องแก้โค้ดส่วนอื่นเลย
 */
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbyjY0vqsnKwVgbfkzE8f-7TTMz4sIYKn65ZsylUoDgX5gT-w4hxpCg-wSp8s8-6Mj01hw/exec'; // TODO: ใส่ URL จริงของ deployment ล่าสุด

window.google = window.google || {};

function createScriptRunProxy() {
  function makeChain(onSuccess, onFailure) {
    return new Proxy({}, {
      get: function(target, actionName) {
        if (actionName === 'withSuccessHandler') {
          return function(fn) { return makeChain(fn, onFailure); };
        }
        if (actionName === 'withFailureHandler') {
          return function(fn) { return makeChain(onSuccess, fn); };
        }
        return function(...args) {
          fetch(API_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: actionName, params: args }),
          })
            .then(function(res){ return res.json(); })
            .then(function(data){ if (onSuccess) onSuccess(data); })
            .catch(function(err){ if (onFailure) onFailure(err); });
        };
      },
    });
  }
  return makeChain(null, null);
}

google.script = google.script || {};
google.script.run = createScriptRunProxy();

/* ==================== โค้ดเดิมของระบบ Smart TB (เดิมอยู่ใน JavaScript.html) ==================== */

const LIST_TABS = ['all', 'zone', 'active', 'discharged'];
const SEARCH_TABS = LIST_TABS.concat(['map']);

const TABS = [
  {id:'summary', label:'สรุปผลข้อมูล', short:'สรุปผล', icon:'ti-chart-bar', sub:'ภาพรวมสถิติผู้ป่วยวัณโรค'},
  {id:'all', label:'ทะเบียน TB ทั้งหมด', short:'ทั้งหมด', icon:'ti-list-details', sub:'ผู้ป่วยวัณโรคทั้งหมดในระบบ'},
  {id:'zone', label:'รายชื่อในเขตโรงพยาบาล', short:'ในเขต', icon:'ti-building-hospital', sub:'ผู้ป่วยในเขตรับผิดชอบของโรงพยาบาล'},
  {id:'active', label:'ทะเบียนผู้ป่วยกำลังรักษา', short:'กำลังรักษา', icon:'ti-pill', sub:'ผู้ป่วยที่อยู่ระหว่างการรักษา'},
  {id:'discharged', label:'คนไข้ที่จำหน่าย', short:'จำหน่าย', icon:'ti-door-exit', sub:'ผู้ป่วยที่จำหน่ายออกจากทะเบียนแล้ว'},
  {id:'map', label:'แผนที่ผู้ป่วย', short:'แผนที่', icon:'ti-map-2', sub:'ตำแหน่งบ้านผู้ป่วยบนแผนที่'},
  {id:'appt', label:'ติดตามนัดรับยา', short:'นัดรับยา', icon:'ti-calendar-event', sub:'ปฏิทินและสถานะการนัดรับยาของผู้ป่วย'},
  {id:'visit', label:'บันทึกการรับบริการวันนี้', short:'บันทึกวันนี้', icon:'ti-stethoscope', sub:'ค้นหาผู้ป่วยและบันทึกข้อมูลการมารับบริการวันนี้'},
  {id:'homevisit', label:'บันทึกการเยี่ยมบ้าน', short:'เยี่ยมบ้าน', icon:'ti-home-2', sub:'ค้นหาผู้ป่วยและบันทึกการลงพื้นที่เยี่ยมบ้าน'},
  {id:'lab', label:'บันทึกผลแลป', short:'ผลแลป', icon:'ti-flask', sub:'ค้นหาผู้ป่วยและบันทึก/แก้ไขผลตรวจแลป'},
  {id:'contact', label:'Contact TB', short:'Contact', icon:'ti-users', sub:'ผู้สัมผัสร่วมบ้านของผู้ป่วย'},
  {id:'activitylog', label:'บันทึกกิจกรรม', short:'กิจกรรม', icon:'ti-history', sub:'ประวัติการบันทึก/แก้ไขข้อมูลในระบบ (เฉพาะผู้ดูแลระบบ)'},
];

const navList = document.getElementById('navList');
const bottomNav = document.getElementById('bottomNav');
const content = document.getElementById('content');
const searchBox = document.getElementById('searchInput');

let allPatients = [];
let currentTab = 'all';

const NAV_GROUP_LABELS = {
  all: 'ทะเบียนผู้ป่วย',
  map: 'การดูแลและติดตาม',
  contact: 'อื่นๆ',
};

TABS.forEach(function(t, i){
  if (NAV_GROUP_LABELS[t.id]) {
    const groupLabel = document.createElement('div');
    groupLabel.className = 'nav-group-label';
    groupLabel.textContent = NAV_GROUP_LABELS[t.id];
    navList.appendChild(groupLabel);
  }

  const li = document.createElement('li');
  li.className = 'nav-item' + (i === 0 ? ' active' : '');
  li.dataset.id = t.id;
  li.innerHTML = '<i class="ti ' + t.icon + '"></i><span>' + t.label + '</span>';
  li.onclick = function(){ selectTab(t.id); };
  navList.appendChild(li);

  const bn = document.createElement('div');
  bn.className = 'bn-item' + (i === 0 ? ' active' : '');
  bn.dataset.id = t.id;
  bn.innerHTML = '<i class="ti ' + t.icon + '"></i><span>' + t.short + '</span>';
  bn.onclick = function(){ selectTab(t.id); };
  bottomNav.appendChild(bn);

  const panel = document.createElement('div');
  panel.className = 'panel' + (i === 0 ? ' active' : '');
  panel.id = 'panel-' + t.id;
  content.appendChild(panel);
});

const bnAuthItem = document.createElement('div');
bnAuthItem.className = 'bn-item';
bnAuthItem.id = 'bnAuthItem';
bnAuthItem.innerHTML = '<i class="ti ti-login-2"></i><span>เข้าสู่ระบบ</span>';
bnAuthItem.onclick = function(){
  if (currentUser) doLogout(); else openLoginModal();
};
bottomNav.appendChild(bnAuthItem);

google.script.run.withSuccessHandler(function(r){
  const mark = document.getElementById('brandMark');
  if (mark && r && r.ok && r.dataUrl) {
    mark.innerHTML = '<img src="' + r.dataUrl + '" alt="" style="width:100%;height:100%;object-fit:cover;">';
  }
}).withFailureHandler(function(){}).getLogoDataUrl();

renderLoading('all');
google.script.run.withSuccessHandler(function(r){
  const m = document.getElementById('buildMarker');
  if (m) m.textContent = 'build v4 · ping: ' + (r && r.message ? r.message + ' (' + r.time + ')' : 'no response');
}).withFailureHandler(function(err){
  const m = document.getElementById('buildMarker');
  if (m) m.textContent = 'build v4 · ping failed: ' + (err && err.message ? err.message : String(err));
}).ping();

google.script.run.withSuccessHandler(onDataLoaded).withFailureHandler(onLoadError).getPatientData();

function onDataLoaded(result) {
  if (!result) {
    onLoadError({ message: 'ไม่ได้รับข้อมูลตอบกลับจากเซิร์ฟเวอร์ (null)' });
    return;
  }
  if (!result.ok) {
    showDebugInfo(result);
    return;
  }
  allPatients = result.patients || [];
  function safeRun(name, fn) {
    try { fn(); } catch (err) { console.error('render error in ' + name + ':', err); }
  }
  safeRun('renderTab all', function(){ renderTab('all'); });
  safeRun('renderTab zone', function(){ renderTab('zone'); });
  safeRun('renderTab active', function(){ renderTab('active'); });
  safeRun('renderTab discharged', function(){ renderTab('discharged'); });
  safeRun('renderDashboard', renderDashboard);
  safeRun('renderAppointments', renderAppointments);
}

function showDebugInfo(info) {
  const panel = document.getElementById('panel-all');
  let html = '<div class="placeholder" style="text-align:left;">';
  html += '<h2 style="margin-bottom:10px;">' + escapeHtml(info.error || 'ไม่พบข้อมูล') + '</h2>';
  if (info.debug) {
    html += '<p><b>ชื่อชีต:</b> ' + escapeHtml(info.debug.sheetName) + ' &middot; <b>จำนวนแถวข้อมูล:</b> ' + info.debug.totalRows + '</p>';
    html += '<p><b>หัวคอลัมน์ที่อ่านได้จริง (index: ข้อความ):</b></p>';
    html += '<pre style="white-space:pre-wrap;font-size:12px;background:var(--bg);padding:10px;border-radius:8px;">' + escapeHtml(info.debug.headers.join('\\n')) + '</pre>';
    html += '<p><b>ผลการจับคู่คอลัมน์ (colIndex, -1 = จับคู่ไม่เจอ):</b></p>';
    html += '<pre style="white-space:pre-wrap;font-size:12px;background:var(--bg);padding:10px;border-radius:8px;">' + escapeHtml(JSON.stringify(info.debug.colIndex, null, 2)) + '</pre>';
  }
  if (info.stack) {
    html += '<p><b>Stack:</b></p><pre style="white-space:pre-wrap;font-size:11px;background:var(--bg);padding:10px;border-radius:8px;">' + escapeHtml(info.stack) + '</pre>';
  }
  html += '</div>';
  panel.innerHTML = html;
}

function onLoadError(err) {
  const panel = document.getElementById('panel-all');
  panel.innerHTML = '<div class="placeholder"><i class="ti ti-alert-triangle"></i>' +
    '<h2>ดึงข้อมูลไม่สำเร็จ</h2><p>' + escapeHtml(err && err.message ? err.message : String(err)) + '</p></div>';
}

function skeletonPatientRow() {
  return '<div class="demo-row sk-row">' +
    '<div class="sk sk-avatar"></div>' +
    '<div class="demo-info">' +
      '<div class="sk sk-line" style="width:90px;height:11px;"></div>' +
      '<div class="sk sk-line" style="width:150px;height:14px;margin-top:6px;"></div>' +
      '<div class="sk sk-line" style="width:110px;height:6px;margin-top:11px;border-radius:3px;"></div>' +
    '</div>' +
    '<div class="sk sk-pill"></div>' +
  '</div>';
}

function skeletonDashboard() {
  const heroCards = new Array(4).fill(0).map(function(){ return '<div class="sk sk-hero"></div>'; }).join('');
  const statCards = new Array(3).fill(0).map(function(){ return '<div class="sk sk-stat"></div>'; }).join('');
  return '<div class="dash-loading-wrap">' +
      '<div class="dash-loading-icon"><i class="ti ti-loader-2"></i></div>' +
      '<h2>กำลังโหลดข้อมูลแดชบอร์ด...</h2>' +
      '<p>รวบรวมสถิติผู้ป่วยวัณโรคทั้งหมดในระบบ</p>' +
    '</div>' +
    '<div class="hero-grid">' + heroCards + '</div>' +
    '<div class="stat-grid">' + statCards + '</div>';
}

function animateCountUp(el, target, duration) {
  if (!el) return;
  const start = 0;
  const startTime = performance.now();
  duration = duration || 900;
  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(start + (target - start) * eased);
    el.textContent = value.toLocaleString('th-TH');
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = target.toLocaleString('th-TH');
      el.classList.add('count-bounce');
      setTimeout(function(){ el.classList.remove('count-bounce'); }, 350);
    }
  }
  requestAnimationFrame(tick);
}

function skeletonPatientDetailArea() {
  const line = function(w1, w2){
    return '<div class="field-group"><div class="sk sk-line" style="width:' + w1 + 'px;height:11px;"></div>' +
      '<div class="sk sk-line" style="width:' + w2 + 'px;height:32px;margin-top:8px;border-radius:9px;"></div></div>';
  };
  return '<div class="sk sk-line" style="width:100%;height:56px;border-radius:12px;margin-bottom:16px;"></div>' +
    line(90, 200) + line(70, 260) + line(80, 220);
}

function renderLoading(id) {
  const panel = document.getElementById('panel-' + id);
  if (panel) {
    panel.innerHTML = new Array(5).fill(0).map(skeletonPatientRow).join('');
  }
}

function placeholderContent(label) {
  return '<div class="placeholder">' +
    '<i class="ti ti-tools"></i>' +
    '<h2>' + label + '</h2>' +
    '<p>ยังไม่ได้ใส่ฟังก์ชันการทำงานในส่วนนี้ — ขั้นตอนถัดไปจะต่อข้อมูลจริงจาก Google Sheet</p>' +
    '</div>';
}

document.getElementById('panel-map').innerHTML =
  '<div class="map-toggle">' +
    '<button id="mapNormalBtn" class="active">แผนที่ปกติ</button>' +
    '<button id="mapSatBtn">ดาวเทียม</button>' +
    '<span id="mapNote" class="map-note"></span>' +
  '</div>' +
  '<div id="mapContainer" class="map-container"></div>' +
  '<div class="map-legend">' +
    '<span><i class="dot" style="background:#F2C572"></i>กำลังรักษา</span>' +
    '<span><i class="dot" style="background:#2E7D4F"></i>หาย/ครบ</span>' +
    '<span><i class="dot" style="background:#B3261E"></i>ตาย</span>' +
    '<span><i class="dot" style="background:#2F80A6"></i>โอนออก</span>' +
    '<span><i class="dot" style="background:#E07A2A"></i>ขาดยาติดต่อกัน 2เดือน</span>' +
  '</div>';

document.getElementById('panel-visit').innerHTML =
  '<div class="visit-search-wrap">' +
    '<div class="search visit-search"><i class="ti ti-search"></i><input type="text" id="visitSearchInput" placeholder="ค้นหาชื่อ, HN, เลข TB...">' +
    '<button class="search-clear-btn" id="visitSearchInputClear" type="button" style="display:none;"><i class="ti ti-x"></i></button></div>' +
  '</div>' +
  '<div id="visitResults" class="visit-results"></div>' +
  '<div id="visitPatientArea"></div>';

document.getElementById('panel-homevisit').innerHTML =
  '<div class="visit-search-wrap">' +
    '<div class="search visit-search"><i class="ti ti-search"></i><input type="text" id="hvSearchInput" placeholder="ค้นหาชื่อ, HN, เลข TB...">' +
    '<button class="search-clear-btn" id="hvSearchInputClear" type="button" style="display:none;"><i class="ti ti-x"></i></button></div>' +
  '</div>' +
  '<div id="hvResults" class="visit-results"></div>' +
  '<div id="hvPatientArea"></div>';

document.getElementById('panel-summary').innerHTML = skeletonDashboard();

document.getElementById('panel-lab').innerHTML =
  '<div class="visit-search-wrap">' +
    '<div class="search visit-search"><i class="ti ti-search"></i><input type="text" id="labSearchInput" placeholder="ค้นหาชื่อ, HN, เลข TB...">' +
    '<button class="search-clear-btn" id="labSearchInputClear" type="button" style="display:none;"><i class="ti ti-x"></i></button></div>' +
  '</div>' +
  '<div id="labResults" class="visit-results"></div>' +
  '<div id="labPatientArea"></div>';

document.getElementById('panel-contact').innerHTML =
  '<div class="visit-search-wrap">' +
    '<div class="search visit-search"><i class="ti ti-search"></i><input type="text" id="ctSearchInput" placeholder="ค้นหาชื่อ, HN, เลข TB...">' +
    '<button class="search-clear-btn" id="ctSearchInputClear" type="button" style="display:none;"><i class="ti ti-x"></i></button></div>' +
  '</div>' +
  '<div id="ctResults" class="visit-results"></div>' +
  '<div id="ctPatientArea"></div>';

document.getElementById('panel-activitylog').innerHTML = '<div id="activityLogArea"></div>';

document.getElementById('pageTitle').textContent = TABS[0].label;
document.getElementById('pageSub').textContent = TABS[0].sub;
updateTopControls(TABS[0].id);

function isInZone(p) {
  return (p.zone || '').indexOf('โรงพยาบาล') !== -1;
}

let filterStatusVal = '';
let filterZoneVal = '';

function filterForTab(tabId, list) {
  if (tabId === 'active') list = list.filter(function(p){ return !p.isDischarged; });
  else if (tabId === 'discharged') list = list.filter(function(p){ return p.isDischarged; });
  else if (tabId === 'zone') list = list.filter(isInZone);

  if (tabId === 'all') {
    if (filterStatusVal === 'กำลังรักษา') {
      list = list.filter(function(p){ return !p.isDischarged; });
    } else if (filterStatusVal) {
      list = list.filter(function(p){ return p.isDischarged && (p.dischargeBy || '') === filterStatusVal; });
    }
    if (filterZoneVal) {
      list = list.filter(function(p){ return (p.zone || '') === filterZoneVal; });
    }
  }
  return list;
}

function statusFilterOptionsHtml() {
  const opts = ['กำลังรักษา'].concat(OPT.dischargeBy);
  return opts.map(function(o){
    return '<option value="' + escapeHtml(o) + '"' + (filterStatusVal === o ? ' selected' : '') + '>' + escapeHtml(o) + '</option>';
  }).join('');
}

function zoneFilterOptionsHtml() {
  return OPT.zone.map(function(o){
    return '<option value="' + escapeHtml(o) + '"' + (filterZoneVal === o ? ' selected' : '') + '>' + escapeHtml(o) + '</option>';
  }).join('');
}

function filterBarForAllHtml() {
  return '<div class="list-filter-bar">' +
    '<select id="filterStatusSelect"><option value="">สถานะทั้งหมด</option>' + statusFilterOptionsHtml() + '</select>' +
    '<select id="filterZoneSelect"><option value="">เขตทั้งหมด</option>' + zoneFilterOptionsHtml() + '</select>' +
    ((filterStatusVal || filterZoneVal) ? '<button class="btn-ghost" id="filterClearBtn" type="button">ล้างตัวกรอง</button>' : '') +
  '</div>';
}

function renderTab(tabId) {
  const panel = document.getElementById('panel-' + tabId);
  if (!panel) return;
  const query = (searchBox && searchBox.value || '').trim().toLowerCase();
  let list = filterForTab(tabId, allPatients);
  if (query) {
    list = list.filter(function(p){
      return (p.name && p.name.toLowerCase().indexOf(query) !== -1) ||
             (p.hn && p.hn.toLowerCase().indexOf(query) !== -1) ||
             (p.tbId && p.tbId.toLowerCase().indexOf(query) !== -1);
    });
  }
  const filterBarHtml = tabId === 'all' ? filterBarForAllHtml() : '';
  if (list.length === 0) {
    panel.innerHTML = filterBarHtml + '<div class="placeholder"><i class="ti ti-mood-empty"></i><h2>ไม่พบข้อมูล</h2><p>ลองค้นหาด้วยคำอื่น หรือยังไม่มีผู้ป่วยในหมวดนี้</p></div>';
    if (tabId === 'all') wireFilterBar();
    return;
  }
  const useVisitChip = (tabId === 'zone');
  panel.innerHTML = filterBarHtml + '<div class="count-line">พบ ' + list.length + ' รายการ</div>' +
    list.map(function(p){ return patientRow(p, useVisitChip); }).join('');
  panel.querySelectorAll('.demo-row[data-tbid]').forEach(function(row){
    row.addEventListener('click', function(){
      openDetailModal(row.getAttribute('data-tbid'));
    });
  });
  panel.querySelectorAll('.row-map-btn[data-map]').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      const coords = btn.getAttribute('data-map');
      window.open('https://www.google.com/maps?q=' + encodeURIComponent(coords), '_blank');
    });
  });
  if (tabId === 'all') wireFilterBar();
}

function wireFilterBar() {
  const statusSelect = document.getElementById('filterStatusSelect');
  const zoneSelect = document.getElementById('filterZoneSelect');
  const clearBtn = document.getElementById('filterClearBtn');
  if (statusSelect) statusSelect.addEventListener('change', function(){
    filterStatusVal = statusSelect.value;
    renderTab('all');
  });
  if (zoneSelect) zoneSelect.addEventListener('change', function(){
    filterZoneVal = zoneSelect.value;
    renderTab('all');
  });
  if (clearBtn) clearBtn.addEventListener('click', function(){
    filterStatusVal = '';
    filterZoneVal = '';
    renderTab('all');
  });
}

function initials(name) {
  const cleaned = (name || '').replace(/^(นาย|นาง|นางสาว|น\.ส\.|ด\.ช\.|ด\.ญ\.)\s*/,'').trim();
  return cleaned.substring(0, 2) || '?';
}

function statusChip(p) {
  const text = p.statusBadge || (p.isDischarged ? 'จำหน่าย' : 'กำลังรักษา');
  let cls = 'neutral';
  let icon = 'ti-info-circle';
  if (/หาย|ครบ/.test(text)) { cls = 'success'; icon = 'ti-check'; }
  else if (/ตาย/.test(text)) { cls = 'danger'; icon = 'ti-alert-triangle'; }
  else if (/ขาดยา|MDR/.test(text)) { cls = 'danger'; icon = 'ti-alert-triangle'; }
  else if (/โอนออก/.test(text)) { cls = 'neutral'; icon = 'ti-arrow-right'; }
  else { cls = 'amber'; icon = 'ti-clock'; }
  return '<div class="status-chip ' + cls + '"><i class="ti ' + icon + '"></i>' + escapeHtml(text) + '</div>';
}

function visitChip(p) {
  const visited = p.visitStatus === 'เยี่ยมบ้านแล้ว';
  const text = p.visitStatus || 'ยังไม่ได้เยี่ยมบ้าน';
  const cls = visited ? 'success' : 'danger';
  const icon = visited ? 'ti-truck' : 'ti-truck-off';
  return '<div class="status-chip ' + cls + '"><i class="ti ' + icon + '"></i>' + escapeHtml(text) + '</div>';
}

function timelineHtml(p) {
  const total = p.totalMonths || 6;
  let elapsed = Math.min(p.monthsElapsed || 0, total);
  if (p.isDischarged) elapsed = total;
  const ratio = total > 0 ? elapsed / total : 0;
  const filledSegments = p.isDischarged ? 6 : Math.round(ratio * 6);
  let html = '<div class="tx-timeline">';
  for (let i = 0; i < 6; i++) {
    let cls = 'tx-seg';
    if (i < filledSegments - 1) cls += ' filled';
    else if (i === filledSegments - 1 && !p.isDischarged) cls += ' current';
    else if (i < filledSegments) cls += ' filled';
    html += '<div class="' + cls + '"></div>';
  }
  html += '</div>';
  return html;
}

function patientRow(p, useVisitChip) {
  const avatarHtml = p.photoUrl
    ? '<img class="avatar-img" src="' + escapeHtml(p.photoUrl) + '" alt="" referrerpolicy="no-referrer" onerror="this.outerHTML=\'<div class=&quot;avatar&quot;>' + escapeHtml(initials(p.name)) + '</div>\'">'
    : '<div class="avatar">' + escapeHtml(initials(p.name)) + '</div>';
  const mapBtn = p.houseMap
    ? '<button class="row-map-btn" data-map="' + escapeHtml(p.houseMap) + '" title="เปิดแผนที่"><i class="ti ti-map-pin"></i></button>'
    : '';
  const phoneBtn = p.phone
    ? '<a class="row-map-btn" href="tel:' + escapeHtml(p.phone) + '" title="โทรออก" onclick="event.stopPropagation()"><i class="ti ti-phone"></i></a>'
    : '';
  return '<div class="demo-row" data-tbid="' + escapeHtml(p.tbId) + '">' +
    avatarHtml +
    '<div class="demo-info">' +
      '<div class="demo-id">' + escapeHtml(p.tbId) + (p.hn ? ' &middot; HN ' + escapeHtml(p.hn) : '') + '</div>' +
      '<div class="demo-name">' + escapeHtml(p.name || 'ไม่มีชื่อ') + '</div>' +
      (useVisitChip ? '<div class="row-sub">' + escapeHtml(p.treatStatus || '') + '</div>' : timelineHtml(p)) +
    '</div>' +
    '<div class="row-actions">' + phoneBtn + mapBtn + (useVisitChip ? visitChip(p) : statusChip(p)) + '</div>' +
  '</div>';
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

function updateTopControls(id) {
  const showFab = LIST_TABS.indexOf(id) !== -1;
  const showSearch = SEARCH_TABS.indexOf(id) !== -1;
  document.getElementById('fabAdd').style.display = showFab ? 'flex' : 'none';
  document.getElementById('exportExcelBtn').style.display = showFab ? 'flex' : 'none';
  document.querySelector('.search').style.display = showSearch ? 'flex' : 'none';
}

function selectTab(id) {
  currentTab = id;
  document.querySelectorAll('.nav-item').forEach(function(el){ el.classList.toggle('active', el.dataset.id === id); });
  document.querySelectorAll('.bn-item').forEach(function(el){ el.classList.toggle('active', el.dataset.id === id); });
  document.querySelectorAll('.panel').forEach(function(el){ el.classList.toggle('active', el.id === 'panel-' + id); });
  const t = TABS.find(function(x){ return x.id === id; });
  document.getElementById('pageTitle').textContent = t.label;
  document.getElementById('pageSub').textContent = t.sub;
  updateTopControls(id);
  if (id === 'contact') initContactTab();
  if (id === 'visit') initVisitTab();
  if (id === 'homevisit') initHomeVisitTab();
  if (id === 'lab') initLabTab();
  if (id === 'activitylog') renderActivityLog();
  if (id === 'map') {
    initMapIfNeeded();
    setTimeout(function(){
      leafletMap.invalidateSize();
      renderMapMarkers(searchBox ? searchBox.value.trim() : '');
    }, 80);
  }
}

function setupClearableSearch(inputId, clearBtnId, onChange) {
  const input = document.getElementById(inputId);
  const clearBtn = document.getElementById(clearBtnId);
  if (!input || !clearBtn) return;
  function refresh() {
    clearBtn.style.display = input.value ? 'flex' : 'none';
  }
  input.addEventListener('input', refresh);
  clearBtn.addEventListener('click', function(){
    input.value = '';
    refresh();
    input.focus();
    onChange('');
  });
  refresh();
}

if (searchBox) {
  searchBox.addEventListener('input', function(){
    if (currentTab === 'map') renderMapMarkers(searchBox.value.trim());
    else renderTab(currentTab);
  });
  setupClearableSearch('searchInput', 'searchInputClear', function(){
    if (currentTab === 'map') renderMapMarkers('');
    else renderTab(currentTab);
  });
}

/* ---------------- เพิ่มผู้ป่วยใหม่ ---------------- */

const OPT = {
  classify: ['วัณโรคปอด', 'วัณโรคนอกปอด'],
  treatStatus: ['กำลังรักษา', 'จำหน่าย'],
  regimen: ['2HRZE/4HR', '3HRZE/4HR', '2HRE/7HR', '2RZE'],
  hivConsent: ['ยินยอมตรวจ', 'ไม่ยินยอมตรวจ', 'เป็น HIV ก่อนมารักษา'],
  hivResult: ['Neg', 'Pos'],
  comorbidQuick: ['HT', 'DM', 'หัวใจ'],
  patientStatus: ['New M+', 'New M-', 'relapse', 'EP TB เยื่อหุ้มปอด', 'รักษาหลังจากล้มเหลว', 'รักษาหลังจากขาดยา', 'รับโอนจาก ที่อื่น', 'EP TB ต่อมน้ำเหลือง', 'EP TB ลำไส้', 'EP TB กระดูกและข้อ', 'EP TB เยื่อบุช่องท้องอักเสบจากวัณโรค (Peritonitis)', 'EP TB pericarditis เยื่อหุ้มหัวใจอักเสบจากการติดเชื้อวัณโรค'],
  dischargeBy: ['หาย (Cured)', 'ครบ (completed)', 'จำหน่ายขาดยาติดต่อกัน 2เดือน', 'ตาย (Died)', 'โอนออก (Transferred out)', 'เปลี่ยนสูตร', 'ล้มเหลว', 'เปลี่ยนแปลงการวินิจฉัย'],
  gender: ['ชาย', 'หญิง'],
  tambon: ['ศรีสาคร', 'ซากอ', 'เชิงคีรี', 'กาหลง', 'ตะมะยูง', 'ศรีบรรพต'],
  zone: ['โรงพยาบาล', 'รพ.สต.บ้านกลูบี', 'รพ.สต.บ้านตืองอ', 'รพ.สต.บ้านตามุง', 'รพ.สต.บ้านไอร์แยง', 'รพ.สต.ตะมะยูง', 'รพ.สต.บ้านป่าไผ่', 'นอกเขตอำเภอศรีสาคร'],
  visitStatus: ['เยี่ยมบ้านแล้ว', 'ยังไม่ได้เยี่ยมบ้าน'],
  medLogStatus: ['บันทึกกินยา', 'ไม่บันทึกกินยา'],
  dataComplete: ['ครบ', 'ไม่ครบ'],
  medSchedule: ['อาทิตย์ที่ 1-2', 'อาทิตย์ที่ 3-4', 'เดือนที่ 2', 'เดือนที่ 3', 'เดือนที่ 3-4', 'เดือนที่ 4', 'เดือนที่ 4-5', 'เดือนที่ 5', 'เดือนที่ 5-6', 'เดือนที่ 6', 'พิจารณา D/C TB', 'เดือนที่ 6-7', 'เดือนที่ 7', 'เดือนที่ 7-8', 'เดือนที่ 8', 'เดือนที่ 9', 'เดือนที่9-10', 'เดือนที่ 10', 'เดือนที่ 10-11', 'เดือนที่ 11', 'เดือนที่ 11-12', 'เดือนที่ 12'],
};

const selectedComorbid = [];
const photoData = { patient: '', house: '', visit: '' };

function el(tag, attrs, children) {
  const e = document.createElement(tag);
  Object.keys(attrs || {}).forEach(function(k){
    if (k === 'text') e.textContent = attrs[k];
    else e.setAttribute(k, attrs[k]);
  });
  (children || []).forEach(function(c){ e.appendChild(c); });
  return e;
}

function fieldGroup(labelText, inputEl) {
  const wrap = el('div', { class: 'field-group' });
  wrap.appendChild(el('label', { text: labelText }));
  wrap.appendChild(inputEl);
  return wrap;
}

function makeSelect(id, options, placeholder) {
  const s = el('select', { id: id });
  s.appendChild(el('option', { value: '', text: placeholder || 'เลือก...' }));
  options.forEach(function(o){ s.appendChild(el('option', { value: o, text: o })); });
  return s;
}

function makeInput(id, type) {
  return el('input', { id: id, type: type || 'text' });
}

function sectionLabel(text) {
  return el('div', { class: 'section-label', text: text });
}

function buildPaneT1() {
  const pane = document.getElementById('pane-t1');
  pane.innerHTML = '';
  pane.appendChild(fieldGroup('ลำดับ TB', makeInput('fld_tbId')));
  pane.appendChild(fieldGroup('สถานะการรักษา', makeSelect('fld_treatStatus', OPT.treatStatus)));
  pane.appendChild(fieldGroup('จำแนกผู้ป่วย', makeSelect('fld_classify', OPT.classify)));
  pane.appendChild(fieldGroup('วันที่ขึ้นทะเบียน', makeInput('fld_regDate', 'date')));
  pane.appendChild(fieldGroup('สูตรยา TB', makeSelect('fld_regimen', OPT.regimen)));

  const hivSelect = makeSelect('fld_hivConsent', OPT.hivConsent, 'เลือก...');
  const hivResultWrap = el('div', { class: 'field-group', id: 'hivResultWrap', style: 'display:none;' });
  hivResultWrap.appendChild(el('label', { text: 'ผลตรวจ HIV' }));
  hivResultWrap.appendChild(makeSelect('fld_hivResult', OPT.hivResult));
  hivSelect.addEventListener('change', function(){
    hivResultWrap.style.display = hivSelect.value === 'ยินยอมตรวจ' ? 'block' : 'none';
  });
  pane.appendChild(fieldGroup('ตรวจ HIV', hivSelect));
  pane.appendChild(hivResultWrap);

  const comorbidWrap = el('div', { class: 'field-group' });
  comorbidWrap.appendChild(el('label', { text: 'โรคประจำตัว' }));
  const tagRow = el('div', { class: 'tag-row', id: 'comorbidTags' });
  OPT.comorbidQuick.forEach(function(name){
    const chip = el('div', { class: 'tag-chip', 'data-val': name, text: name });
    chip.addEventListener('click', function(){ toggleComorbid(name, chip); });
    tagRow.appendChild(chip);
  });
  comorbidWrap.appendChild(tagRow);
  const addRow = el('div', { class: 'tag-add-row' });
  const addInput = makeInput('comorbidCustomInput');
  addInput.placeholder = 'เพิ่มรายการอื่น...';
  const addBtn = el('button', { class: 'btn-ghost', type: 'button', text: '+ เพิ่ม' });
  addBtn.addEventListener('click', function(){
    const v = addInput.value.trim();
    if (v && selectedComorbid.indexOf(v) === -1) {
      selectedComorbid.push(v);
      const chip = el('div', { class: 'tag-chip selected', 'data-val': v, text: v });
      chip.addEventListener('click', function(){ toggleComorbid(v, chip); });
      tagRow.appendChild(chip);
      addInput.value = '';
    }
  });
  addRow.appendChild(addInput);
  addRow.appendChild(addBtn);
  comorbidWrap.appendChild(addRow);
  pane.appendChild(comorbidWrap);

  const row1 = el('div', { class: 'field-row' });
  row1.appendChild(fieldGroup('น้ำหนักเริ่มยา (กก.)', makeInput('fld_startWeight', 'number')));
  row1.appendChild(fieldGroup('วันที่เริ่มยา TB', makeInput('fld_startDate', 'date')));
  pane.appendChild(row1);

  pane.appendChild(fieldGroup('สถานะคนไข้ TB', makeSelect('fld_patientStatus', OPT.patientStatus)));
  pane.appendChild(fieldGroup('รับโอนจาก', makeInput('fld_transferFrom')));

  const row2 = el('div', { class: 'field-row' });
  row2.appendChild(fieldGroup('วันที่จำหน่าย TB', makeInput('fld_dischargeDate', 'date')));
  row2.appendChild(fieldGroup('จำหน่ายโดย', makeSelect('fld_dischargeBy', OPT.dischargeBy)));
  pane.appendChild(row2);
}

function toggleComorbid(name, chip) {
  const idx = selectedComorbid.indexOf(name);
  if (idx === -1) { selectedComorbid.push(name); chip.classList.add('selected'); }
  else { selectedComorbid.splice(idx, 1); chip.classList.remove('selected'); }
}

function photoField(labelText, key) {
  const wrap = el('div', { class: 'field-group' });
  wrap.appendChild(el('label', { text: labelText }));
  const box = el('div', { class: 'photo-input' });
  const preview = el('div', { class: 'ph-placeholder', id: 'preview_' + key });
  preview.innerHTML = '<i class="ti ti-camera"></i>';
  const inputId = 'file_' + key;
  const fileInput = el('input', { type: 'file', accept: 'image/*', id: inputId, style: 'display:none;' });
  const label = el('label', { for: inputId, text: 'เลือกรูปภาพ' });
  fileInput.addEventListener('change', function(e){
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev){
      photoData[key] = ev.target.result;
      const img = document.createElement('img');
      img.src = ev.target.result;
      const ph = document.getElementById('preview_' + key);
      ph.innerHTML = '';
      ph.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
  box.appendChild(preview);
  box.appendChild(label);
  box.appendChild(fileInput);
  wrap.appendChild(box);
  return wrap;
}

function buildPaneT2() {
  const pane = document.getElementById('pane-t2');
  pane.innerHTML = '';

  pane.appendChild(sectionLabel('ข้อมูลผู้ป่วย'));
  pane.appendChild(fieldGroup('HN', makeInput('fld_hn')));
  pane.appendChild(fieldGroup('เพศ', makeSelect('fld_gender', OPT.gender)));
  pane.appendChild(fieldGroup('ชื่อ-สกุล', makeInput('fld_name')));
  pane.appendChild(fieldGroup('เลข 13 หลัก', makeInput('fld_citizenId')));
  pane.appendChild(fieldGroup('อายุ', makeInput('fld_age', 'number')));
  pane.appendChild(fieldGroup('ที่อยู่บ้านเลขที่', makeInput('fld_houseNo')));

  const row1 = el('div', { class: 'field-row' });
  row1.appendChild(fieldGroup('หมู่', makeInput('fld_moo', 'number')));
  row1.appendChild(fieldGroup('ตำบล', makeSelect('fld_tambon', OPT.tambon)));
  pane.appendChild(row1);

  pane.appendChild(fieldGroup('นอกเขต', makeInput('fld_outZone')));
  pane.appendChild(fieldGroup('เขต', makeSelect('fld_zone', OPT.zone)));
  pane.appendChild(fieldGroup('เบอร์โทร', makeInput('fld_phone')));
  pane.appendChild(photoField('รูปคนไข้', 'patient'));

  pane.appendChild(sectionLabel('ข้อมูล อสม. และการเยี่ยมบ้าน'));
  pane.appendChild(fieldGroup('ชื่อ อสม. รับผิดชอบ', makeInput('fld_asmName')));
  pane.appendChild(fieldGroup('เบอร์ อสม.', makeInput('fld_asmPhone')));

  const geoWrap = el('div', { class: 'field-group' });
  geoWrap.appendChild(el('label', { text: 'แผนที่บ้านคนไข้ (พิกัด)' }));
  const geoRow = el('div', { class: 'geo-row' });
  const geoInput = makeInput('fld_houseMap');
  geoInput.placeholder = 'ละติจูด, ลองจิจูด';
  const geoBtn = el('button', { class: 'geo-btn', type: 'button' });
  geoBtn.innerHTML = '<i class="ti ti-map-pin"></i>';
  geoBtn.addEventListener('click', function(){
    if (!navigator.geolocation) return;
    geoBtn.innerHTML = '<i class="ti ti-loader-2"></i>';
    navigator.geolocation.getCurrentPosition(function(pos){
      geoInput.value = pos.coords.latitude.toFixed(6) + ', ' + pos.coords.longitude.toFixed(6);
      geoBtn.innerHTML = '<i class="ti ti-map-pin"></i>';
    }, function(){
      geoBtn.innerHTML = '<i class="ti ti-map-pin"></i>';
    });
  });
  geoRow.appendChild(geoInput);
  geoRow.appendChild(geoBtn);
  geoWrap.appendChild(geoRow);
  pane.appendChild(geoWrap);

  pane.appendChild(photoField('รูปหน้าบ้านคนไข้', 'house'));
  pane.appendChild(fieldGroup('สถานะเยี่ยมบ้าน', makeSelect('fld_visitStatus', OPT.visitStatus)));
  pane.appendChild(photoField('รูปเยี่ยมบ้าน', 'visit'));

  pane.appendChild(sectionLabel('การติดตามการรักษาและเอกสาร'));
  pane.appendChild(fieldGroup('สถานะบันทึกการกินยา', makeSelect('fld_medLogStatus', OPT.medLogStatus)));
  pane.appendChild(fieldGroup('วันนี้รับยาที่', makeSelect('fld_todayMedAt', OPT.medSchedule)));
  pane.appendChild(fieldGroup('วันที่นัดรับยาถัดไป', makeInput('fld_nextApptDate', 'date')));
  pane.appendChild(fieldGroup('รับยาที่เท่าไหร่', makeSelect('fld_nextMedAt', OPT.medSchedule)));
  pane.appendChild(fieldGroup('สถานะข้อมูลครบ', makeSelect('fld_dataComplete', OPT.dataComplete)));
  pane.appendChild(fieldGroup('จำนวนวันจัดยา', makeInput('fld_medDays', 'number')));

  const noteWrap = el('div', { class: 'field-group' });
  noteWrap.appendChild(el('label', { text: 'หมายเหตุ' }));
  noteWrap.appendChild(el('textarea', { id: 'fld_note', rows: '3' }));
  pane.appendChild(noteWrap);
}

function val(id) {
  const e = document.getElementById(id);
  return e ? e.value.trim() : '';
}

let modalMode = 'add';
let editingTbId = null;

function openFormModal(mode, tbId) {
  modalMode = mode;
  editingTbId = tbId || null;
  buildPaneT1();
  buildPaneT2();
  selectedComorbid.length = 0;
  photoData.patient = ''; photoData.house = ''; photoData.visit = '';
  document.getElementById('modalError').textContent = '';
  document.querySelectorAll('.modal-tab').forEach(function(t, i){ t.classList.toggle('active', i === 0); });
  document.querySelectorAll('.modal-pane').forEach(function(p, i){ p.classList.toggle('active', i === 0); });
  document.getElementById('formModalTitle').textContent = mode === 'edit' ? 'แก้ไขข้อมูลผู้ป่วย' : 'เพิ่มผู้ป่วยใหม่';
  document.getElementById('fld_tbId').disabled = (mode === 'edit');
  document.getElementById('modalOverlay').classList.add('open');

  if (mode === 'edit') {
    const body = document.querySelector('#modalOverlay .modal-body');
    body.style.opacity = '0.5';
    google.script.run.withSuccessHandler(function(res){
      body.style.opacity = '1';
      if (!res || !res.ok) {
        document.getElementById('modalError').textContent = (res && res.error) || 'โหลดข้อมูลไม่สำเร็จ';
        return;
      }
      setFormValues(res.data);
    }).withFailureHandler(function(err){
      body.style.opacity = '1';
      document.getElementById('modalError').textContent = (err && err.message) || String(err);
    }).getPatientDetail(tbId);
  }
}

function setFormValues(data) {
  const ids = ['tbId','treatStatus','classify','regDate','regimen','startWeight','startDate',
    'patientStatus','transferFrom','dischargeDate','dischargeBy','hn','gender','name','citizenId',
    'age','houseNo','moo','tambon','outZone','asmName','asmPhone','houseMap','visitStatus',
    'medLogStatus','todayMedAt','nextApptDate','nextMedAt','dataComplete','note','medDays','phone'];
  function setSelectOrInput(e, value) {
    if (!e || value === undefined) return;
    if (e.tagName === 'SELECT' && value) {
      const hasOption = Array.prototype.some.call(e.options, function(o){ return o.value === value; });
      if (!hasOption) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = value;
        e.appendChild(opt);
      }
    }
    e.value = value;
  }

  ids.forEach(function(key){
    setSelectOrInput(document.getElementById('fld_' + key), data[key]);
  });
  setSelectOrInput(document.getElementById('fld_zone'), data.zoneField);

  const hivEl = document.getElementById('fld_hivConsent');
  if (hivEl) {
    hivEl.value = data.hivConsent || '';
    hivEl.dispatchEvent(new Event('change'));
  }
  const hivResultEl = document.getElementById('fld_hivResult');
  if (hivResultEl) hivResultEl.value = data.hivResult || '';

  (data.comorbidList || []).forEach(function(name){
    const tagRow = document.getElementById('comorbidTags');
    let chip = tagRow.querySelector('.tag-chip[data-val="' + name.replace(/"/g, '') + '"]');
    if (!chip) {
      chip = el('div', { class: 'tag-chip', 'data-val': name, text: name });
      chip.addEventListener('click', function(){ toggleComorbid(name, chip); });
      tagRow.appendChild(chip);
    }
    if (selectedComorbid.indexOf(name) === -1) selectedComorbid.push(name);
    chip.classList.add('selected');
  });

  if (data.photoUrl) {
    const ph = document.getElementById('preview_patient');
    if (ph) ph.innerHTML = '<img src="' + data.photoUrl + '" alt="">';
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

document.getElementById('fabAdd').addEventListener('click', function(){ openFormModal('add'); });
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', function(e){
  if (e.target === this) closeModal();
});
document.querySelectorAll('.modal-tab').forEach(function(tab){
  tab.addEventListener('click', function(){
    document.querySelectorAll('.modal-tab').forEach(function(t){ t.classList.remove('active'); });
    document.querySelectorAll('.modal-pane').forEach(function(p){ p.classList.remove('active'); });
    tab.classList.add('active');
    document.getElementById('pane-' + tab.dataset.tab).classList.add('active');
  });
});

document.getElementById('modalSave').addEventListener('click', function(){
  const tbId = val('fld_tbId');
  if (!tbId) {
    document.getElementById('modalError').textContent = 'กรุณาระบุลำดับ TB';
    return;
  }

  let hivTestFinal = '';
  const hivConsent = val('fld_hivConsent');
  if (hivConsent === 'ยินยอมตรวจ') hivTestFinal = 'ตรวจ ผล ' + val('fld_hivResult');
  else if (hivConsent === 'ไม่ยินยอมตรวจ') hivTestFinal = 'ไม่ตรวจ';
  else if (hivConsent === 'เป็น HIV ก่อนมารักษา') hivTestFinal = 'เป็น HIV ก่อนมารักษา TB';

  const payload = {
    tbId: tbId,
    treatStatus: val('fld_treatStatus'),
    classify: val('fld_classify'),
    regDate: val('fld_regDate'),
    regimen: val('fld_regimen'),
    hivTestFinal: hivTestFinal,
    comorbid: selectedComorbid.slice(),
    startWeight: val('fld_startWeight'),
    startDate: val('fld_startDate'),
    patientStatus: val('fld_patientStatus'),
    transferFrom: val('fld_transferFrom'),
    dischargeDate: val('fld_dischargeDate'),
    dischargeBy: val('fld_dischargeBy'),
    hn: val('fld_hn'),
    gender: val('fld_gender'),
    name: val('fld_name'),
    citizenId: val('fld_citizenId'),
    age: val('fld_age'),
    houseNo: val('fld_houseNo'),
    moo: val('fld_moo'),
    tambon: val('fld_tambon'),
    outZone: val('fld_outZone'),
    zoneField: val('fld_zone'),
    phone: val('fld_phone'),
    patientPhoto: photoData.patient,
    asmName: val('fld_asmName'),
    asmPhone: val('fld_asmPhone'),
    houseMap: val('fld_houseMap'),
    housePhoto: photoData.house,
    visitPhoto: photoData.visit,
    visitStatus: val('fld_visitStatus'),
    medLogStatus: val('fld_medLogStatus'),
    todayMedAt: val('fld_todayMedAt'),
    nextApptDate: val('fld_nextApptDate'),
    nextMedAt: val('fld_nextMedAt'),
    dataComplete: val('fld_dataComplete'),
    note: val('fld_note'),
    medDays: val('fld_medDays'),
    username: currentUsername(),
  };

  const saveBtn = document.getElementById('modalSave');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="ti ti-loader-2"></i>กำลังบันทึก...';
  document.getElementById('modalError').textContent = '';

  google.script.run.withSuccessHandler(function(result){
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="ti ti-device-floppy"></i>บันทึก';
    if (!result || !result.ok) {
      document.getElementById('modalError').textContent = (result && result.error) || 'บันทึกไม่สำเร็จ';
      return;
    }
    showToast(modalMode === 'edit' ? 'แก้ไขข้อมูลผู้ป่วยสำเร็จ' : 'เพิ่มผู้ป่วยใหม่สำเร็จ', 'success');
    closeModal();
    renderLoading('all');
    google.script.run.withSuccessHandler(onDataLoaded).withFailureHandler(onLoadError).getPatientData();
  }).withFailureHandler(function(err){
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="ti ti-device-floppy"></i>บันทึก';
    document.getElementById('modalError').textContent = (err && err.message) || String(err);
  })[modalMode === 'edit' ? 'updatePatient' : 'addPatient'].apply(null, modalMode === 'edit' ? [editingTbId, payload] : [payload]);
});

/* ---------------- ดูรายละเอียดผู้ป่วย ---------------- */

function closeDetailModal() {
  document.getElementById('detailOverlay').classList.remove('open');
}

document.getElementById('detailClose').addEventListener('click', closeDetailModal);
document.getElementById('detailCloseBtn').addEventListener('click', closeDetailModal);
document.getElementById('detailOverlay').addEventListener('click', function(e){
  if (e.target === this) closeDetailModal();
});
document.getElementById('detailEditBtn').addEventListener('click', function(){
  const tbId = document.getElementById('detailEditBtn').dataset.tbid;
  closeDetailModal();
  openFormModal('edit', tbId);
});

function detailRow(label, value) {
  if (value === undefined || value === null || value === '') return '';
  return '<div class="detail-row"><div class="dl">' + escapeHtml(label) + '</div><div class="dv">' + escapeHtml(value) + '</div></div>';
}

let currentDetailData = null;

function skeletonDetailBody() {
  const row = '<div class="sk-detail-row"><div class="sk sk-line" style="width:70px;height:11px;"></div><div class="sk sk-line" style="width:110px;height:11px;"></div></div>';
  return '<div class="sk sk-detail-photo"></div>' + new Array(7).fill(0).map(function(){ return row; }).join('');
}

const DETAIL_TABS = ['general', 'treatment', 'lab', 'contact'];

function detailTabContent(key, d) {
  if (key === 'general') {
    let html = '';
    if (d.photoUrl) html += '<img class="detail-photo" src="' + escapeHtml(d.photoUrl) + '" alt="">';
    html += detailRow('ชื่อ-สกุล', d.name);
    html += detailRow('HN', d.hn);
    html += detailRow('เพศ / อายุ', [d.gender, d.age ? d.age + ' ปี' : ''].filter(Boolean).join(' / '));
    html += detailRow('เลข 13 หลัก', d.citizenId);
    html += detailRow('เบอร์โทร', d.phone);
    html += detailRow('ที่อยู่', [d.houseNo, d.moo ? 'หมู่ ' + d.moo : '', d.tambon].filter(Boolean).join(' '));
    html += detailRow('เขต', d.zoneField);
    html += detailRow('นอกเขต', d.outZone);
    html += detailRow('ชื่อ อสม.', d.asmName);
    html += detailRow('เบอร์ อสม.', d.asmPhone);
    html += detailRow('สถานะเยี่ยมบ้าน', d.visitStatus);
    if (d.houseMap) {
      html += '<div class="detail-row"><div class="dl">พิกัดบ้าน</div><div class="dv"><a href="https://www.google.com/maps?q=' +
        encodeURIComponent(d.houseMap) + '" target="_blank">' + escapeHtml(d.houseMap) + '</a></div></div>';
    }
    if (d.housePhotoUrl) {
      html += '<div class="section-label">รูปหน้าบ้าน</div>' +
        '<img src="' + escapeHtml(d.housePhotoUrl) + '" alt="" class="detail-photo" style="cursor:pointer;" onclick="openPhotoLightbox(this.src)">';
    }
    return html;
  }
  if (key === 'treatment') {
    let html = '';
    html += detailRow('สถานะการรักษา', d.treatStatus);
    html += detailRow('จำแนกผู้ป่วย', d.classify);
    html += detailRow('สูตรยา TB', d.regimen);
    html += detailRow('วันที่ขึ้นทะเบียน', d.regDate);
    html += detailRow('วันที่เริ่มยา', d.startDate);
    html += detailRow('น้ำหนักเริ่มยา', d.startWeight);
    html += detailRow('สถานะคนไข้ TB', d.patientStatus);
    html += detailRow('โรคประจำตัว', (d.comorbidList || []).join(', '));
    html += detailRow('รับโอนจาก', d.transferFrom);
    html += detailRow('วันที่จำหน่าย', d.dischargeDate);
    html += detailRow('จำหน่ายโดย', d.dischargeBy);
    html += detailRow('ตรวจ HIV', [d.hivConsent, d.hivResult].filter(Boolean).join(' - '));
    html += detailRow('วันนี้รับยาที่', d.todayMedAt);
    html += detailRow('สถานะบันทึกการกินยา', d.medLogStatus);
    html += detailRow('วันที่นัดรับยาถัดไป', d.nextApptDate);
    html += detailRow('รับยาที่เท่าไหร่', d.nextMedAt);
    html += detailRow('สถานะข้อมูลครบ', d.dataComplete);
    html += detailRow('จำนวนวันจัดยา', d.medDays);
    html += detailRow('หมายเหตุ', d.note);
    return html;
  }
  if (key === 'lab') {
    if (!d.labRecords || !d.labRecords.length) {
      return '<div class="placeholder"><i class="ti ti-flask"></i><h2>ไม่มีผลแลป</h2></div>';
    }
    let html = '';
    d.labRecords.forEach(function(lab){
      html += detailRow('วันที่ตรวจ', lab['วันที่ตรวจ']);
      html += detailRow('ชนิดส่งตรวจ', lab['ชนิดส่งตรวจ']);
      html += detailRow('สาเหตุส่งตรวจ', lab['สาเหตุส่งตรวจ']);
      html += '<div class="detail-row"><div class="dl">ผลเสมหะ</div><div class="dv">' + labResultBadge(lab['ผลเสมหะ']) + '</div></div>';
      html += detailRow('หมายเหตุ', lab['หมายเหตุ']);
      html += detailRow('Serial Number', lab['Serial Number']);
      html += '<div style="border-bottom:1px dashed var(--border); margin:10px 0;"></div>';
    });
    return html;
  }
  if (key === 'contact') {
    if (!d.contactRecords || !d.contactRecords.length) {
      return '<div class="placeholder"><i class="ti ti-users"></i><h2>ไม่มีข้อมูลผู้สัมผัสร่วมบ้าน</h2></div>';
    }
    let html = '';
    d.contactRecords.forEach(function(c){
      Object.keys(c).forEach(function(k){
        if (k !== 'TB') html += detailRow(k, c[k]);
      });
      html += '<div style="border-bottom:1px dashed var(--border); margin:10px 0;"></div>';
    });
    return html;
  }
  return '';
}

function switchDetailTab(key) {
  document.querySelectorAll('.detail-tab-btn').forEach(function(btn){
    btn.classList.toggle('active', btn.dataset.dtab === key);
  });
  document.querySelectorAll('.detail-tab-pane').forEach(function(pane){
    pane.classList.toggle('active', pane.id === 'dpane-' + key);
  });
}

function openDetailModal(tbId) {
  document.getElementById('detailTitle').textContent = tbId;
  document.getElementById('detailEditBtn').dataset.tbid = tbId;
  document.getElementById('detailBody').innerHTML = skeletonDetailBody();
  document.getElementById('detailOverlay').classList.add('open');

  google.script.run.withSuccessHandler(function(res){
    const body = document.getElementById('detailBody');
    if (!res || !res.ok) {
      body.innerHTML = '<div class="placeholder"><i class="ti ti-alert-triangle"></i><h2>' + escapeHtml((res && res.error) || 'โหลดไม่สำเร็จ') + '</h2></div>';
      return;
    }
    const d = res.data;
    currentDetailData = d;

    let html = '';
    DETAIL_TABS.forEach(function(key, i){
      html += '<div class="detail-tab-pane' + (i === 0 ? ' active' : '') + '" id="dpane-' + key + '">' + detailTabContent(key, d) + '</div>';
    });
    body.innerHTML = html;

    document.querySelectorAll('.detail-tab-btn').forEach(function(btn, i){
      btn.classList.toggle('active', i === 0);
      btn.onclick = function(){ switchDetailTab(btn.dataset.dtab); };
    });
  }).withFailureHandler(function(err){
    document.getElementById('detailBody').innerHTML = '<div class="placeholder"><i class="ti ti-alert-triangle"></i><h2>' + escapeHtml((err && err.message) || String(err)) + '</h2></div>';
  }).getPatientDetail(tbId);
}

/* ---------------- แดชบอร์ดสรุปผลข้อมูล ---------------- */

function countBy(list, keyFn) {
  const out = {};
  list.forEach(function(p){
    const k = keyFn(p) || 'ไม่ระบุ';
    out[k] = (out[k] || 0) + 1;
  });
  return out;
}

const CHART_PALETTE = ['#7C3AED','#2563EB','#F59E0B','#EC4899','#10B981','#F43F5E','#06B6D4','#8B5CF6','#F97316','#14B8A6'];
Chart.register(ChartDataLabels);
Chart.defaults.set('plugins.datalabels', { display: false });

function colorForLabel(label, idx) {
  if (/หาย|ครบ/.test(label)) return '#2E7D4F';
  if (/ตาย/.test(label)) return '#B3261E';
  if (/ขาดยา|MDR/.test(label)) return '#B3261E';
  if (/โอนออก/.test(label)) return '#6B7A76';
  if (/เยี่ยมบ้านแล้ว/.test(label)) return '#2E7D4F';
  if (/ยังไม่ได้เยี่ยม/.test(label)) return '#B3261E';
  return CHART_PALETTE[idx % CHART_PALETTE.length];
}

function makeBarGradient(ctx, chartArea, colorHex) {
  if (!chartArea) return colorHex;
  const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
  gradient.addColorStop(0, colorHex + 'CC');
  gradient.addColorStop(1, colorHex);
  return gradient;
}

const chartInstances = {};

function sortedEntries(counts) {
  return Object.keys(counts).map(function(k){ return [k, counts[k]]; })
    .sort(function(a, b){ return b[1] - a[1]; });
}

function renderBarChart(canvasId, counts) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
  const entries = sortedEntries(counts);
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: entries.map(function(e){ return e[0]; }),
      datasets: [{
        data: entries.map(function(e){ return e[1]; }),
        backgroundColor: function(context) {
          const chart = context.chart;
          const idx = context.dataIndex;
          if (idx === undefined) return CHART_PALETTE[0];
          const colorHex = colorForLabel(entries[idx][0], idx);
          return makeBarGradient(chart.ctx, chart.chartArea, colorHex);
        },
        borderRadius: 6,
      }],
    },
    options: {
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        datalabels: {
          display: true,
          anchor: 'end', align: 'end',
          color: '#16302C', font: { size: 11, weight: '600' },
        },
      },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
      maintainAspectRatio: false,
      layout: { padding: { right: 24 } },
    },
  });
}

function renderPieChart(canvasId, counts) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
  const entries = sortedEntries(counts);
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(function(e){ return e[0]; }),
      datasets: [{
        data: entries.map(function(e){ return e[1]; }),
        backgroundColor: entries.map(function(e, i){ return colorForLabel(e[0], i); }),
        borderColor: '#fff',
        borderWidth: 3,
        hoverOffset: 6,
      }],
    },
    options: {
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        datalabels: {
          display: true,
          color: '#fff', font: { size: 12, weight: '700' },
          formatter: function(value, ctx){
            const total = ctx.dataset.data.reduce(function(a,b){ return a+b; }, 0);
            const pct = total > 0 ? Math.round((value/total)*100) : 0;
            return value + ' (' + pct + '%)';
          },
        },
      },
      maintainAspectRatio: false,
    },
  });
}

function renderDashboard() {
  const panel = document.getElementById('panel-summary');
  if (!panel) return;

  const fromVal = (document.getElementById('dashFrom') || {}).value || '';
  const toVal = (document.getElementById('dashTo') || {}).value || '';
  const fromTs = fromVal ? new Date(fromVal).getTime() : null;
  const toTs = toVal ? new Date(toVal + 'T23:59:59').getTime() : null;

  const list = allPatients.filter(function(p){
    if (!fromTs && !toTs) return true;
    if (!p.regDate) return false;
    if (fromTs && p.regDate < fromTs) return false;
    if (toTs && p.regDate > toTs) return false;
    return true;
  });
  const total = list.length;
  const dischargedList = list.filter(function(p){ return p.isDischarged; });

  const zoneAllCounts = countBy(list, function(p){ return p.zone || 'ไม่ระบุ'; });
  const zoneDischargeCounts = countBy(dischargedList, function(p){ return p.zone || 'ไม่ระบุ'; });
  const patientStatusCounts = countBy(list, function(p){ return p.patientStatus || 'ไม่ระบุ'; });
  const dischargeByCounts = countBy(dischargedList, function(p){ return p.dischargeBy || 'ไม่ระบุ'; });
  const hivCounts = countBy(list, function(p){
    const k = p.hivTest || '';
    if (/Pos/.test(k)) return 'ตรวจ ผล Pos';
    if (/Neg/.test(k)) return 'ตรวจ ผล Neg';
    if (/ไม่ตรวจ/.test(k)) return 'ไม่ยินยอมตรวจ';
    if (/เป็น HIV/.test(k)) return 'เป็น HIV ก่อนมารักษา';
    return 'ไม่ระบุ';
  });
  const genderCounts = countBy(list, function(p){ return p.gender || 'ไม่ระบุ'; });
  const visitCounts = countBy(list, function(p){ return p.visitStatus || 'ไม่ระบุ'; });
  const newMPlus = list.filter(function(p){ return /New M\+/.test(p.patientStatus || ''); });
  const newMPlusOutcome = countBy(newMPlus, function(p){ return p.isDischarged ? (p.dischargeBy || 'ไม่ระบุ') : 'กำลังรักษา'; });

  const curedCount = dischargedList.filter(function(p){ return /หาย|ครบ/.test(p.dischargeBy || ''); }).length;
  const visitedCount = list.filter(function(p){ return p.visitStatus === 'เยี่ยมบ้านแล้ว'; }).length;
  const activeCount = list.length - dischargedList.length;

  const filterBarHtml =
  '<div class="dash-filter-bar">' +
    '<label>จากวันที่ <input type="date" id="dashFrom" value="' + escapeHtml(fromVal) + '"></label>' +
    '<label>ถึงวันที่ <input type="date" id="dashTo" value="' + escapeHtml(toVal) + '"></label>' +
    '<button class="btn-primary" id="dashApply" type="button">กรองข้อมูล</button>' +
    '<button class="btn-ghost" id="dashReset" type="button">ล้างตัวกรอง</button>' +
    (fromTs || toTs ? '<span class="dash-filter-note">แสดงผล ' + list.length + ' จาก ' + allPatients.length + ' ราย</span>' : '') +
  '</div>';

panel.innerHTML =
    filterBarHtml +
    '<div class="hero-grid">' +
      '<div class="hero-card hero-orange dash-animate-item"><div class="hero-label">ผู้ป่วยทั้งหมด</div><div class="hero-number" data-count="' + total + '">0</div><i class="ti ti-users hero-icon"></i></div>' +
      '<div class="hero-card hero-blue dash-animate-item"><div class="hero-label">กำลังรักษา</div><div class="hero-number" data-count="' + activeCount + '">0</div><i class="ti ti-pill hero-icon"></i></div>' +
      '<div class="hero-card hero-green dash-animate-item"><div class="hero-label">หาย/ครบการรักษา</div><div class="hero-number" data-count="' + curedCount + '">0</div><i class="ti ti-circle-check hero-icon"></i></div>' +
      '<div class="hero-card hero-purple dash-animate-item"><div class="hero-label">เยี่ยมบ้านแล้ว</div><div class="hero-number" data-count="' + visitedCount + '">0</div><i class="ti ti-home-check hero-icon"></i></div>' +
    '</div>' +
    '<div class="stat-grid">' +
      '<div class="stat-card half dash-animate-item"><div class="stat-title">จำนวนขึ้นทะเบียนทั้งหมด (แยกตาม รพ.สต.)</div>' +
        '<div class="stat-number" data-count="' + total + '">0</div>' +
        '<div class="chart-box"><canvas id="chartZoneAll"></canvas></div></div>' +

      '<div class="stat-card half dash-animate-item"><div class="stat-title">สถานะคนไข้ TB</div>' +
        '<div class="chart-box"><canvas id="chartPatientStatus"></canvas></div></div>' +

      '<div class="stat-card half dash-animate-item"><div class="stat-title">จำนวนจำหน่าย (แยกตาม รพ.สต.)</div>' +
        '<div class="stat-number" data-count="' + dischargedList.length + '">0</div>' +
        '<div class="chart-box"><canvas id="chartZoneDischarge"></canvas></div></div>' +

      '<div class="stat-card dash-animate-item"><div class="stat-title">จำหน่ายโดย</div>' +
        '<div class="chart-box small"><canvas id="chartDischargeBy"></canvas></div></div>' +

      '<div class="stat-card dash-animate-item"><div class="stat-title">ตรวจ HIV</div>' +
        '<div class="chart-box small"><canvas id="chartHiv"></canvas></div></div>' +

      '<div class="stat-card dash-animate-item"><div class="stat-title">เพศขึ้นทะเบียน</div>' +
        '<div class="chart-box small"><canvas id="chartGender"></canvas></div></div>' +

      '<div class="stat-card dash-animate-item"><div class="stat-title">สถานะเยี่ยมบ้าน</div>' +
        '<div class="chart-box small"><canvas id="chartVisit"></canvas></div></div>' +

      '<div class="stat-card dash-animate-item"><div class="stat-title">ผลรักษา New M+ (' + newMPlus.length + ' ราย)</div>' +
        '<div class="chart-box small"><canvas id="chartNewMPlus"></canvas></div></div>' +
    '</div>';

  renderBarChart('chartZoneAll', zoneAllCounts);
  renderBarChart('chartPatientStatus', patientStatusCounts);
  renderBarChart('chartZoneDischarge', zoneDischargeCounts);
  renderPieChart('chartDischargeBy', dischargeByCounts);
  renderPieChart('chartHiv', hivCounts);
  renderPieChart('chartGender', genderCounts);
  renderPieChart('chartVisit', visitCounts);
  renderPieChart('chartNewMPlus', newMPlusOutcome);

  panel.querySelectorAll('[data-count]').forEach(function(el){
    animateCountUp(el, parseInt(el.getAttribute('data-count'), 10) || 0, 900);
  });

  const dashApplyBtn = document.getElementById('dashApply');
  const dashResetBtn = document.getElementById('dashReset');
  const dashExportBtn = document.getElementById('dashExportPdfBtn');
  if (dashApplyBtn) dashApplyBtn.addEventListener('click', renderDashboard);
  if (dashResetBtn) dashResetBtn.addEventListener('click', function(){
    document.getElementById('dashFrom').value = '';
    document.getElementById('dashTo').value = '';
    renderDashboard();
  });
  if (dashExportBtn) dashExportBtn.addEventListener('click', function(){
    exportDashboardPdf(total, activeCount, curedCount, visitedCount, fromVal, toVal);
  });
}

/* ---------------- ติดตามนัดรับยา ---------------- */

let apptViewMode = 'list';
let apptCalendarDate = new Date();

function isSameDay(ts1, ts2) {
  if (!ts1 || !ts2) return false;
  const a = new Date(ts1), b = new Date(ts2);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function computeApptStatusList() {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekAhead = todayStart.getTime() + 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return allPatients.filter(function(p){ return !p.isDischarged && p.nextApptDateTs; })
    .map(function(p){
      let apptStatus = 'ok';
      if (isSameDay(p.lastVisitDateTs, now)) apptStatus = 'came';
      else if (isSameDay(p.nextApptDateTs, now)) apptStatus = 'today';
      else if (p.nextApptDateTs < todayStart.getTime()) apptStatus = 'overdue';
      else if (p.nextApptDateTs <= weekAhead) apptStatus = 'soon';
      const copy = Object.assign({}, p);
      copy.apptStatus = apptStatus;
      return copy;
    })
    .sort(function(a, b){ return a.nextApptDateTs - b.nextApptDateTs; });
}

function renderApptCalendar(list) {
  const y = apptCalendarDate.getFullYear();
  const m = apptCalendarDate.getMonth();
  const firstWeekday = new Date(y, m, 1).getDay();
  const totalDays = new Date(y, m + 1, 0).getDate();
  const byDay = {};
  list.forEach(function(p){
    const d = new Date(p.nextApptDateTs);
    if (d.getFullYear() === y && d.getMonth() === m) {
      const key = d.getDate();
      (byDay[key] = byDay[key] || []).push(p);
    }
  });
  const monthNames = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  let html = '<div class="cal-header">' +
    '<button id="calPrev" class="btn-ghost" type="button"><i class="ti ti-chevron-left"></i></button>' +
    '<div class="cal-title">' + monthNames[m] + ' ' + (y + 543) + '</div>' +
    '<button id="calNext" class="btn-ghost" type="button"><i class="ti ti-chevron-right"></i></button>' +
  '</div>';
  html += '<div class="cal-grid">';
  ['อา','จ','อ','พ','พฤ','ศ','ส'].forEach(function(d){ html += '<div class="cal-dow">' + d + '</div>'; });
  for (let i = 0; i < firstWeekday; i++) html += '<div class="cal-cell empty"></div>';
  const now = new Date();
  for (let day = 1; day <= totalDays; day++) {
    const items = byDay[day] || [];
    const isToday = now.getFullYear() === y && now.getMonth() === m && now.getDate() === day;
    let dotCls = 'cal-dot-ok';
    if (items.some(function(p){ return p.apptStatus === 'overdue'; })) dotCls = 'cal-dot-danger';
    else if (items.some(function(p){ return p.apptStatus === 'today'; })) dotCls = 'cal-dot-today';
    else if (items.some(function(p){ return p.apptStatus === 'came'; })) dotCls = 'cal-dot-came';
    else if (items.some(function(p){ return p.apptStatus === 'soon'; })) dotCls = 'cal-dot-warn';
    html += '<div class="cal-cell' + (isToday ? ' cal-today' : '') + (items.length ? ' has-items' : '') + '" data-day="' + day + '">' +
      '<div class="cal-daynum">' + day + '</div>' +
      (items.length ? '<div class="cal-dot ' + dotCls + '">' + items.length + '</div>' : '') +
    '</div>';
  }
  html += '</div><div id="calDayList" class="cal-day-list"></div>';
  return html;
}

function renderAppointments() {
  const panel = document.getElementById('panel-appt');
  if (!panel) return;

  const list = computeApptStatusList();

  const overdueCount = list.filter(function(p){ return p.apptStatus === 'overdue'; }).length;
  const soonCount = list.filter(function(p){ return p.apptStatus === 'soon'; }).length;
  const todayCount = list.filter(function(p){ return p.apptStatus === 'today'; }).length;
  const cameCount = list.filter(function(p){ return p.apptStatus === 'came'; }).length;

  let html = '<div class="appt-summary">' +
    '<div class="appt-stat appt-stat-warn"><div class="appt-stat-top"><span>ใกล้ถึงนัด (7 วัน)</span><i class="ti ti-clock"></i></div><span class="appt-stat-num">' + soonCount + '</span></div>' +
    '<div class="appt-stat appt-stat-today"><div class="appt-stat-top"><span>ถึงกำหนดวันนี้</span><i class="ti ti-calendar-event"></i></div><span class="appt-stat-num">' + todayCount + '</span></div>' +
    '<div class="appt-stat appt-stat-came"><div class="appt-stat-top"><span>มาตามนัดแล้ว (วันนี้)</span><i class="ti ti-circle-check"></i></div><span class="appt-stat-num">' + cameCount + '</span></div>' +
    '<div class="appt-stat appt-stat-danger"><div class="appt-stat-top"><span>ไม่มาตามนัด</span><i class="ti ti-alert-triangle"></i></div><span class="appt-stat-num">' + overdueCount + '</span></div>' +
  '</div>';

  html += '<div class="appt-view-toggle">' +
    '<button id="apptListBtn" class="' + (apptViewMode === 'list' ? 'active' : '') + '" type="button">รายชื่อ</button>' +
    '<button id="apptCalBtn" class="' + (apptViewMode === 'calendar' ? 'active' : '') + '" type="button">ปฏิทิน</button>' +
  '</div>';

  if (apptViewMode === 'calendar') {
    html += renderApptCalendar(list);
  } else if (list.length === 0) {
    html += '<div class="placeholder"><i class="ti ti-calendar-off"></i><h2>ไม่มีข้อมูลนัดรับยา</h2></div>';
  } else {
    html += '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th>สถานะ</th><th>ลำดับ TB</th><th>ชื่อ-สกุล</th><th>HN</th><th>โรคประจำตัว</th><th>วันที่นัดถัดไป</th><th>รับยาที่เท่าไหร่</th><th>มารับยาล่าสุด</th>' +
    '</tr></thead><tbody>';
    list.forEach(function(p){
      const comorbidHtml = (p.comorbidList || []).map(function(c){
        const cls = /DM/.test(c) ? 'comorbid-dm' : 'comorbid-other';
        return '<span class="comorbid-pill ' + cls + '"><i class="ti ti-heart"></i>' + escapeHtml(c) + '</span>';
      }).join(' ');
      let badge = '<span class="appt-badge appt-ok"><i class="ti ti-calendar-check"></i>ปกติ</span>';
      if (p.apptStatus === 'came') badge = '<span class="appt-badge appt-came"><i class="ti ti-circle-check"></i>มาตามนัดแล้ว</span>';
      else if (p.apptStatus === 'today') badge = '<span class="appt-badge appt-today"><i class="ti ti-calendar-event"></i>ถึงกำหนดวันนี้</span>';
      else if (p.apptStatus === 'overdue') badge = '<span class="appt-badge appt-danger"><i class="ti ti-alert-triangle"></i>ไม่มาตามนัด</span>';
      else if (p.apptStatus === 'soon') badge = '<span class="appt-badge appt-warn"><i class="ti ti-clock"></i>ใกล้ถึงนัด</span>';
      html += '<tr class="table-row" data-tbid="' + escapeHtml(p.tbId) + '">' +
        '<td>' + badge + '</td>' +
        '<td>' + escapeHtml(p.tbId) + '</td>' +
        '<td>' + escapeHtml(p.name || '') + '</td>' +
        '<td>' + escapeHtml(p.hn || '') + '</td>' +
        '<td>' + (comorbidHtml || '-') + '</td>' +
        '<td>' + escapeHtml(p.nextApptDateDisplay || '-') + '</td>' +
        '<td>' + escapeHtml(p.nextMedAt || '-') + '</td>' +
        '<td>' + escapeHtml(p.lastVisitDateDisplay || '-') + '</td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
  }

  panel.innerHTML = html;

  panel.querySelectorAll('.table-row[data-tbid]').forEach(function(row){
    row.addEventListener('click', function(){ openDetailModal(row.getAttribute('data-tbid')); });
  });
  document.getElementById('apptListBtn').addEventListener('click', function(){ apptViewMode = 'list'; renderAppointments(); });
  document.getElementById('apptCalBtn').addEventListener('click', function(){ apptViewMode = 'calendar'; renderAppointments(); });

  if (apptViewMode === 'calendar') {
    document.getElementById('calPrev').addEventListener('click', function(){
      apptCalendarDate.setMonth(apptCalendarDate.getMonth() - 1); renderAppointments();
    });
    document.getElementById('calNext').addEventListener('click', function(){
      apptCalendarDate.setMonth(apptCalendarDate.getMonth() + 1); renderAppointments();
    });
    panel.querySelectorAll('.cal-cell.has-items').forEach(function(cell){
      cell.addEventListener('click', function(){
        const day = parseInt(cell.getAttribute('data-day'), 10);
        const y = apptCalendarDate.getFullYear(), m = apptCalendarDate.getMonth();
        const items = list.filter(function(p){
          const d = new Date(p.nextApptDateTs);
          return d.getFullYear() === y && d.getMonth() === m && d.getDate() === day;
        });
        const listEl = document.getElementById('calDayList');
        listEl.innerHTML = '<div class="cal-day-list-title">วันที่ ' + day + ' — ' + items.length + ' ราย</div>' +
          items.map(function(p){
            const cls = p.apptStatus === 'overdue' ? 'appt-danger' : (p.apptStatus === 'soon' ? 'appt-warn' : 'appt-ok');
            return '<div class="cal-day-item" data-tbid="' + escapeHtml(p.tbId) + '">' +
              '<span>' + escapeHtml(p.name || p.tbId) + '</span>' +
              '<span class="appt-badge ' + cls + '">' + escapeHtml(p.nextMedAt || '') + '</span>' +
            '</div>';
          }).join('');
        listEl.querySelectorAll('.cal-day-item').forEach(function(it){
          it.addEventListener('click', function(){ openDetailModal(it.getAttribute('data-tbid')); });
        });
      });
    });
  }
}

/* ---------------- แผนที่ผู้ป่วย ---------------- */

let leafletMap = null;
let mapMarkersLayer = null;
let mapNormalLayer = null;
let mapSatelliteLayer = null;

function statusColorForMap(p) {
  if (!p.isDischarged) return '#F2C572';
  const text = p.dischargeBy || '';
  if (/หาย|ครบ/.test(text)) return '#2E7D4F';
  if (/ตาย/.test(text)) return '#B3261E';
  if (/โอนออก/.test(text)) return '#2F80A6';
  if (/ขาดยา/.test(text)) return '#E07A2A';
  return '#6B7A76';
}

function statusLabelForMap(p) {
  return p.isDischarged ? (p.dischargeBy || 'จำหน่าย') : 'กำลังรักษา';
}

function initMapIfNeeded() {
  if (leafletMap) return;
  leafletMap = L.map('mapContainer').setView([6.15, 101.72], 12);

  mapNormalLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
  }).addTo(leafletMap);

  mapSatelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Esri' }
  );

  // ไฮไลต์พื้นที่ อ.ศรีสาคร โดยประมาณ (วงกลมจากจุดศูนย์กลางอำเภอ + พื้นที่จริง ~500 ตร.กม.)
  L.circle([6.2314, 101.5], {
    radius: 12600,
    color: '#0F6B5C',
    weight: 2,
    dashArray: '6, 6',
    fillColor: '#0F6B5C',
    fillOpacity: 0.08,
  }).addTo(leafletMap).bindTooltip('พื้นที่ อ.ศรีสาคร (โดยประมาณ)', { sticky: true });

  mapMarkersLayer = L.layerGroup().addTo(leafletMap);

  document.getElementById('mapNormalBtn').addEventListener('click', function(){ setMapLayer('normal'); });
  document.getElementById('mapSatBtn').addEventListener('click', function(){ setMapLayer('satellite'); });
}

function setMapLayer(type) {
  document.getElementById('mapNormalBtn').classList.toggle('active', type === 'normal');
  document.getElementById('mapSatBtn').classList.toggle('active', type === 'satellite');
  if (type === 'satellite') {
    if (leafletMap.hasLayer(mapNormalLayer)) leafletMap.removeLayer(mapNormalLayer);
    mapSatelliteLayer.addTo(leafletMap);
  } else {
    if (leafletMap.hasLayer(mapSatelliteLayer)) leafletMap.removeLayer(mapSatelliteLayer);
    mapNormalLayer.addTo(leafletMap);
  }
}

function mapGoTo(lat, lng) {
  window.open('https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng, '_blank');
}

function mapViewDetail(tbId) {
  openDetailModal(tbId);
}

function renderMapMarkers(query) {
  if (!mapMarkersLayer) return;
  mapMarkersLayer.clearLayers();
  const q = (query || '').toLowerCase();

  const withCoords = allPatients.filter(function(p){ return p.houseMap; });
  let plotted = 0;
  const plottedLatLngs = [];

  withCoords.forEach(function(p){
    if (q && !((p.name || '').toLowerCase().indexOf(q) !== -1 ||
               (p.hn || '').toLowerCase().indexOf(q) !== -1 ||
               (p.tbId || '').toLowerCase().indexOf(q) !== -1)) return;

    const parts = String(p.houseMap).split(',').map(function(s){ return parseFloat(s.trim()); });
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return;

    const color = statusColorForMap(p);
    const marker = L.circleMarker([parts[0], parts[1]], {
      radius: 9, fillColor: color, color: '#fff', weight: 2, fillOpacity: 0.95,
    });

    const popupHtml =
      '<b>' + escapeHtml(p.name || 'ไม่มีชื่อ') + '</b><br>' +
      escapeHtml(p.tbId) + (p.hn ? ' &middot; HN ' + escapeHtml(p.hn) : '') + '<br>' +
      '<span style="color:' + color + ';font-weight:600;">' + escapeHtml(statusLabelForMap(p)) + '</span>' +
      '<div class="map-popup-actions">' +
        '<button onclick="mapGoTo(' + parts[0] + ',' + parts[1] + ')"><i class="ti ti-navigation"></i> นำทาง</button>' +
        '<button onclick="mapViewDetail(\'' + p.tbId.replace(/'/g, "\\'") + '\')"><i class="ti ti-eye"></i> ดูข้อมูล</button>' +
      '</div>';

    marker.bindPopup(popupHtml);
    marker.addTo(mapMarkersLayer);
    plotted++;
    plottedLatLngs.push([parts[0], parts[1]]);
  });

  if (plottedLatLngs.length > 0) {
    leafletMap.fitBounds(plottedLatLngs, { padding: [30, 30], maxZoom: 15 });
  }

  const noteEl = document.getElementById('mapNote');
  if (noteEl) {
    noteEl.textContent = 'แสดง ' + plotted + ' ราย จากทั้งหมด ' + withCoords.length + ' รายที่มีพิกัด (ผู้ป่วยที่ยังไม่มีพิกัดจะไม่ถูกปักหมุด)';
  }
}

/* ---------------- บันทึกการรับบริการวันนี้ ---------------- */

function initVisitTab() {
  const input = document.getElementById('visitSearchInput');
  if (input && !input.dataset.bound) {
    input.dataset.bound = '1';
    input.addEventListener('input', function(){ renderVisitSearchResults(input.value.trim()); });
    setupClearableSearch('visitSearchInput', 'visitSearchInputClear', function(){ renderVisitSearchResults(''); });
  }
  renderRecentActivityFeed();
}

function renderVisitSearchResults(query) {
  const box = document.getElementById('visitResults');
  if (!query) { box.innerHTML = ''; return; }
  const q = query.toLowerCase();
  const matches = allPatients.filter(function(p){
    return (p.name || '').toLowerCase().indexOf(q) !== -1 ||
           (p.hn || '').toLowerCase().indexOf(q) !== -1 ||
           (p.tbId || '').toLowerCase().indexOf(q) !== -1;
  }).slice(0, 8);
  if (matches.length === 0) {
    box.innerHTML = '<div class="placeholder"><i class="ti ti-user-search"></i><h2>ไม่พบผู้ป่วย</h2><p>ลองพิมพ์ชื่อ, HN หรือเลข TB ใหม่</p></div>';
    return;
  }
  box.innerHTML = matches.map(function(p){
    return '<div class="visit-result-item" data-tbid="' + escapeHtml(p.tbId) + '">' +
      '<div class="avatar">' + escapeHtml(initials(p.name)) + '</div>' +
      '<div><div class="demo-id">' + escapeHtml(p.tbId) + '</div><div class="demo-name">' + escapeHtml(p.name || '') + '</div></div>' +
    '</div>';
  }).join('');
  box.querySelectorAll('.visit-result-item').forEach(function(el){
    el.addEventListener('click', function(){ selectVisitPatient(el.getAttribute('data-tbid')); });
  });
}

function selectVisitPatient(tbId) {
  document.getElementById('visitResults').innerHTML = '';
  document.getElementById('visitSearchInput').value = '';
  const p = allPatients.find(function(x){ return x.tbId === tbId; });
  const area = document.getElementById('visitPatientArea');
  area.innerHTML = skeletonPatientDetailArea();

  google.script.run.withSuccessHandler(function(history){
    renderVisitPatientArea(p, history || []);
  }).withFailureHandler(function(){
    renderVisitPatientArea(p, []);
  }).getRelatedRecords('บันทึกการรับบริการ', tbId);
}

function renderVisitPatientArea(p, history) {
  const area = document.getElementById('visitPatientArea');
  if (!p) { area.innerHTML = '<div class="placeholder"><h2>ไม่พบข้อมูลผู้ป่วย</h2></div>'; return; }

  const avatarHtml = p.photoUrl
    ? '<img class="avatar-img" src="' + escapeHtml(p.photoUrl) + '" alt="">'
    : '<div class="avatar">' + escapeHtml(initials(p.name)) + '</div>';

  let html = '<button class="btn-back" id="visitChangeBtn" type="button"><i class="ti ti-arrow-left"></i>กลับไปค้นหา</button>' +
    '<div class="visit-patient-card">' +
    avatarHtml +
    '<div><div class="demo-id">' + escapeHtml(p.tbId) + (p.hn ? ' &middot; HN ' + escapeHtml(p.hn) : '') + '</div>' +
    '<div class="demo-name">' + escapeHtml(p.name || '') + '</div>' +
    '<div class="row-sub">' + escapeHtml([p.gender, p.age ? p.age + ' ปี' : ''].filter(Boolean).join(' / ')) + '</div></div>' +
  '</div>';

  html += '<div class="section-label">บันทึกการมารับบริการวันนี้</div>';
  html += '<div class="field-group"><label>วันที่มารับบริการ</label><input type="date" id="visitDate" value="' + new Date().toISOString().slice(0,10) + '"></div>';
  html += '<div class="field-group"><label>อาการสำคัญ</label><textarea id="visitComplaint" rows="2"></textarea></div>';
  html += '<div class="field-row">' +
    '<div class="field-group"><label>ยาที่ให้วันนี้</label><textarea id="visitMeds" rows="2"></textarea></div>' +
    '<div class="field-group"><label>สูตรยา TB</label><select id="visitRegimen"><option value="">เลือก...</option>' +
      OPT.regimen.map(function(r){ return '<option value="' + escapeHtml(r) + '">' + escapeHtml(r) + '</option>'; }).join('') +
    '</select></div>' +
  '</div>';
  html += '<div class="field-row">' +
    '<div class="field-group"><label>วันนัดครั้งต่อไป</label><input type="date" id="visitNextAppt"></div>' +
    '<div class="field-group"><label>รับยาที่เท่าไหร่</label><select id="visitNextMedAt"><option value="">เลือก...</option>' +
      OPT.medSchedule.map(function(m){ return '<option value="' + escapeHtml(m) + '">' + escapeHtml(m) + '</option>'; }).join('') +
    '</select></div>' +
  '</div>';
  html += '<div class="field-group"><label>หมายเหตุ</label><textarea id="visitNote" rows="2"></textarea></div>';
  html += '<div class="visit-save-row"><span class="modal-error" id="visitError"></span><button class="btn-primary" id="visitSaveBtn" type="button"><i class="ti ti-device-floppy"></i>บันทึกวันนี้</button></div>';

  html += '<div class="section-label">ประวัติการมารับบริการ (' + history.length + ' ครั้ง)</div>';
  if (history.length === 0) {
    html += '<div class="placeholder"><h2>ยังไม่มีประวัติการมารับบริการ</h2></div>';
  } else {
    const sorted = history.slice().sort(function(a, b){
      return new Date(b['วันที่มารับบริการ']) - new Date(a['วันที่มารับบริการ']);
    });
    html += '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th>วันที่</th><th>อาการสำคัญ</th><th>ยาที่ให้วันนี้</th><th>สูตรยา TB</th><th>นัดครั้งต่อไป</th><th>รับยาที่เท่าไหร่</th><th>หมายเหตุ</th>' +
    '</tr></thead><tbody>';
    sorted.forEach(function(h){
      html += '<tr>' +
        '<td>' + escapeHtml(h['วันที่มารับบริการ']) + '</td>' +
        '<td>' + escapeHtml(h['อาการสำคัญ']) + '</td>' +
        '<td>' + escapeHtml(h['ยาที่ให้']) + '</td>' +
        '<td>' + escapeHtml(h['สูตรยา TB']) + '</td>' +
        '<td>' + escapeHtml(h['วันนัดครั้งต่อไป']) + '</td>' +
        '<td>' + escapeHtml(h['รับยาที่เท่าไหร่']) + '</td>' +
        '<td>' + escapeHtml(h['หมายเหตุ']) + '</td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
  }

  area.innerHTML = html;

  document.getElementById('visitChangeBtn').addEventListener('click', function(){
    renderRecentActivityFeed();
  });

  document.getElementById('visitSaveBtn').addEventListener('click', function(){
    const btn = document.getElementById('visitSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader-2"></i>กำลังบันทึก...';
    const payload = {
      tbId: p.tbId,
      visitDate: document.getElementById('visitDate').value,
      complaint: document.getElementById('visitComplaint').value,
      medsGiven: document.getElementById('visitMeds').value,
      regimen: document.getElementById('visitRegimen').value,
      nextApptDate: document.getElementById('visitNextAppt').value,
      nextMedAt: document.getElementById('visitNextMedAt').value,
      note: document.getElementById('visitNote').value,
      username: currentUsername(),
    };
    google.script.run.withSuccessHandler(function(res){
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-device-floppy"></i>บันทึกวันนี้';
      if (!res || !res.ok) {
        document.getElementById('visitError').textContent = (res && res.error) || 'บันทึกไม่สำเร็จ';
        return;
      }
      document.getElementById('visitError').textContent = '';
    showToast('บันทึกการรับบริการสำเร็จ', 'success');
      google.script.run.withSuccessHandler(function(result){
        onDataLoaded(result);
        selectVisitPatient(p.tbId);
      }).withFailureHandler(onLoadError).getPatientData();
    }).withFailureHandler(function(err){
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-device-floppy"></i>บันทึกวันนี้';
      document.getElementById('visitError').textContent = (err && err.message) || String(err);
    }).addVisitRecord(payload);
  });
}

/* ---------------- บันทึกการเยี่ยมบ้าน ---------------- */

function initHomeVisitTab() {
  const input = document.getElementById('hvSearchInput');
  if (!input || input.dataset.bound) return;
  input.dataset.bound = '1';
  input.addEventListener('input', function(){ renderHvSearchResults(input.value.trim()); });
  setupClearableSearch('hvSearchInput', 'hvSearchInputClear', function(){ renderHvSearchResults(''); });
}

function renderHvSearchResults(query) {
  const box = document.getElementById('hvResults');
  if (!query) { box.innerHTML = ''; return; }
  const q = query.toLowerCase();
  const matches = allPatients.filter(function(p){
    return (p.name || '').toLowerCase().indexOf(q) !== -1 ||
           (p.hn || '').toLowerCase().indexOf(q) !== -1 ||
           (p.tbId || '').toLowerCase().indexOf(q) !== -1;
  }).slice(0, 8);
  if (matches.length === 0) {
    box.innerHTML = '<div class="placeholder"><i class="ti ti-user-search"></i><h2>ไม่พบผู้ป่วย</h2><p>ลองพิมพ์ชื่อ, HN หรือเลข TB ใหม่</p></div>';
    return;
  }
  box.innerHTML = matches.map(function(p){
    return '<div class="visit-result-item" data-tbid="' + escapeHtml(p.tbId) + '">' +
      '<div class="avatar">' + escapeHtml(initials(p.name)) + '</div>' +
      '<div><div class="demo-id">' + escapeHtml(p.tbId) + '</div><div class="demo-name">' + escapeHtml(p.name || '') + '</div></div>' +
    '</div>';
  }).join('');
  box.querySelectorAll('.visit-result-item').forEach(function(el){
    el.addEventListener('click', function(){ selectHvPatient(el.getAttribute('data-tbid')); });
  });
}

function focusSearchAgain(searchInputId, areaId) {
  const area = document.getElementById(areaId);
  area.innerHTML = '<div class="placeholder"><i class="ti ti-search"></i><h2>ค้นหาผู้ป่วยเพื่อเริ่ม</h2><p>พิมพ์ชื่อ, HN หรือเลข TB ด้านบน</p></div>';
  const input = document.getElementById(searchInputId);
  if (input) { input.value = ''; input.focus(); }
}

let hvPhotoData = '';
let hvHousePhotoData = '';

function selectHvPatient(tbId) {
  document.getElementById('hvResults').innerHTML = '';
  document.getElementById('hvSearchInput').value = '';
  hvPhotoData = '';
  const p = allPatients.find(function(x){ return x.tbId === tbId; });
  const area = document.getElementById('hvPatientArea');
  area.innerHTML = skeletonPatientDetailArea();

  google.script.run.withSuccessHandler(function(history){
    renderHvPatientArea(p, history || []);
  }).withFailureHandler(function(){
    renderHvPatientArea(p, []);
  }).getRelatedRecords('บันทึกการเยี่ยมบ้าน', tbId);
}

function renderHvPatientArea(p, history) {
  const area = document.getElementById('hvPatientArea');
  if (!p) { area.innerHTML = '<div class="placeholder"><h2>ไม่พบข้อมูลผู้ป่วย</h2></div>'; return; }

  const avatarHtml = p.photoUrl
    ? '<img class="avatar-img" src="' + escapeHtml(p.photoUrl) + '" alt="">'
    : '<div class="avatar">' + escapeHtml(initials(p.name)) + '</div>';

  let html = '<button class="btn-back" id="hvChangeBtn" type="button"><i class="ti ti-arrow-left"></i>กลับไปค้นหา</button>' +
    '<div class="visit-patient-card">' +
    avatarHtml +
    '<div><div class="demo-id">' + escapeHtml(p.tbId) + (p.hn ? ' &middot; HN ' + escapeHtml(p.hn) : '') + '</div>' +
    '<div class="demo-name">' + escapeHtml(p.name || '') + '</div>' +
    '<div class="row-sub">' + escapeHtml([p.tambon, p.zone].filter(Boolean).join(' · ')) + '</div></div>' +
  '</div>';

  html += '<div class="section-label">บันทึกการเยี่ยมบ้านวันนี้</div>';
  html += '<div class="field-row">' +
    '<div class="field-group"><label>วันที่เยี่ยมบ้าน</label><input type="date" id="hvDate" value="' + new Date().toISOString().slice(0,10) + '"></div>' +
    '<div class="field-group"><label>ผู้เยี่ยมบ้าน (อสม./จนท.)</label><input type="text" id="hvVisitor"></div>' +
  '</div>';
  html += '<div class="field-group"><label>พบผู้ป่วยไหม</label><select id="hvMetPatient">' +
    '<option value="">เลือก...</option><option value="พบผู้ป่วย">พบผู้ป่วย</option><option value="ไม่พบผู้ป่วย">ไม่พบผู้ป่วย</option>' +
  '</select></div>';
  html += '<div class="field-group"><label>รายละเอียดการเยี่ยม</label><textarea id="hvDetail" rows="3" placeholder="สภาพบ้าน, การกินยา, ปัญหาที่พบ..."></textarea></div>';
  html += '<div class="field-group"><label>นัดเยี่ยมครั้งต่อไป</label><input type="date" id="hvNextVisit"></div>';

  const hasMap = !!p.houseMap;
  html += '<div class="field-group"><label>พิกัดบ้าน</label>' +
    '<div class="hv-geo-row">' +
      '<span class="hv-geo-status ' + (hasMap ? 'hv-geo-pinned' : 'hv-geo-unpinned') + '" id="hvGeoStatus">' +
        '<i class="ti ' + (hasMap ? 'ti-map-pin-check' : 'ti-map-pin-off') + '"></i>' +
        (hasMap ? 'ปักหมุดแล้ว (' + escapeHtml(p.houseMap) + ')' : 'ยังไม่มีพิกัด') +
      '</span>' +
      '<button class="btn-ghost" id="hvGeoBtn" type="button">' + (hasMap ? 'แก้โลเคชั่น' : 'ปักหมุด') + '</button>' +
    '</div>' +
    '<input type="hidden" id="hvHouseMap" value="' + escapeHtml(p.houseMap || '') + '">' +
  '</div>';

  html += '<div class="field-group"><label>รูปหน้าบ้าน</label><div class="photo-input"><div class="ph-placeholder" id="hvHousePhotoPreview"><i class="ti ti-camera"></i></div>' +
    '<label for="hvHousePhotoInput">เลือกรูปภาพ</label><input type="file" accept="image/*" id="hvHousePhotoInput" style="display:none;"></div></div>';
  html += '<div class="field-group"><label>รูปเยี่ยมบ้าน</label><div class="photo-input"><div class="ph-placeholder" id="hvPhotoPreview"><i class="ti ti-camera"></i></div>' +
    '<label for="hvPhotoInput">เลือกรูปภาพ</label><input type="file" accept="image/*" id="hvPhotoInput" style="display:none;"></div></div>';
  html += '<div class="visit-save-row"><span class="modal-error" id="hvError"></span><button class="btn-primary" id="hvSaveBtn" type="button"><i class="ti ti-device-floppy"></i>บันทึกวันนี้</button></div>';

  html += '<div class="section-label">ประวัติการเยี่ยมบ้าน (' + history.length + ' ครั้ง)</div>';
  if (history.length === 0) {
    html += '<div class="placeholder"><h2>ยังไม่มีประวัติการเยี่ยมบ้าน</h2></div>';
  } else {
    const sorted = history.slice().sort(function(a, b){
      return new Date(b['วันที่เยี่ยมบ้าน']) - new Date(a['วันที่เยี่ยมบ้าน']);
    });
    html += '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th>วันที่</th><th>ผู้เยี่ยมบ้าน</th><th>พบผู้ป่วยไหม</th><th>รายละเอียด</th><th>นัดครั้งต่อไป</th><th>รูปหน้าบ้าน</th><th>รูปเยี่ยมบ้าน</th>' +
    '</tr></thead><tbody>';
    sorted.forEach(function(h){
      const housePhotoCell = h['รูปหน้าบ้าน_url']
        ? '<img src="' + escapeHtml(h['รูปหน้าบ้าน_url']) + '" alt="" class="photo-thumb" onclick="openPhotoLightbox(this.src)">'
        : '-';
      const visitPhotoCell = h['รูปเยี่ยมบ้าน_url']
        ? '<img src="' + escapeHtml(h['รูปเยี่ยมบ้าน_url']) + '" alt="" class="photo-thumb" onclick="openPhotoLightbox(this.src)">'
        : '-';
      html += '<tr>' +
        '<td>' + escapeHtml(h['วันที่เยี่ยมบ้าน']) + '</td>' +
        '<td>' + escapeHtml(h['ผู้เยี่ยมบ้าน']) + '</td>' +
        '<td>' + escapeHtml(h['พบผู้ป่วยไหม']) + '</td>' +
        '<td>' + escapeHtml(h['รายละเอียดการเยี่ยม']) + '</td>' +
        '<td>' + escapeHtml(h['นัดเยี่ยมครั้งต่อไป']) + '</td>' +
        '<td>' + housePhotoCell + '</td>' +
        '<td>' + visitPhotoCell + '</td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
  }

  area.innerHTML = html;

  document.getElementById('hvChangeBtn').addEventListener('click', function(){ focusSearchAgain('hvSearchInput', 'hvPatientArea'); });

  document.getElementById('hvPhotoInput').addEventListener('change', function(e){
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev){
      hvPhotoData = ev.target.result;
      const ph = document.getElementById('hvPhotoPreview');
      ph.innerHTML = '<img src="' + ev.target.result + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('hvHousePhotoInput').addEventListener('change', function(e){
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev){
      hvHousePhotoData = ev.target.result;
      const ph = document.getElementById('hvHousePhotoPreview');
      ph.innerHTML = '<img src="' + ev.target.result + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('hvGeoBtn').addEventListener('click', function(){
    const btn = document.getElementById('hvGeoBtn');
    if (!navigator.geolocation) return;
    btn.disabled = true;
    btn.textContent = 'กำลังค้นหาตำแหน่ง...';
    navigator.geolocation.getCurrentPosition(function(pos){
      const coords = pos.coords.latitude.toFixed(6) + ', ' + pos.coords.longitude.toFixed(6);
      document.getElementById('hvHouseMap').value = coords;
      const statusEl = document.getElementById('hvGeoStatus');
      statusEl.className = 'hv-geo-status hv-geo-pinned';
      statusEl.innerHTML = '<i class="ti ti-map-pin-check"></i>ปักหมุดแล้ว (' + coords + ')';
      btn.disabled = false;
      btn.textContent = 'แก้โลเคชั่น';
    }, function(){
      btn.disabled = false;
      btn.textContent = p.houseMap ? 'แก้โลเคชั่น' : 'ปักหมุด';
    });
  });

  document.getElementById('hvSaveBtn').addEventListener('click', function(){
    const btn = document.getElementById('hvSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader-2"></i>กำลังบันทึก...';
    const payload = {
      tbId: p.tbId,
      visitDate: document.getElementById('hvDate').value,
      visitor: document.getElementById('hvVisitor').value,
      metPatient: document.getElementById('hvMetPatient').value,
      detail: document.getElementById('hvDetail').value,
      nextVisitDate: document.getElementById('hvNextVisit').value,
      photo: hvPhotoData,
      housePhoto: hvHousePhotoData,
      houseMap: document.getElementById('hvHouseMap').value,
      username: currentUsername(),
    };
    google.script.run.withSuccessHandler(function(res){
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-device-floppy"></i>บันทึกวันนี้';
      if (!res || !res.ok) {
        document.getElementById('hvError').textContent = (res && res.error) || 'บันทึกไม่สำเร็จ';
        return;
      }
      document.getElementById('hvError').textContent = '';
      showToast('บันทึกการเยี่ยมบ้านสำเร็จ', 'success');
      google.script.run.withSuccessHandler(function(result){
        onDataLoaded(result);
        selectHvPatient(p.tbId);
      }).withFailureHandler(onLoadError).getPatientData();
    }).withFailureHandler(function(err){
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-device-floppy"></i>บันทึกวันนี้';
      document.getElementById('hvError').textContent = (err && err.message) || String(err);
    }).addHomeVisitRecord(payload);
  });
}

/* ---------------- Contact TB (บันทึกผู้สัมผัสร่วมบ้าน) ---------------- */

let ctSelectedTbId = null;
let ctContactHeaders = null;
let ctFormMode = 'add';
let ctFormExisting = null;

function initContactTab() {
  const input = document.getElementById('ctSearchInput');
  if (!input || input.dataset.bound) return;
  input.dataset.bound = '1';
  input.addEventListener('input', function(){ renderCtSearchResults(input.value.trim()); });
  setupClearableSearch('ctSearchInput', 'ctSearchInputClear', function(){ renderCtSearchResults(''); });
}

function renderCtSearchResults(query) {
  const box = document.getElementById('ctResults');
  if (!query) { box.innerHTML = ''; return; }
  const q = query.toLowerCase();
  const matches = allPatients.filter(function(p){
    return (p.name || '').toLowerCase().indexOf(q) !== -1 ||
           (p.hn || '').toLowerCase().indexOf(q) !== -1 ||
           (p.tbId || '').toLowerCase().indexOf(q) !== -1;
  }).slice(0, 8);
  if (matches.length === 0) {
    box.innerHTML = '<div class="placeholder"><i class="ti ti-user-search"></i><h2>ไม่พบผู้ป่วย</h2><p>ลองพิมพ์ชื่อ, HN หรือเลข TB ใหม่</p></div>';
    return;
  }
  box.innerHTML = matches.map(function(p){
    return '<div class="visit-result-item" data-tbid="' + escapeHtml(p.tbId) + '">' +
      '<div class="avatar">' + escapeHtml(initials(p.name)) + '</div>' +
      '<div><div class="demo-id">' + escapeHtml(p.tbId) + '</div><div class="demo-name">' + escapeHtml(p.name || '') + '</div></div>' +
    '</div>';
  }).join('');
  box.querySelectorAll('.visit-result-item').forEach(function(el){
    el.addEventListener('click', function(){ selectCtPatient(el.getAttribute('data-tbid')); });
  });
}

function selectCtPatient(tbId) {
  ctSelectedTbId = tbId;
  document.getElementById('ctResults').innerHTML = '';
  document.getElementById('ctSearchInput').value = '';
  const p = allPatients.find(function(x){ return x.tbId === tbId; });
  const area = document.getElementById('ctPatientArea');
  area.innerHTML = skeletonPatientDetailArea();

  google.script.run.withSuccessHandler(function(contacts){
    renderCtPatientArea(p, contacts || []);
  }).withFailureHandler(function(err){
    area.innerHTML = '<div class="placeholder"><i class="ti ti-alert-triangle"></i><h2>' + escapeHtml((err && err.message) || String(err)) + '</h2></div>';
  }).getRelatedRecords('ผู้สัมผัสร่วมบ้าน', tbId);
}

function renderCtPatientArea(p, contacts) {
  const area = document.getElementById('ctPatientArea');
  if (!p) { area.innerHTML = '<div class="placeholder"><h2>ไม่พบข้อมูลผู้ป่วย</h2></div>'; return; }
  const avatarHtml = p.photoUrl
    ? '<img class="avatar-img" src="' + escapeHtml(p.photoUrl) + '" alt="">'
    : '<div class="avatar">' + escapeHtml(initials(p.name)) + '</div>';

  let html = '<button class="btn-back" id="ctChangeBtn" type="button"><i class="ti ti-arrow-left"></i>กลับไปค้นหา</button>' +
    '<div class="visit-patient-card">' +
    avatarHtml +
    '<div><div class="demo-id">' + escapeHtml(p.tbId) + (p.hn ? ' &middot; HN ' + escapeHtml(p.hn) : '') + '</div>' +
    '<div class="demo-name">' + escapeHtml(p.name || '') + '</div></div>' +
  '</div>';

  html += '<div class="section-label">ผู้สัมผัสร่วมบ้าน (' + contacts.length + ' คน)</div>';
  html += '<div class="visit-results" id="ctContactList">';
  if (contacts.length === 0) {
    html += '<div class="visit-empty">ยังไม่มีข้อมูลผู้สัมผัสร่วมบ้านของผู้ป่วยรายนี้</div>';
  } else {
    contacts.forEach(function(c){
      html += '<div class="visit-result-item ct-contact-item" data-cid="' + escapeHtml(c['Contact ID'] || '') + '">' +
        '<div class="avatar">' + escapeHtml(initials(c['ชื่อผู้สัมผัส'])) + '</div>' +
        '<div><div class="demo-id">' + escapeHtml(c['Contact ID'] || '') + (c['ความสัมพันธ์'] ? ' &middot; ' + escapeHtml(c['ความสัมพันธ์']) : '') + '</div>' +
        '<div class="demo-name">' + escapeHtml(c['ชื่อผู้สัมผัส'] || 'ไม่มีชื่อ') + '</div></div>' +
      '</div>';
    });
  }
  html += '</div>';
  html += '<button class="btn-primary" id="ctAddBtn" type="button" style="margin-top:12px;"><i class="ti ti-plus"></i>เพิ่มผู้สัมผัสใหม่</button>';
  html += '<div id="ctContactDetail"></div>';

  area.innerHTML = html;

  document.getElementById('ctChangeBtn').addEventListener('click', function(){ focusSearchAgain('ctSearchInput', 'ctPatientArea'); });
  document.getElementById('ctAddBtn').addEventListener('click', function(){ openContactForm('add', null); });
  area.querySelectorAll('.ct-contact-item').forEach(function(item){
    item.addEventListener('click', function(){
      const cid = item.getAttribute('data-cid');
      const c = contacts.find(function(x){ return x['Contact ID'] === cid; });
      selectContact(c);
    });
  });
}

function openContactForm(mode, existing) {
  ctFormMode = mode;
  ctFormExisting = existing;
  google.script.run.withSuccessHandler(function(res){
    if (!res || !res.ok) { document.getElementById('contactModalError').textContent = (res && res.error) || 'โหลดฟอร์มไม่สำเร็จ'; return; }
    ctContactHeaders = res.headers.filter(function(h){ return h !== 'Contact ID' && h !== 'TB'; });
    ensureFormOptionsThen(function(){ renderContactFormModal(); });
  }).withFailureHandler(function(err){
    document.getElementById('contactModalError').textContent = (err && err.message) || String(err);
  }).getSheetHeaders('ผู้สัมผัสร่วมบ้าน');
}

const CT_DROPDOWN_MAP = {
  'เพศ': 'ctGender',
  'ความสัมพันธ์': 'ctRelation',
  'ตรวจคัดกรองTB': 'ctScreenStatus',
  'ผลคัดกรอง': 'ctScreenResult',
  'ได้X-rayCXR': 'ctXrayStatus',
  'ผลX-ray': 'ctXrayResult',
  'เป็นเด็กต่ำกว่า5': 'ctUnder5',
  'ได้รับTPT/IPT': 'ctTpt',
  'คัดกรองLTBI': 'ctLtbiScreen',
  'ตรวจLTBI': 'ctLtbiTest',
  'ผลLTBI': 'ctLtbiResult',
};

function renderContactFormModal() {
  const body = document.getElementById('contactModalBody');
  body.innerHTML = '';
  document.getElementById('contactModalTitle').textContent = ctFormMode === 'edit' ? 'แก้ไขข้อมูลผู้สัมผัส' : 'เพิ่มผู้สัมผัสใหม่';
  document.getElementById('contactModalError').textContent = '';

  ctContactHeaders.forEach(function(h){
    const normKey = h.replace(/\s+/g, '');
    const optionsKey = CT_DROPDOWN_MAP[normKey];
    const fieldId = 'ctf_' + h.replace(/[^a-zA-Zก-๙0-9]/g, '_');

    if (optionsKey) {
      const existingVal = ctFormExisting && ctFormExisting[h] !== undefined ? ctFormExisting[h] : '';
      const wrap = el('div', { class: 'field-group' });
      wrap.appendChild(el('label', { text: h }));
      const selectAddHtml = selectWithAddHtml(fieldId, formOptionsCache[optionsKey] || [], optionsKey, existingVal);
      const temp = document.createElement('div');
      temp.innerHTML = selectAddHtml;
      while (temp.firstChild) wrap.appendChild(temp.firstChild);
      wrap.querySelector('select').dataset.header = h;
      body.appendChild(wrap);
    } else {
      const isDate = h.indexOf('วันที่') !== -1;
      const input = makeInput(fieldId, isDate ? 'date' : 'text');
      input.dataset.header = h;
      if (ctFormExisting && ctFormExisting[h] !== undefined) input.value = ctFormExisting[h];
      body.appendChild(fieldGroup(h, input));
    }
  });

  wireSelectAddButtons(body);
  document.getElementById('contactModalOverlay').classList.add('open');
}

function closeContactModal() {
  document.getElementById('contactModalOverlay').classList.remove('open');
}
document.getElementById('contactModalClose').addEventListener('click', closeContactModal);
document.getElementById('contactModalCancel').addEventListener('click', closeContactModal);
document.getElementById('contactModalOverlay').addEventListener('click', function(e){
  if (e.target === this) closeContactModal();
});
document.getElementById('contactModalSave').addEventListener('click', function(){
  const btn = document.getElementById('contactModalSave');
  const fields = { username: currentUsername(), tbId: ctSelectedTbId };
  document.querySelectorAll('#contactModalBody input[data-header], #contactModalBody select[data-header]').forEach(function(inp){
    fields[inp.dataset.header] = inp.value;
  });
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2"></i>กำลังบันทึก...';
  const done = function(res){
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-device-floppy"></i>บันทึก';
    if (!res || !res.ok) {
      document.getElementById('contactModalError').textContent = (res && res.error) || 'บันทึกไม่สำเร็จ';
      return;
    }
    showToast(ctFormMode === 'edit' ? 'แก้ไขข้อมูลผู้สัมผัสสำเร็จ' : 'เพิ่มผู้สัมผัสใหม่สำเร็จ', 'success');
    closeContactModal();
    selectCtPatient(ctSelectedTbId);
  };
  const fail = function(err){
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-device-floppy"></i>บันทึก';
    document.getElementById('contactModalError').textContent = (err && err.message) || String(err);
  };
  if (ctFormMode === 'edit') {
    google.script.run.withSuccessHandler(done).withFailureHandler(fail).updateContact(ctFormExisting['Contact ID'], fields);
  } else {
    google.script.run.withSuccessHandler(done).withFailureHandler(fail).addContact({ tbId: ctSelectedTbId, fields: fields });
  }
});

function selectContact(c) {
  const area = document.getElementById('ctContactDetail');
  let html = '<div class="section-label">' + escapeHtml(c['ชื่อผู้สัมผัส'] || c['Contact ID']) + '</div>';
  html += '<button class="btn-ghost" id="ctEditBtn" type="button"><i class="ti ti-edit"></i>แก้ไขข้อมูล</button> ';
  html += '<button class="btn-primary" id="ctAddScreeningBtn" type="button" style="margin-left:8px;"><i class="ti ti-plus"></i>บันทึกการคัดกรองครั้งใหม่</button>';
  html += '<div id="ctScreeningForm"></div>';
  html += '<div id="ctScreeningHistory" style="margin-top:16px;"><div class="placeholder"><i class="ti ti-loader-2"></i><h2>กำลังโหลดประวัติ...</h2></div></div>';
  area.innerHTML = html;

  document.getElementById('ctEditBtn').addEventListener('click', function(){ openContactForm('edit', c); });
  document.getElementById('ctAddScreeningBtn').addEventListener('click', function(){ renderScreeningForm(c); });

  google.script.run.withSuccessHandler(function(history){
    renderScreeningHistory(history || []);
  }).withFailureHandler(function(){
    renderScreeningHistory([]);
  }).getContactScreeningHistory(c['Contact ID']);
}

function renderScreeningHistory(history) {
  const box = document.getElementById('ctScreeningHistory');
  if (!box) return;
  if (history.length === 0) {
    box.innerHTML = '<div class="placeholder"><h2>ยังไม่มีประวัติการคัดกรอง</h2></div>';
    return;
  }
  const sorted = history.slice().sort(function(a, b){
    return new Date(b['วันที่คัดกรอง']) - new Date(a['วันที่คัดกรอง']);
  });
  let html = '<div class="table-wrap"><table class="data-table"><thead><tr>' +
    '<th>วันที่คัดกรอง</th><th>ผลคัดกรอง TB</th><th>ผล X-ray</th><th>ผล LTBI</th><th>ได้รับ TPT/IPT</th><th>หมายเหตุ</th>' +
  '</tr></thead><tbody>';
  sorted.forEach(function(h){
    html += '<tr>' +
      '<td>' + escapeHtml(h['วันที่คัดกรอง']) + '</td>' +
      '<td>' + escapeHtml(h['ผลคัดกรอง TB']) + '</td>' +
      '<td>' + escapeHtml(h['ผล X-ray']) + '</td>' +
      '<td>' + escapeHtml(h['ผล LTBI']) + '</td>' +
      '<td>' + escapeHtml(h['ได้รับ TPT/IPT']) + '</td>' +
      '<td>' + escapeHtml(h['หมายเหตุ']) + '</td>' +
    '</tr>';
  });
  html += '</tbody></table></div>';
  box.innerHTML = html;
}

function renderScreeningForm(c) {
  const box = document.getElementById('ctScreeningForm');
  box.innerHTML =
    '<div class="field-row">' +
      '<div class="field-group"><label>วันที่คัดกรอง</label><input type="date" id="csDate" value="' + new Date().toISOString().slice(0,10) + '"></div>' +
      '<div class="field-group"><label>ผลคัดกรอง TB</label><input type="text" id="csScreenResult"></div>' +
    '</div>' +
    '<div class="field-row">' +
      '<div class="field-group"><label>ผล X-ray</label><input type="text" id="csXray"></div>' +
      '<div class="field-group"><label>ผล LTBI</label><input type="text" id="csLtbi"></div>' +
    '</div>' +
    '<div class="field-group"><label>ได้รับ TPT/IPT</label><input type="text" id="csTpt"></div>' +
    '<div class="field-group"><label>หมายเหตุ</label><textarea id="csNote" rows="2"></textarea></div>' +
    '<div class="visit-save-row"><span class="modal-error" id="csError"></span><button class="btn-primary" id="csSaveBtn" type="button"><i class="ti ti-device-floppy"></i>บันทึก</button></div>';

  document.getElementById('csSaveBtn').addEventListener('click', function(){
    const btn = document.getElementById('csSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader-2"></i>กำลังบันทึก...';
    const payload = {
      contactId: c['Contact ID'], tbId: ctSelectedTbId,
      screenDate: document.getElementById('csDate').value,
      screenResult: document.getElementById('csScreenResult').value,
      xrayResult: document.getElementById('csXray').value,
      ltbiResult: document.getElementById('csLtbi').value,
      tpt: document.getElementById('csTpt').value,
      note: document.getElementById('csNote').value,
      username: currentUsername(),
    };
    google.script.run.withSuccessHandler(function(res){
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-device-floppy"></i>บันทึก';
      if (!res || !res.ok) {
        document.getElementById('csError').textContent = (res && res.error) || 'บันทึกไม่สำเร็จ';
        return;
      }
      showToast('บันทึกผลคัดกรองสำเร็จ', 'success');
      selectContact(c);
    }).withFailureHandler(function(err){
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-device-floppy"></i>บันทึก';
      document.getElementById('csError').textContent = (err && err.message) || String(err);
    }).addContactScreening(payload);
  });
}

/* ---------------- บันทึกผลแลป (แท็บใหม่) ---------------- */

let labSelectedTbId = null;
let labFormMode = 'add';
let labFormExisting = null;

function initLabTab() {
  const input = document.getElementById('labSearchInput');
  if (!input || input.dataset.bound) return;
  input.dataset.bound = '1';
  input.addEventListener('input', function(){ renderLabSearchResults(input.value.trim()); });
  setupClearableSearch('labSearchInput', 'labSearchInputClear', function(){ renderLabSearchResults(''); });
}

function renderLabSearchResults(query) {
  const box = document.getElementById('labResults');
  if (!query) { box.innerHTML = ''; return; }
  const q = query.toLowerCase();
  const matches = allPatients.filter(function(p){
    return (p.name || '').toLowerCase().indexOf(q) !== -1 ||
           (p.hn || '').toLowerCase().indexOf(q) !== -1 ||
           (p.tbId || '').toLowerCase().indexOf(q) !== -1;
  }).slice(0, 8);
  if (matches.length === 0) {
    box.innerHTML = '<div class="placeholder"><i class="ti ti-user-search"></i><h2>ไม่พบผู้ป่วย</h2><p>ลองพิมพ์ชื่อ, HN หรือเลข TB ใหม่</p></div>';
    return;
  }
  box.innerHTML = matches.map(function(p){
    return '<div class="visit-result-item" data-tbid="' + escapeHtml(p.tbId) + '">' +
      '<div class="avatar">' + escapeHtml(initials(p.name)) + '</div>' +
      '<div><div class="demo-id">' + escapeHtml(p.tbId) + '</div><div class="demo-name">' + escapeHtml(p.name || '') + '</div></div>' +
    '</div>';
  }).join('');
  box.querySelectorAll('.visit-result-item').forEach(function(el){
    el.addEventListener('click', function(){ selectLabPatient(el.getAttribute('data-tbid')); });
  });
}

function selectLabPatient(tbId) {
  labSelectedTbId = tbId;
  document.getElementById('labResults').innerHTML = '';
  document.getElementById('labSearchInput').value = '';
  const p = allPatients.find(function(x){ return x.tbId === tbId; });
  const area = document.getElementById('labPatientArea');
  area.innerHTML = skeletonPatientDetailArea();

  google.script.run.withSuccessHandler(function(labHistory){
    renderLabPatientArea(p, labHistory || []);
  }).withFailureHandler(function(){
    renderLabPatientArea(p, []);
  }).getRelatedRecords('LAB', tbId);
}

function thaiDateToIso(thaiStr) {
  if (!thaiStr) return '';
  const parts = String(thaiStr).split('/');
  if (parts.length !== 3) return '';
  const year = parseInt(parts[2], 10) - 543;
  return year + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
}

function renderLabPatientArea(p, labHistory) {
  const area = document.getElementById('labPatientArea');
  if (!p) { area.innerHTML = '<div class="placeholder"><h2>ไม่พบข้อมูลผู้ป่วย</h2></div>'; return; }
  const avatarHtml = p.photoUrl
    ? '<img class="avatar-img" src="' + escapeHtml(p.photoUrl) + '" alt="">'
    : '<div class="avatar">' + escapeHtml(initials(p.name)) + '</div>';

  let html = '<button class="btn-back" id="labChangeBtn" type="button"><i class="ti ti-arrow-left"></i>กลับไปค้นหา</button>' +
    '<div class="visit-patient-card">' +
    avatarHtml +
    '<div><div class="demo-id">' + escapeHtml(p.tbId) + (p.hn ? ' &middot; HN ' + escapeHtml(p.hn) : '') + '</div>' +
    '<div class="demo-name">' + escapeHtml(p.name || '') + '</div></div>' +
  '</div>';

  html += '<button class="btn-primary" id="labAddBtn" type="button"><i class="ti ti-plus"></i>เพิ่มผลแลป</button>';
  html += '<div id="labFormArea"></div>';

  html += '<div class="section-label">ประวัติผลแลป (' + labHistory.length + ' รายการ)</div>';
  if (labHistory.length === 0) {
    html += '<div class="placeholder"><h2>ยังไม่มีผลแลป</h2></div>';
  } else {
    const sorted = labHistory.slice().sort(function(a, b){ return thaiDateToIso(b['วันที่ตรวจ']).localeCompare(thaiDateToIso(a['วันที่ตรวจ'])); });
    html += '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th>วันที่ตรวจ</th><th>ชนิด</th><th>สาเหตุ</th><th>ผลเสมหะ</th><th>หมายเหตุ</th><th>Serial no.</th><th></th>' +
    '</tr></thead><tbody>';
    sorted.forEach(function(l){
      html += '<tr>' +
        '<td>' + escapeHtml(l['วันที่ตรวจ']) + '</td>' +
        '<td>' + escapeHtml(l['ชนิดส่งตรวจ']) + '</td>' +
        '<td>' + escapeHtml(l['สาเหตุส่งตรวจ']) + '</td>' +
        '<td>' + labResultBadge(l['ผลเสมหะ']) + '</td>' +
        '<td>' + escapeHtml(l['หมายเหตุ']) + '</td>' +
        '<td>' + escapeHtml(l['Serial Number']) + '</td>' +
        '<td><button class="icon-btn lab-edit-btn" data-labid="' + escapeHtml(l['Lab ID']) + '" title="แก้ไข"><i class="ti ti-edit"></i></button></td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
  }

  area.innerHTML = html;

  document.getElementById('labChangeBtn').addEventListener('click', function(){ focusSearchAgain('labSearchInput', 'labPatientArea'); });
  document.getElementById('labAddBtn').addEventListener('click', function(){ renderLabForm(null); });
  area.querySelectorAll('.lab-edit-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      const labId = btn.getAttribute('data-labid');
      const existing = labHistory.find(function(l){ return l['Lab ID'] === labId; });
      renderLabForm(existing);
    });
  });
}

let formOptionsCache = null;

function ensureFormOptionsThen(cb) {
  if (formOptionsCache) { cb(formOptionsCache); return; }
  google.script.run.withSuccessHandler(function(res){
    formOptionsCache = (res && res.ok) ? res.options : {
      labTestType: ['AFB', 'Molecular', 'Xpert', 'Culture', 'DST'],
      labReason: ['วินิจฉัย'],
      labResult: ['Neg'],
    };
    cb(formOptionsCache);
  }).withFailureHandler(function(){
    formOptionsCache = {
      labTestType: ['AFB', 'Molecular', 'Xpert', 'Culture', 'DST'],
      labReason: ['วินิจฉัย'],
      labResult: ['Neg'],
    };
    cb(formOptionsCache);
  }).getFormOptions();
}

function selectWithAddHtml(id, options, fieldKey, selectedVal) {
  let html = '<div class="select-add-row">';
  html += '<select id="' + id + '">';
  html += '<option value="">เลือก...</option>';
  options.forEach(function(o){
    html += '<option value="' + escapeHtml(o) + '"' + (o === selectedVal ? ' selected' : '') + '>' + escapeHtml(o) + '</option>';
  });
  html += '</select>';
  html += '<button class="select-add-btn" type="button" data-target="' + id + '" title="เพิ่มตัวเลือกใหม่"><i class="ti ti-plus"></i></button>';
  html += '</div>';
  html += '<div class="select-add-box" id="' + id + '_addBox">';
  html += '<input type="text" id="' + id + '_addInput" placeholder="พิมพ์ตัวเลือกใหม่">';
  html += '<button class="btn-ghost" type="button" id="' + id + '_addConfirm">เพิ่ม</button>';
  html += '</div>';
  return html;
}

function resultChipHtml(options, selectedVal) {
  let html = '<div class="tag-row" id="labResultChips">';
  options.forEach(function(o){
    const cls = o === 'Neg' ? 'result-chip chip-green' : 'result-chip chip-red';
    const sel = o === selectedVal ? ' selected' : '';
    html += '<div class="' + cls + sel + '" data-val="' + escapeHtml(o) + '">' + escapeHtml(o) + '</div>';
  });
  html += '<button class="select-add-btn" type="button" data-chip="1" title="เพิ่มตัวเลือกใหม่"><i class="ti ti-plus"></i></button>';
  html += '</div>';
  html += '<div class="select-add-box" id="labResult_addBox">';
  html += '<input type="text" id="labResult_addInput" placeholder="พิมพ์ผลเสมหะแบบใหม่">';
  html += '<button class="btn-ghost" type="button" id="labResult_addConfirm">เพิ่ม</button>';
  html += '</div>';
  html += '<input type="hidden" id="labResult" value="' + escapeHtml(selectedVal || '') + '">';
  return html;
}

function wireSelectAddButtons(container) {
  container.querySelectorAll('.select-add-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      const targetId = btn.getAttribute('data-target');
      const boxId = targetId ? targetId + '_addBox' : 'labResult_addBox';
      document.getElementById(boxId).classList.toggle('open');
    });
  });

  ['labTestType', 'labReason'].forEach(function(id){
    const confirmBtn = document.getElementById(id + '_addConfirm');
    if (!confirmBtn) return;
    confirmBtn.addEventListener('click', function(){
      const input = document.getElementById(id + '_addInput');
      const val = input.value.trim();
      if (!val) return;
      google.script.run.withSuccessHandler(function(res){
        if (!res || !res.ok) return;
        if (formOptionsCache[id].indexOf(val) === -1) formOptionsCache[id].push(val);
        const select = document.getElementById(id);
        const opt = document.createElement('option');
        opt.value = val; opt.textContent = val;
        select.appendChild(opt);
        select.value = val;
        input.value = '';
        document.getElementById(id + '_addBox').classList.remove('open');
      }).addFormOption(id, val);
    });
  });

  const resultConfirmBtn = document.getElementById('labResult_addConfirm');
  if (resultConfirmBtn) {
    resultConfirmBtn.addEventListener('click', function(){
      const input = document.getElementById('labResult_addInput');
      const val = input.value.trim();
      if (!val) return;
      google.script.run.withSuccessHandler(function(res){
        if (!res || !res.ok) return;
        if (formOptionsCache.labResult.indexOf(val) === -1) formOptionsCache.labResult.push(val);
        const chipRow = document.getElementById('labResultChips');
        const addBtn = chipRow.querySelector('.select-add-btn');
        const chip = document.createElement('div');
        chip.className = 'result-chip chip-red selected';
        chip.setAttribute('data-val', val);
        chip.textContent = val;
        chipRow.insertBefore(chip, addBtn);
        chipRow.querySelectorAll('.result-chip').forEach(function(c){ if (c !== chip) c.classList.remove('selected'); });
        document.getElementById('labResult').value = val;
        chip.addEventListener('click', function(){
          chipRow.querySelectorAll('.result-chip').forEach(function(c){ c.classList.remove('selected'); });
          chip.classList.add('selected');
          document.getElementById('labResult').value = val;
        });
        input.value = '';
        document.getElementById('labResult_addBox').classList.remove('open');
      }).addFormOption('labResult', val);
    });
  }

  container.querySelectorAll('.result-chip').forEach(function(chip){
    chip.addEventListener('click', function(){
      container.querySelectorAll('.result-chip').forEach(function(c){ c.classList.remove('selected'); });
      chip.classList.add('selected');
      document.getElementById('labResult').value = chip.getAttribute('data-val');
    });
  });
}

function labResultBadge(val) {
  if (!val) return '-';
  const isNeg = val === 'Neg';
  return '<span class="lab-result-badge ' + (isNeg ? 'lab-result-neg' : 'lab-result-pos') + '">' + escapeHtml(val) + '</span>';
}

function renderLabForm(existing) {
  ensureFormOptionsThen(function(opts){ renderLabFormInner(existing, opts); });
}

function renderLabFormInner(existing, opts) {
  labFormMode = existing ? 'edit' : 'add';
  labFormExisting = existing;
  const box = document.getElementById('labFormArea');
  box.innerHTML =
    '<div class="section-label">' + (existing ? 'แก้ไขผลแลป ' + escapeHtml(existing['Lab ID']) : 'เพิ่มผลแลปใหม่') + '</div>' +
    '<div class="field-row">' +
      '<div class="field-group"><label>วันที่ตรวจ</label><input type="date" id="labDate" value="' + (existing ? thaiDateToIso(existing['วันที่ตรวจ']) : new Date().toISOString().slice(0,10)) + '"></div>' +
      '<div class="field-group"><label>ชนิดส่งตรวจ</label>' + selectWithAddHtml('labTestType', opts.labTestType, 'labTestType', existing ? existing['ชนิดส่งตรวจ'] : '') + '</div>' +
    '</div>' +
    '<div class="field-group"><label>สาเหตุส่งตรวจ</label>' + selectWithAddHtml('labReason', opts.labReason, 'labReason', existing ? existing['สาเหตุส่งตรวจ'] : '') + '</div>' +
    '<div class="field-group"><label>ผลเสมหะ</label>' + resultChipHtml(opts.labResult, existing ? existing['ผลเสมหะ'] : '') + '</div>' +
    '<div class="field-group"><label>Serial Number</label><input type="text" id="labSerial" value="' + (existing ? escapeHtml(existing['Serial Number'] || '') : '') + '"></div>' +
    '<div class="field-group"><label>หมายเหตุ</label><textarea id="labNote" rows="2">' + (existing ? escapeHtml(existing['หมายเหตุ'] || '') : '') + '</textarea></div>' +
    '<div class="visit-save-row"><span class="modal-error" id="labError"></span>' +
      '<button class="btn-ghost" id="labCancelBtn" type="button">ยกเลิก</button>' +
      '<button class="btn-primary" id="labSaveBtn" type="button"><i class="ti ti-device-floppy"></i>บันทึก</button>' +
    '</div>';

  wireSelectAddButtons(box);

  document.getElementById('labCancelBtn').addEventListener('click', function(){ box.innerHTML = ''; });

  document.getElementById('labSaveBtn').addEventListener('click', function(){
    const btn = document.getElementById('labSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader-2"></i>กำลังบันทึก...';
    const selectedChip = document.querySelector('#labResultChips .result-chip.selected');
    const fields = {
      testDate: document.getElementById('labDate').value,
      testType: document.getElementById('labTestType').value,
      reason: document.getElementById('labReason').value,
      result: selectedChip ? selectedChip.getAttribute('data-val') : '',
      serial: document.getElementById('labSerial').value,
      note: document.getElementById('labNote').value,
      username: currentUsername(),
      tbId: labSelectedTbId,
    };
    const done = function(res){
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-device-floppy"></i>บันทึก';
      if (!res || !res.ok) {
        document.getElementById('labError').textContent = (res && res.error) || 'บันทึกไม่สำเร็จ';
        return;
      }
      showToast(labFormMode === 'edit' ? 'แก้ไขผลแลปสำเร็จ' : 'บันทึกผลแลปสำเร็จ', 'success');
      box.innerHTML = '';
      selectLabPatient(labSelectedTbId);
    };
    const fail = function(err){
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-device-floppy"></i>บันทึก';
      document.getElementById('labError').textContent = (err && err.message) || String(err);
    };
    if (labFormMode === 'edit') {
      google.script.run.withSuccessHandler(done).withFailureHandler(fail).updateLabRecord(labFormExisting['Lab ID'], {
        'วันที่ตรวจ': fields.testDate, 'ชนิดส่งตรวจ': fields.testType, 'สาเหตุส่งตรวจ': fields.reason,
        'ผลเสมหะ': fields.result, 'Serial Number': fields.serial, 'หมายเหตุ': fields.note,
      });
    } else {
      google.script.run.withSuccessHandler(done).withFailureHandler(fail).addLabRecord(Object.assign({ tbId: labSelectedTbId }, fields));
    }
  });
}

/* ---------------- นาฬิกา/วันที่ แถบบน ---------------- */

const TH_DAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

function pad2(n) { return String(n).padStart(2, '0'); }

function tickTopbarClock() {
  const timeEl = document.getElementById('clockTime');
  const dateEl = document.getElementById('clockDate');
  if (!timeEl || !dateEl) return;
  const now = new Date();
  timeEl.textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
  dateEl.textContent = 'วัน' + TH_DAYS[now.getDay()] + 'ที่ ' + now.getDate() + ' ' + TH_MONTHS[now.getMonth()] + ' ' + (now.getFullYear() + 543);
}

tickTopbarClock();
setInterval(tickTopbarClock, 1000);

/* ---------------- พิมพ์เอกสาร TB01 / ใบส่งต่อ ---------------- */

function docRow(label1, val1, label2, val2) {
  if (!label2) {
    return '<tr><td style="padding:5px 8px 5px 0;color:#8FA39D;width:38%;">' + label1 + '</td><td colspan="3" style="padding:5px 0;font-weight:600;">' + (val1 || '-') + '</td></tr>';
  }
  return '<tr><td style="padding:5px 8px 5px 0;color:#8FA39D;width:28%;">' + label1 + '</td><td style="padding:5px 0;font-weight:600;">' + (val1 || '-') + '</td>' +
    '<td style="padding:5px 8px 5px 0;color:#8FA39D;width:20%;">' + label2 + '</td><td style="padding:5px 0;font-weight:600;">' + (val2 || '-') + '</td></tr>';
}

function hivDisplayText(d) {
  if (d.hivConsent === 'ยินยอมตรวจ') return 'ตรวจ ผล ' + (d.hivResult || '');
  if (d.hivConsent === 'ไม่ยินยอมตรวจ') return 'ไม่ตรวจ';
  if (d.hivConsent === 'เป็น HIV ก่อนมารักษา') return 'เป็น HIV ก่อนมารักษา TB';
  return '-';
}

function docStatusBadge(d) {
  const text = d.dischargeBy || d.patientStatus || '-';
  let bg = '#EEF1F0', color = '#6B7A76';
  if (/หาย|ครบ/.test(text)) { bg = '#E4F3E9'; color = '#2E7D4F'; }
  else if (/ตาย|ขาดยา|MDR/.test(text)) { bg = '#FBE8E7'; color = '#B3261E'; }
  else if (/โอนออก/.test(text)) { bg = '#E1EEFA'; color = '#2F80A6'; }
  return '<span style="background:' + bg + ';color:' + color + ';padding:3px 10px;border-radius:20px;font-size:12px;">' + escapeHtml(text) + '</span>';
}

function docRegimenBadge(d) {
  return '<span style="background:#E4F3E9;color:#2E7D4F;padding:3px 10px;border-radius:20px;font-size:12px;">' + escapeHtml(d.regimen || '-') + '</span>';
}

function docAddressText(d) {
  return [d.houseNo, d.moo ? 'หมู่ ' + d.moo : '', d.tambon].filter(Boolean).join(' ') || '-';
}

function docLabTable(labRecords) {
  if (!labRecords || labRecords.length === 0) {
    return '<p style="font-size:12.5px;color:#8FA39D;">ไม่มีข้อมูลผลแลป</p>';
  }
  const rows = labRecords.map(function(l, i){
    return '<tr style="background:' + (i % 2 === 0 ? '#F4F7F6' : '#fff') + ';">' +
      '<td style="padding:7px 9px;white-space:nowrap;">' + escapeHtml(l['วันที่ตรวจ']) + '</td>' +
      '<td style="padding:7px 9px;">' + escapeHtml(l['ชนิดส่งตรวจ']) + '</td>' +
      '<td style="padding:7px 9px;">' + escapeHtml(l['สาเหตุส่งตรวจ']) + '</td>' +
      '<td style="padding:7px 9px;"><span style="background:#FBE8E7;color:#B3261E;padding:2px 8px;border-radius:20px;font-size:10.5px;font-weight:600;">' + escapeHtml(l['ผลเสมหะ']) + '</span></td>' +
      '<td style="padding:7px 9px;color:#8FA39D;">' + escapeHtml(l['หมายเหตุ'] || '-') + '</td>' +
      '<td style="padding:7px 9px;color:#8FA39D;font-size:10.5px;">' + escapeHtml(l['Serial Number']) + '</td>' +
    '</tr>';
  }).join('');
  return '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
    '<thead><tr style="background:#0F6B5C;">' +
      '<th style="padding:7px 9px;text-align:left;color:#fff;font-weight:500;">วันที่ตรวจ</th>' +
      '<th style="padding:7px 9px;text-align:left;color:#fff;font-weight:500;">ชนิด</th>' +
      '<th style="padding:7px 9px;text-align:left;color:#fff;font-weight:500;">สาเหตุ</th>' +
      '<th style="padding:7px 9px;text-align:left;color:#fff;font-weight:500;">ผลเสมหะ</th>' +
      '<th style="padding:7px 9px;text-align:left;color:#fff;font-weight:500;">หมายเหตุ</th>' +
      '<th style="padding:7px 9px;text-align:left;color:#fff;font-weight:500;">Serial no.</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>';
}

let docLogoDataUrl = null;

function getDocLogoThen(callback) {
  if (docLogoDataUrl) { callback(docLogoDataUrl); return; }
  google.script.run.withSuccessHandler(function(res){
    docLogoDataUrl = (res && res.ok && res.dataUrl) ? res.dataUrl : '';
    callback(docLogoDataUrl);
  }).withFailureHandler(function(){
    callback('');
  }).getDocLogoDataUrl();
}

function formatThaiDateDisplay(isoDate) {
  if (!isoDate) return '-';
  const parts = String(isoDate).split('-');
  if (parts.length !== 3) return isoDate;
  const year = parseInt(parts[0], 10) + 543;
  return parts[2] + '/' + parts[1] + '/' + year;
}

function docHeader(title, logoUrl) {
  const logoHtml = logoUrl
    ? '<img src="' + logoUrl + '" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">'
    : '<div style="width:36px;height:36px;border-radius:50%;background:#0F6B5C;display:flex;align-items:center;justify-content:center;color:#fff;font-size:17px;">☤</div>';
  return '<div style="display:flex;align-items:center;gap:10px;border-bottom:2px solid #0F6B5C;padding-bottom:12px;margin-bottom:16px;">' +
    logoHtml +
    '<div><p style="margin:0;font-weight:500;font-size:14px;">โรงพยาบาลศรีสาคร</p>' +
    '<p style="margin:0;font-size:16px;font-weight:700;">' + title + '</p></div>' +
  '</div>';
}

function openPrintWindow(title, bodyHtml) {
  const w = window.open('', '_blank');
  w.document.write('<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>' + escapeHtml(title) + '</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">' +
    '<style>body{font-family:"Sarabun",sans-serif;color:#16302C;background:#F3F5F3;margin:0;padding:24px;}' +
    '.doc{background:#fff;border-radius:8px;padding:28px 32px;max-width:640px;margin:0 auto;font-size:14px;}' +
    '@media print{ body{background:#fff;padding:0;} .no-print{display:none;} }</style></head><body>' +
    '<div class="doc">' + bodyHtml + '</div>' +
    '<div class="no-print" style="text-align:center;margin-top:16px;">' +
    '<button onclick="window.print()" style="padding:9px 18px;border-radius:10px;border:none;background:#0F6B5C;color:#fff;font-size:14px;cursor:pointer;font-family:Sarabun,sans-serif;">พิมพ์เอกสารนี้</button>' +
    '</div></body></html>');
  w.document.close();
}

function printTB01() {
  const d = currentDetailData;
  if (!d) return;
  getDocLogoThen(function(logoUrl){
    const infoTable = '<table style="width:100%;border-collapse:collapse;font-size:13.5px;">' +
      docRow('ลำดับ TB', escapeHtml(d.tbId), 'HN', escapeHtml(d.hn)) +
      docRow('ชื่อ-สกุล', escapeHtml(d.name)) +
      docRow('เลข 13 หลัก', escapeHtml(d.citizenId)) +
      docRow('จำแนกผู้ป่วย', escapeHtml(d.classify), 'สถานะ', docStatusBadge(d)) +
      docRow('วันที่ขึ้นทะเบียน', formatThaiDateDisplay(d.regDate), 'วันที่เริ่มยา', formatThaiDateDisplay(d.startDate)) +
      docRow('สูตรยา TB', docRegimenBadge(d), 'ตรวจ HIV', escapeHtml(hivDisplayText(d))) +
      docRow('ที่อยู่', escapeHtml(docAddressText(d))) +
      docRow('เขต', escapeHtml(d.zoneField), 'เบอร์โทร', escapeHtml(d.phone)) +
      (d.asmName ? docRow('ชื่อ อสม.', escapeHtml(d.asmName), 'เบอร์ อสม.', escapeHtml(d.asmPhone)) : '') +
      (d.transferFrom ? docRow('รับโอนจาก', escapeHtml(d.transferFrom)) : '') +
    '</table>';
    const noteHtml = d.note ? '<p style="font-size:12.5px;color:#8FA39D;margin-top:14px;">หมายเหตุ: ' + escapeHtml(d.note) + '</p>' : '';
    const body = docHeader('Tuberculosis Treatment Card — TB01', logoUrl) + infoTable +
      '<p style="font-weight:600;font-size:13.5px;margin:18px 0 8px;color:#0F6B5C;">ผลแลป</p>' +
      docLabTable(d.labRecords) + noteHtml;
    openPrintWindow('TB01 - ' + d.tbId, body);
  });
}

function printReferral() {
  const d = currentDetailData;
  if (!d) return;
  getDocLogoThen(function(logoUrl){
    const referralBoxes = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">' +
      '<div style="background:#F4F7F6;border-radius:8px;padding:10px 12px;"><p style="margin:0;font-size:11px;color:#8FA39D;">ส่งต่อจาก</p>' +
      '<p style="margin:3px 0 0;font-size:13px;font-weight:600;">โรงพยาบาลศรีสาคร จ.นราธิวาส</p></div>' +
      '<div style="background:#FBF2D6;border-radius:8px;padding:10px 12px;"><p style="margin:0;font-size:11px;color:#8A6300;">ส่งต่อไปยัง</p>' +
      '<p style="margin:3px 0 0;font-size:13px;color:#8A6300;border-bottom:1px dashed #D9B25A;padding-bottom:2px;">......................................................</p></div>' +
    '</div>';
    const infoTable = '<table style="width:100%;border-collapse:collapse;font-size:13.5px;">' +
      docRow('ชื่อผู้ป่วย', escapeHtml(d.name)) +
      docRow('เลขบัตรประชาชน', escapeHtml(d.citizenId), 'เบอร์โทร', escapeHtml(d.phone)) +
      docRow('อายุ / เพศ', escapeHtml((d.age || '-') + ' ปี / ' + (d.gender || '-')), 'ที่อยู่', escapeHtml(docAddressText(d))) +
      docRow('District TB No.', escapeHtml(d.tbId), 'HN', escapeHtml(d.hn)) +
      docRow('การวินิจฉัย', escapeHtml(d.classify), 'การขึ้นทะเบียน', docStatusBadge(d)) +
      docRow('ระบบยา', docRegimenBadge(d), 'วันที่เริ่มยา', formatThaiDateDisplay(d.startDate)) +
    '</table>';
    const noteHtml = d.note ? '<p style="font-size:12.5px;color:#8FA39D;margin-top:14px;">หมายเหตุ: ' + escapeHtml(d.note) + '</p>' : '';
    const signature = '<div style="margin-top:26px;padding-top:16px;border-top:1px dashed #DDE3E0;text-align:right;">' +
      '<p style="font-size:12.5px;color:#8FA39D;margin:0 0 24px;">ลงชื่อ ......................................................</p>' +
      '<p style="font-size:12.5px;margin:0;">พยาบาลวิชาชีพดูแลคลินิกวัณโรค โรงพยาบาลศรีสาคร</p>' +
      '<p style="font-size:11.5px;color:#8FA39D;margin:2px 0 0;">วันที่ ......................................................</p>' +
    '</div>';
    const body = docHeader('แบบฟอร์มการส่งต่อผู้ป่วยวัณโรค', logoUrl) + referralBoxes + infoTable +
      '<p style="font-weight:600;font-size:13.5px;margin:18px 0 8px;color:#0F6B5C;">ผลแลป</p>' +
      docLabTable(d.labRecords) + noteHtml + signature;
    openPrintWindow('ใบส่งต่อ - ' + d.tbId, body);
  });
}

document.getElementById('detailPrintTB01Btn').addEventListener('click', printTB01);
document.getElementById('detailPrintReferralBtn').addEventListener('click', printReferral);

/* ---------------- ฟีดกิจกรรมล่าสุด (2 สัปดาห์) ---------------- */

const ACTIVITY_ICON = { visit: 'ti-stethoscope', homevisit: 'ti-home-2', lab: 'ti-flask' };
const ACTIVITY_LABEL = { visit: 'บันทึกการรับบริการ', homevisit: 'เยี่ยมบ้าน', lab: 'ผลแลป' };
const ACTIVITY_COLOR = { visit: 'success', homevisit: 'warn', lab: 'today' };

function renderRecentActivityFeed() {
  const area = document.getElementById('visitPatientArea');
  if (!area) return;
  area.innerHTML = '<div class="placeholder"><i class="ti ti-loader-2"></i><h2>กำลังโหลดกิจกรรมล่าสุด...</h2></div>';

  google.script.run.withSuccessHandler(function(res){
    if (!res || !res.ok) {
      area.innerHTML = '<div class="placeholder"><i class="ti ti-alert-triangle"></i><h2>' + escapeHtml((res && res.error) || 'โหลดไม่สำเร็จ') + '</h2></div>';
      return;
    }
    const feed = res.feed || [];
    const collapsed = feed.length > 5;
    let html = '<div class="section-label activity-header">' +
      '<span>กิจกรรมล่าสุด (14 วันที่ผ่านมา) — ' + feed.length + ' รายการ</span>' +
      (collapsed ? '<button class="btn-ghost activity-toggle-btn" id="activityToggleBtn" type="button">แสดงทั้งหมด</button>' : '') +
    '</div>';
    if (feed.length === 0) {
      html += '<div class="placeholder"><i class="ti ti-history"></i><h2>ยังไม่มีกิจกรรมในช่วง 2 สัปดาห์นี้</h2></div>';
    } else {
      html += '<div id="activityListWrap" class="' + (collapsed ? 'activity-collapsed' : '') + '">';
      feed.forEach(function(item){
        const p = allPatients.find(function(x){ return x.tbId === item.tbId; });
        const name = p ? p.name : item.tbId;
        html += '<div class="activity-item" data-tbid="' + escapeHtml(item.tbId) + '">' +
          '<div class="activity-icon activity-' + ACTIVITY_COLOR[item.type] + '"><i class="ti ' + ACTIVITY_ICON[item.type] + '"></i></div>' +
          '<div class="activity-body">' +
            '<div class="activity-top"><span class="activity-name">' + escapeHtml(name) + '</span><span class="activity-date">' + escapeHtml(item.date) + '</span></div>' +
            '<div class="activity-sub">' + escapeHtml(ACTIVITY_LABEL[item.type]) + (item.summary ? ' — ' + escapeHtml(item.summary) : '') + '</div>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }
    area.innerHTML = html;
    area.querySelectorAll('.activity-item').forEach(function(el){
      el.addEventListener('click', function(){ selectVisitPatient(el.getAttribute('data-tbid')); });
    });
    const toggleBtn = document.getElementById('activityToggleBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function(){
        const wrap = document.getElementById('activityListWrap');
        const isCollapsed = wrap.classList.contains('activity-collapsed');
        wrap.classList.toggle('activity-collapsed', !isCollapsed);
        toggleBtn.textContent = isCollapsed ? 'ย่อ' : 'แสดงทั้งหมด';
      });
    }
  }).withFailureHandler(function(err){
    area.innerHTML = '<div class="placeholder"><i class="ti ti-alert-triangle"></i><h2>' + escapeHtml((err && err.message) || String(err)) + '</h2></div>';
  }).getRecentActivity();
}

/* ---------------- ปฏิทินเด้งจากนาฬิกา (ดูได้ทุกหน้า) ---------------- */

let popoverCalendarDate = new Date();

function positionClockPopover() {
  const pop = document.getElementById('clockPopover');
  const clockEl = document.getElementById('topbarClock');
  if (window.innerWidth <= 900) {
    const rect = clockEl.getBoundingClientRect();
    pop.style.position = 'fixed';
    pop.style.top = (rect.bottom + 8) + 'px';
    pop.style.left = '16px';
    pop.style.right = '16px';
    pop.style.width = 'auto';
  } else {
    pop.style.position = '';
    pop.style.top = '';
    pop.style.left = '';
    pop.style.right = '';
    pop.style.width = '';
  }
}

function toggleClockPopover() {
  const pop = document.getElementById('clockPopover');
  const isOpen = pop.classList.contains('open');
  if (isOpen) { pop.classList.remove('open'); return; }
  popoverCalendarDate = new Date();
  renderClockPopover();
  positionClockPopover();
  pop.classList.add('open');
}

function renderClockPopover() {
  const pop = document.getElementById('clockPopover');
  const list = computeApptStatusList();

  const savedDate = apptCalendarDate;
  apptCalendarDate = popoverCalendarDate;
  const calHtml = renderApptCalendar(list);
  apptCalendarDate = savedDate;

  pop.innerHTML = calHtml +
    '<div class="clock-popover-footer">' +
      '<button class="btn-primary" id="popoverGoApptBtn" type="button"><i class="ti ti-calendar-event"></i>ไปหน้าติดตามนัดรับยา</button>' +
    '</div>';

  const prevBtns = pop.querySelectorAll('#calPrev');
  const nextBtns = pop.querySelectorAll('#calNext');
  prevBtns.forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      popoverCalendarDate.setMonth(popoverCalendarDate.getMonth() - 1);
      renderClockPopover();
    });
  });
  nextBtns.forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      popoverCalendarDate.setMonth(popoverCalendarDate.getMonth() + 1);
      renderClockPopover();
    });
  });
  pop.querySelectorAll('.cal-cell.has-items').forEach(function(cell){
    cell.addEventListener('click', function(){
      apptCalendarDate = new Date(popoverCalendarDate);
      apptViewMode = 'calendar';
      document.getElementById('clockPopover').classList.remove('open');
      selectTab('appt');
    });
  });
  document.getElementById('popoverGoApptBtn').addEventListener('click', function(){
    apptViewMode = 'calendar';
    document.getElementById('clockPopover').classList.remove('open');
    selectTab('appt');
  });
}

document.getElementById('topbarClock').addEventListener('click', function(e){
  e.stopPropagation();
  toggleClockPopover();
});
document.addEventListener('click', function(e){
  const pop = document.getElementById('clockPopover');
  if (pop.classList.contains('open') && !pop.contains(e.target)) {
    pop.classList.remove('open');
  }
});

/* ---------------- Toast Notification ---------------- */

function showToast(message, type) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + (type || 'success');
  const icon = type === 'error' ? 'ti-alert-triangle' : 'ti-circle-check';
  toast.innerHTML = '<i class="ti ' + icon + '"></i><span>' + escapeHtml(message) + '</span>';
  container.appendChild(toast);
  requestAnimationFrame(function(){ toast.classList.add('show'); });
  setTimeout(function(){
    toast.classList.remove('show');
    setTimeout(function(){ toast.remove(); }, 300);
  }, 3000);
}

/* ---------------- ระบบล็อกอิน / สิทธิ์การใช้งาน ---------------- */

let currentUser = null;
try {
  const saved = localStorage.getItem('smarttb_user');
  if (saved) currentUser = JSON.parse(saved);
} catch (e) { currentUser = null; }

function currentUsername() {
  return currentUser ? currentUser.username : '';
}

function applyAuthUI() {
  const loggedIn = !!currentUser;
  const isAdmin = loggedIn && currentUser.role === 'ผู้ดูแลระบบ';
  document.querySelectorAll('.nav-item, .bn-item').forEach(function(el){
    if (el.id === 'bnAuthItem') return;
    if (el.dataset.id === 'activitylog') {
      el.style.display = isAdmin ? '' : 'none';
      return;
    }
    const show = loggedIn || el.dataset.id === 'summary';
    el.style.display = show ? '' : 'none';
  });
  document.querySelectorAll('.nav-group-label').forEach(function(el){
    el.style.display = loggedIn ? '' : 'none';
  });
  document.getElementById('loginBtn').style.display = loggedIn ? 'none' : 'flex';
  document.getElementById('userInfoBox').style.display = loggedIn ? 'flex' : 'none';
  if (loggedIn) {
    document.getElementById('userInfoName').textContent = currentUser.name + ' (' + currentUser.role + ')';
  }
  const bnAuthItemEl = document.getElementById('bnAuthItem');
  if (bnAuthItemEl) {
    bnAuthItemEl.innerHTML = loggedIn
      ? '<i class="ti ti-logout"></i><span>ออกจากระบบ</span>'
      : '<i class="ti ti-login-2"></i><span>เข้าสู่ระบบ</span>';
  }
  if (!loggedIn && currentTab !== 'summary') {
    selectTab('summary');
  }
  if (currentTab === 'activitylog' && !isAdmin) {
    selectTab('summary');
  }
}

function openLoginModal() {
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').textContent = '';
  document.getElementById('loginModalOverlay').classList.add('open');
  getDocLogoThen(function(logoUrl){
    const el = document.getElementById('loginSideLogo');
    if (el && logoUrl) el.innerHTML = '<img src="' + logoUrl + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:13px;">';
  });
}
function closeLoginModal() {
  document.getElementById('loginModalOverlay').classList.remove('open');
}

document.getElementById('loginBtn').addEventListener('click', openLoginModal);
document.getElementById('loginModalClose').addEventListener('click', closeLoginModal);
document.getElementById('loginCancelBtn').addEventListener('click', closeLoginModal);
document.getElementById('loginModalOverlay').addEventListener('click', function(e){
  if (e.target === this) closeLoginModal();
});

document.getElementById('loginSubmitBtn').addEventListener('click', function(){
  const btn = document.getElementById('loginSubmitBtn');
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!username || !password) {
    document.getElementById('loginError').textContent = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน';
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2"></i>กำลังเข้าสู่ระบบ...';
  google.script.run.withSuccessHandler(function(res){
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-login-2"></i>เข้าสู่ระบบ';
    if (!res || !res.ok) {
      document.getElementById('loginError').textContent = (res && res.error) || 'เข้าสู่ระบบไม่สำเร็จ';
      return;
    }
    currentUser = res.user;
    localStorage.setItem('smarttb_user', JSON.stringify(currentUser));
    closeLoginModal();
    applyAuthUI();
    showToast('เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ ' + currentUser.name, 'success');
  }).withFailureHandler(function(err){
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-login-2"></i>เข้าสู่ระบบ';
    document.getElementById('loginError').textContent = (err && err.message) || String(err);
  }).loginUser(username, password);
});

function doLogout() {
  currentUser = null;
  localStorage.removeItem('smarttb_user');
  applyAuthUI();
  showToast('ออกจากระบบแล้ว', 'success');
}
document.getElementById('logoutBtn').addEventListener('click', doLogout);

/* ---------------- บันทึกกิจกรรม (เฉพาะผู้ดูแลระบบ) ---------------- */

const ACTION_ICON_MAP = {
  'เพิ่มผู้ป่วยใหม่': 'ti-user-plus', 'แก้ไขข้อมูลผู้ป่วย': 'ti-edit',
  'บันทึกการรับบริการ': 'ti-stethoscope', 'บันทึกการเยี่ยมบ้าน': 'ti-home-2',
  'เพิ่มผลแลป': 'ti-flask', 'แก้ไขผลแลป': 'ti-flask',
  'เพิ่มผู้สัมผัสใหม่': 'ti-users', 'แก้ไขข้อมูลผู้สัมผัส': 'ti-users',
  'บันทึกผลคัดกรองผู้สัมผัส': 'ti-clipboard-check',
};

function renderActivityLog() {
  const area = document.getElementById('activityLogArea');
  if (!area) return;
  area.innerHTML = new Array(6).fill(0).map(skeletonPatientRow).join('');

  google.script.run.withSuccessHandler(function(res){
    if (!res || !res.ok) {
      area.innerHTML = '<div class="placeholder"><i class="ti ti-alert-triangle"></i><h2>' + escapeHtml((res && res.error) || 'โหลดไม่สำเร็จ') + '</h2></div>';
      return;
    }
    const logs = res.logs || [];
    if (logs.length === 0) {
      area.innerHTML = '<div class="placeholder"><i class="ti ti-history"></i><h2>ยังไม่มีประวัติกิจกรรม</h2></div>';
      return;
    }
    let html = '<div class="count-line">แสดง ' + logs.length + ' รายการล่าสุด</div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th>วันเวลา</th><th>ผู้ใช้งาน</th><th>การกระทำ</th><th>ลำดับ TB</th><th>รายละเอียด</th>' +
      '</tr></thead><tbody>';
    logs.forEach(function(l){
      const icon = ACTION_ICON_MAP[l['การกระทำ']] || 'ti-file-text';
      html += '<tr' + (l['ลำดับ TB'] ? ' class="table-row" data-tbid="' + escapeHtml(l['ลำดับ TB']) + '"' : '') + '>' +
        '<td>' + escapeHtml(l['วันเวลา']) + '</td>' +
        '<td>' + escapeHtml(l['ผู้ใช้งาน']) + '</td>' +
        '<td><i class="ti ' + icon + '" style="margin-right:6px;color:var(--primary-dark);"></i>' + escapeHtml(l['การกระทำ']) + '</td>' +
        '<td>' + escapeHtml(l['ลำดับ TB']) + '</td>' +
        '<td>' + escapeHtml(l['รายละเอียด']) + '</td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
    area.innerHTML = html;
    area.querySelectorAll('.table-row[data-tbid]').forEach(function(row){
      row.addEventListener('click', function(){ openDetailModal(row.getAttribute('data-tbid')); });
    });
  }).withFailureHandler(function(err){
    area.innerHTML = '<div class="placeholder"><i class="ti ti-alert-triangle"></i><h2>' + escapeHtml((err && err.message) || String(err)) + '</h2></div>';
  }).getActivityLog();
}

/* ---------------- ดาวน์โหลดรายงาน PDF (แดชบอร์ด) ---------------- */

function chartImgTag(canvasId, title) {
  const chart = chartInstances[canvasId];
  if (!chart) return '';
  const img = chart.toBase64Image();
  return '<div style="margin-bottom:22px;">' +
    '<p style="font-weight:600;font-size:13px;color:#0F6B5C;margin:0 0 8px;">' + escapeHtml(title) + '</p>' +
    '<img src="' + img + '" style="width:100%;max-width:560px;display:block;">' +
  '</div>';
}

function exportDashboardPdf(total, activeCount, curedCount, visitedCount, fromVal, toVal) {
  getDocLogoThen(function(logoUrl){
    const periodText = (fromVal || toVal)
      ? 'ช่วงข้อมูล: ' + (fromVal ? formatThaiDateDisplay(fromVal) : 'เริ่มต้น') + ' ถึง ' + (toVal ? formatThaiDateDisplay(toVal) : 'ปัจจุบัน')
      : 'ช่วงข้อมูล: ทั้งหมดในระบบ';

    const heroTable =
      '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">' +
        '<tr>' +
          '<td style="padding:10px;text-align:center;background:#F4F7F6;border-radius:8px;"><div style="font-size:22px;font-weight:700;color:#0F6B5C;">' + total + '</div><div style="font-size:11px;color:#8FA39D;">ผู้ป่วยทั้งหมด</div></td>' +
          '<td style="width:8px;"></td>' +
          '<td style="padding:10px;text-align:center;background:#F4F7F6;border-radius:8px;"><div style="font-size:22px;font-weight:700;color:#2F80A6;">' + activeCount + '</div><div style="font-size:11px;color:#8FA39D;">กำลังรักษา</div></td>' +
          '<td style="width:8px;"></td>' +
          '<td style="padding:10px;text-align:center;background:#F4F7F6;border-radius:8px;"><div style="font-size:22px;font-weight:700;color:#2E7D4F;">' + curedCount + '</div><div style="font-size:11px;color:#8FA39D;">หาย/ครบการรักษา</div></td>' +
          '<td style="width:8px;"></td>' +
          '<td style="padding:10px;text-align:center;background:#F4F7F6;border-radius:8px;"><div style="font-size:22px;font-weight:700;color:#7C3AED;">' + visitedCount + '</div><div style="font-size:11px;color:#8FA39D;">เยี่ยมบ้านแล้ว</div></td>' +
        '</tr>' +
      '</table>';

    const charts =
      chartImgTag('chartZoneAll', 'จำนวนขึ้นทะเบียนทั้งหมด (แยกตาม รพ.สต.)') +
      chartImgTag('chartPatientStatus', 'สถานะคนไข้ TB') +
      chartImgTag('chartZoneDischarge', 'จำนวนจำหน่าย (แยกตาม รพ.สต.)') +
      chartImgTag('chartDischargeBy', 'จำหน่ายโดย') +
      chartImgTag('chartHiv', 'ตรวจ HIV') +
      chartImgTag('chartGender', 'เพศขึ้นทะเบียน') +
      chartImgTag('chartVisit', 'สถานะเยี่ยมบ้าน') +
      chartImgTag('chartNewMPlus', 'ผลรักษา New M+');

    const body = docHeader('รายงานสรุปผลข้อมูลผู้ป่วยวัณโรค', logoUrl) +
      '<p style="font-size:12px;color:#8FA39D;margin:0 0 16px;">' + escapeHtml(periodText) + '</p>' +
      heroTable + charts;

    openPrintWindow('รายงานสรุปผลข้อมูล SmartTB', body);
  });
}

/* ---------------- Export Excel ---------------- */

document.getElementById('exportExcelBtn').addEventListener('click', function(){
  const btn = document.getElementById('exportExcelBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2"></i>';

  google.script.run.withSuccessHandler(function(res){
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-file-spreadsheet"></i>';
    if (!res || !res.ok) {
      showToast((res && res.error) || 'ดึงข้อมูลไม่สำเร็จ', 'error');
      return;
    }
    const visibleIds = {};
    filterForTab(currentTab, allPatients).forEach(function(p){ visibleIds[p.tbId] = true; });
    const query = (searchBox && searchBox.value || '').trim().toLowerCase();
    const rows = res.rows.filter(function(r){
      if (!visibleIds[r['ลำดับ TB']]) return false;
      if (!query) return true;
      return (r['ชื่อ-สกุล'] || '').toLowerCase().indexOf(query) !== -1 ||
             (r['HN'] || '').toLowerCase().indexOf(query) !== -1 ||
             (r['ลำดับ TB'] || '').toLowerCase().indexOf(query) !== -1;
    });
    if (rows.length === 0) {
      showToast('ไม่มีข้อมูลให้ดาวน์โหลดในหมวดนี้', 'error');
      return;
    }
    const headerOrder = [
      'ลำดับ TB','HN','ชื่อ-สกุล','เลข 13 หลัก','เพศ','อายุ',
      'สถานะการรักษา','จำแนกผู้ป่วย','สูตรยา TB','ตรวจ HIV','โรคประจำตัว','น้ำหนักเริ่มยา',
      'วันที่ขึ้นทะเบียน','วันที่เริ่มยา TB','สถานะคนไข้ TB','รับโอนจาก','วันที่จำหน่าย TB','จำหน่ายโดย',
      'ที่อยู่บ้านเลขที่','หมู่','ตำบล','นอกเขต','เขต','เบอร์โทร',
      'ชื่อ อสม.','เบอร์ อสม.','แผนที่บ้านคนไข้',
      'สถานะเยี่ยมบ้าน','สถานะบันทึกการกินยา','วันนี้รับยาที่','วันที่นัดรับยาถัดไป','รับยาที่เท่าไหร่',
      'สถานะข้อมูลครบ','จำนวนวันจัดยา','หมายเหตุ',
    ];
    const ws = XLSX.utils.json_to_sheet(rows, { header: headerOrder });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ทะเบียน TB');
    const t = TABS.find(function(x){ return x.id === currentTab; });
    const fileName = 'SmartTB_' + (t ? t.short : currentTab) + '_' + new Date().toISOString().slice(0,10) + '.xlsx';
    XLSX.writeFile(wb, fileName);
    showToast('ดาวน์โหลดไฟล์ Excel สำเร็จ (' + rows.length + ' รายการ)', 'success');
  }).withFailureHandler(function(err){
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-file-spreadsheet"></i>';
    showToast((err && err.message) || String(err), 'error');
  }).getFullPatientDataForExport();
});

function openPhotoLightbox(src) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:200;display:flex;align-items:center;justify-content:center;padding:24px;cursor:zoom-out;';
  const img = document.createElement('img');
  img.src = src;
  img.style.cssText = 'max-width:100%;max-height:100%;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,0.5);';
  overlay.appendChild(img);
  overlay.addEventListener('click', function(){ overlay.remove(); });
  document.body.appendChild(overlay);
}

applyAuthUI();