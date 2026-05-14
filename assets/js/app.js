/* ============================================================
   DHB Field Registration System — App Utilities
   ============================================================ */

var APP = APP || {};

APP.NAME = 'DHB Field Registration';
APP.VERSION = '1.0.0';

APP.config = {
  /* Google Apps Script Web App URL — set after deployment */
  API_URL: 'https://script.google.com/macros/s/AKfycbwqY-18JC1HKI3vlY9NHWTwF1j3zrxbDgoHconk4J0V5jjgwAnHWBeDydX-YYKQK1S9KA/exec',
  SUB_DISTRICTS: {
    'Biyo Kulule': ['Suweyto','26ka Juun','Gu\'soore','Girible B','Girible A','Dayaxa','Sanfarow'],
    'Buurcad': ['Sanfarow','Girible Ubax'],
    'Baalade': ['Kulmiye','Hormuud','Horseed','Octoobar'],
    'Benderqaasim': ['Hormuud','Kulmiye','Wadajir','Howlwadaag','1 Luulyo','Xaafatul Carab']
  }
};

APP.toast = function(msg, type, duration){
  type = type || 'info';
  duration = duration || 3000;
  var c = document.getElementById('toast-container');
  if(!c){ c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c) }
  var el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(function(){
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(function(){ el.remove() }, 300);
  }, duration);
};

APP.esc = function(s){
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
};

APP.showLoading = function(msg){
  var el = document.getElementById('loading-screen');
  if(!el){
    el = document.createElement('div');
    el.id = 'loading-screen';
    el.innerHTML = '<div class="spinner"></div><div class="loading-text">' + (msg||'') + '</div>';
    document.body.appendChild(el);
  }
  el.classList.remove('hidden');
  var txt = el.querySelector('.loading-text');
  if(txt && msg) txt.textContent = msg;
};

APP.hideLoading = function(){
  var el = document.getElementById('loading-screen');
  if(el) el.classList.add('hidden');
};

APP.getUrlParam = function(name){
  var p = new URLSearchParams(location.search);
  return p.get(name) || '';
};

APP.formatDate = function(d){
  if(!d) return '';
  if(typeof d === 'string') d = new Date(d);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
};

APP.today = function(){
  return APP.formatDate(new Date());
};

APP.genId = function(){
  return 'DHB-' + Date.now().toString(36).toUpperCase();
};

APP.populateSelect = function(selId, options, placeholder){
  var sel = document.getElementById(selId);
  if(!sel) return;
  sel.innerHTML = '';
  if(placeholder){
    var opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    sel.appendChild(opt);
  }
  options.forEach(function(o){
    var opt = document.createElement('option');
    opt.value = typeof o === 'string' ? o : o.value;
    opt.textContent = typeof o === 'string' ? o : o.label;
    sel.appendChild(opt);
  });
};

APP.confirm = function(msg, cb){
  var modal = document.createElement('div');
  modal.className = 'modal-overlay show';
  modal.innerHTML =
    '<div class="modal">' +
      '<p>' + APP.esc(msg) + '</p>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-outline" id="confirm-no">Haya</button>' +
        '<button class="btn btn-danger" id="confirm-yes">Haa</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  modal.querySelector('#confirm-no').onclick = function(){ modal.remove() };
  modal.querySelector('#confirm-yes').onclick = function(){ modal.remove(); if(cb) cb() };
};

APP.getToken = function(){ return localStorage.getItem('dhb_token') };
APP.getRole = function(){ return localStorage.getItem('dhb_role') };
APP.getUser = function(){ return localStorage.getItem('dhb_user') };
APP.getCity = function(){ return localStorage.getItem('dhb_city') };
APP.getCityName = function(){ return localStorage.getItem('dhb_city_name') };

APP.requireAuth = function(){
  if(!APP.getToken()){
    location.href = 'index.html';
    return false;
  }
  return true;
};

APP.requireRole = function(role){
  if(!APP.requireAuth()) return false;
  if(APP.getRole() !== role && APP.getRole() !== 'admin'){
    location.href = 'dashboard.html';
    return false;
  }
  return true;
};

APP.logout = function(){
  localStorage.removeItem('dhb_token');
  localStorage.removeItem('dhb_role');
  localStorage.removeItem('dhb_user');
  localStorage.removeItem('dhb_city');
  localStorage.removeItem('dhb_city_name');
  location.href = 'index.html';
};

/* Bottom nav active state */
APP.setActiveNav = function(page){
  document.querySelectorAll('.nav-item').forEach(function(el){
    var href = el.getAttribute('data-page');
    el.classList.toggle('active', href === page || location.pathname.indexOf(href) > -1);
  });
};

/* Register SW */
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('service-worker.js').catch(function(){});
}
