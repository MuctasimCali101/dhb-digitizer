/* ============================================================
   DHB Field Registration System — Authentication
   ============================================================ */

var AUTH = AUTH || {};

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
