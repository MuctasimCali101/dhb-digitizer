/* ============================================================
   DHB Field Registration System — Authentication
   ============================================================ */

var AUTH = AUTH || {};

/* Demo mode: use this if the Apps Script backend isn't deployed yet.
   Stores data in localStorage for testing. */
AUTH.DEMO_USERS = {
  'admin': { password: 'admin', role: 'admin', city: 'ALL', name: 'Admin' },
  'engineer1': { password: 'eng123', role: 'engineer', city: 'BOS', name: 'Cabirashid' },
  'engineer2': { password: 'eng123', role: 'engineer', city: 'BOS', name: 'Jaamac' },
  'super': { password: 'sup123', role: 'supervisor', city: 'BOS', name: 'Supervisor' }
};

AUTH.demoLogin = function(username, password, cityCode){
  APP.showLoading('Soo gelida demo...');
  return new Promise(function(resolve, reject){
    setTimeout(function(){
      APP.hideLoading();
      var u = AUTH.DEMO_USERS[username.toLowerCase()];
      if(!u || u.password !== password){
        reject(new Error('Username ama password waa khalad'));
        return;
      }
      if(username.toLowerCase() !== 'admin' && u.city.toUpperCase() !== cityCode.toUpperCase()){
        reject(new Error('City code kuma haboona account-ka'));
        return;
      }
      localStorage.setItem('dhb_token', 'demo_' + username + '_' + Date.now());
      localStorage.setItem('dhb_role', u.role);
      localStorage.setItem('dhb_user', u.name);
      localStorage.setItem('dhb_city', u.city === 'ALL' ? cityCode.toUpperCase() : u.city);
      localStorage.setItem('dhb_city_name', u.city === 'ALL' ? 'All Cities' : u.city);
      resolve({ success: true, role: u.role, username: u.name, city_code: u.city });
    }, 500);
  });
};

/* Simple SHA-256 hash (FIPS 180-4) for token generation.
   Uses the Web Crypto API — available in all modern browsers. */
AUTH.hash = function(str){
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
    .then(function(hash){
      return Array.from(new Uint8Array(hash)).map(function(b){ return b.toString(16).padStart(2,'0') }).join('');
    });
};

AUTH.login = function(username, password, cityCode){
  APP.showLoading('Soo gelida...');
  var url = APP.config.API_URL + '?action=login&username=' + encodeURIComponent(username) +
    '&password=' + encodeURIComponent(password) +
    '&city_code=' + encodeURIComponent(cityCode);

  return fetch(url)
    .then(function(r){ return r.json() })
    .then(function(data){
      APP.hideLoading();
      if(data.success){
        localStorage.setItem('dhb_token', data.token);
        localStorage.setItem('dhb_role', data.role);
        localStorage.setItem('dhb_user', data.username);
        localStorage.setItem('dhb_user_id', String(data.user_id || ''));
        localStorage.setItem('dhb_city', data.city_code);
        localStorage.setItem('dhb_city_name', data.city_name);
        return data;
      } else {
        throw new Error(data.error || 'Login failed');
      }
    });
};

AUTH.adminLogin = function(username, password){
  APP.showLoading('Soo gelida...');
  var url = APP.config.API_URL + '?action=login&username=' + encodeURIComponent(username) +
    '&password=' + encodeURIComponent(password) + '&city_code=ADMIN';

  return fetch(url)
    .then(function(r){ return r.json() })
    .then(function(data){
      APP.hideLoading();
      if(data.success && data.role === 'admin'){
        localStorage.setItem('dhb_token', data.token);
        localStorage.setItem('dhb_role', 'admin');
        localStorage.setItem('dhb_user', data.username);
        localStorage.setItem('dhb_user_id', String(data.user_id || ''));
        return data;
      } else {
        throw new Error(data.error || 'Maamulaha gudagalka waa khalad');
      }
    });
};

AUTH.checkSession = function(){
  var token = APP.getToken();
  if(!token) return Promise.resolve(false);

  return fetch(APP.config.API_URL + '?action=checkSession&token=' + encodeURIComponent(token))
    .then(function(r){ return r.json() })
    .then(function(data){
      if(!data.success){
        APP.logout();
        return false;
      }
      return true;
    })
    .catch(function(){ return false });
};

AUTH.addUser = function(data){
  var formData = new URLSearchParams();
  formData.append('action', 'addUser');
  formData.append('token', APP.getToken());
  formData.append('username', data.username);
  formData.append('password', data.password);
  formData.append('role', data.role);
  formData.append('city_code', data.city_code);

  return fetch(APP.config.API_URL, { method: 'POST', body: formData })
    .then(function(r){ return r.json() });
};

AUTH.updateUser = function(data){
  var formData = new URLSearchParams();
  formData.append('action', 'updateUser');
  formData.append('token', APP.getToken());
  formData.append('user_id', data.user_id);
  formData.append('username', data.username);
  if(data.password) formData.append('password', data.password);
  formData.append('role', data.role);
  formData.append('city_code', data.city_code);
  formData.append('active', data.active);

  return fetch(APP.config.API_URL, { method: 'POST', body: formData })
    .then(function(r){ return r.json() });
};
