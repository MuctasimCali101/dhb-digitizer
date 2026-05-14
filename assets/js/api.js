/* ============================================================
   DHB Field Registration System — Google Sheets API
   ============================================================ */

var API = API || {};

/* Demo storage key */
var DEMO_KEY = 'dhb_demo_submissions';

function isDemo(){ return (APP.getToken() || '').indexOf('demo_') === 0 }

function getDemoSubs(){
  try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || [] } catch(e){ return [] }
}

function saveDemoSubs(subs){
  localStorage.setItem(DEMO_KEY, JSON.stringify(subs));
}

API.call = function(params, method){
  /* Demo mode: bypass network, use localStorage */
  if(isDemo()){
    return handleDemoCall(params, method);
  }

  method = method || 'GET';
  var url = APP.config.API_URL;
  var opts = { method: method };

  if(method === 'GET'){
    url += '?' + Object.keys(params).map(function(k){
      return k + '=' + encodeURIComponent(params[k]);
    }).join('&');
  } else {
    var fd = new URLSearchParams();
    Object.keys(params).forEach(function(k){ fd.append(k, params[k]) });
    opts.body = fd.toString();
    opts.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  }

  return fetch(url, opts).then(function(r){ return r.json() });
};

function handleDemoCall(params, method){
  return new Promise(function(resolve){
    setTimeout(function(){
      var action = params.action || '';

      if(action === 'submit'){
        var subs = getDemoSubs();
        var id = 'DHB-DEMO-' + Date.now().toString(36).toUpperCase();
        var row = {
          'Gudbinta ID (Submission ID)': id,
          'Taariikhda (Date)': params.survey_date || APP.today(),
          'Injineer (Engineer)': params.engineer || APP.getUser(),
          'Magaca Milkiilaha (Owner Name)': params.owner_name || '',
          'Telefoonka (Phone)': params.owner_phone || '',
          'Magaca Hooyada (Mother Name)': params.mother_name || '',
          'Jinsiga (Gender)': params.gender || '',
          'Magaca Tixraaca (Reference Name)': params.ref_name || '',
          'Tel Tixraaca (Reference Phone)': params.ref_phone || '',
          'Jinsiga Tixraaca (Ref Gender)': params.ref_gender || '',
          'Xiriirka (Relationship)': params.relationship || '',
          'Nooca Hantida (Property Type)': params.property_type || '',
          'Ballaca (Width)': params.width || '',
          'Dhererka (Length)': params.length || '',
          'Bedka m\u00b2 (Area)': params.area_calc || '',
          'Degmada (Sub-district)': params.sub_district || '',
          'Xaafadda (Section)': params.section || '',
          'Magaca Waddada (Street)': params.street || '',
          'Calaamadda (Landmark)': params.nearby || '',
          'Waqooyi (North Neighbor)': params.north_name || '',
          'Waqooyi masaafo (North Distance)': params.north_dist || '',
          'Koonfur (South Neighbor)': params.south_name || '',
          'Koonfur masaafo (South Distance)': params.south_dist || '',
          'Bari (East Neighbor)': params.east_name || '',
          'Bari masaafo (East Distance)': params.east_dist || '',
          'Galbeed (West Neighbor)': params.west_name || '',
          'Galbeed masaafo (West Distance)': params.west_dist || '',
          'TIX/LR Number': params.tix_number || '',
          'Taariikhda TIX (Issue Date)': params.tix_date || '',
          'Hay\'adda TIX (Authority)': params.tix_authority || '',
          'Latitude': params.gps_lat || '',
          'Longitude': params.gps_lon || '',
          'Sawirka Milkiilaha (Owner Photo)': '',
          'Sawirka Dhulka (Property Photo)': '',
          '_status': 'submitted',
          '_engineer': APP.getUser(),
          '_city': APP.getCity(),
          '_created_at': new Date().toISOString()
        };
        subs.push(row);
        saveDemoSubs(subs);
        resolve({ success: true, submission_id: id, message: 'Demo: gudbin waa la kaydiyay' });
      }

      else if(action === 'getSubmissions'){
        var subs = getDemoSubs();
        var role = params.role || 'engineer';
        var city = params.city_code || '';
        var engineer = params.engineer || '';
        if(role === 'engineer'){
          subs = subs.filter(function(s){ return s._engineer === engineer });
        }
        resolve({ submissions: subs });
      }

      else if(action === 'getSubmission'){
        var subs = getDemoSubs();
        var found = subs.find(function(s){ return String(s['Gudbinta ID (Submission ID)']) === String(params.id) });
        resolve({ submission: found || null });
      }

      else if(action === 'getUsers'){
        var users = Object.keys(AUTH.DEMO_USERS).map(function(u, i){
          return { user_id: i+1, username: u, role: AUTH.DEMO_USERS[u].role, city_code: AUTH.DEMO_USERS[u].city, active: true, last_login: '' };
        });
        resolve({ users: users });
      }

      else if(action === 'getCities'){
        resolve({ cities: [
          { city_code: 'BOS', city_name: 'Bosaso', active: true },
          { city_code: 'GAR', city_name: 'Garoowe', active: true }
        ]});
      }

      else if(action === 'exportCSV'){
        var subs = getDemoSubs();
        if(subs.length === 0){ resolve({ csv: '' }); return }
        var headers = Object.keys(subs[0]);
        var csv = headers.map(function(h){ return '"' + String(h).replace(/"/g,'""') + '"' }).join(',') + '\n';
        subs.forEach(function(r){
          csv += headers.map(function(h){ return '"' + String(r[h]||'').replace(/"/g,'""') + '"' }).join(',') + '\n';
        });
        resolve({ csv: csv });
      }

      else if(action === 'saveKML'){
        resolve({ success: true, url: 'https://drive.google.com/demo/' + Date.now(), filename: 'DHB_demo.kml' });
      }

      else {
        resolve({ success: false, error: 'Demo: action not supported' });
      }
    }, 300);
  });
}

API.submitRegistration = function(formData){
  formData.action = 'submit';
  formData.token = APP.getToken();
  formData.city_code = APP.getCity();
  formData.engineer = APP.getUser();
  return API.call(formData, 'POST');
};

API.getSubmissions = function(filters){
  var params = {
    action: 'getSubmissions',
    token: APP.getToken(),
    role: APP.getRole(),
    city_code: APP.getCity(),
    engineer: APP.getUser()
  };
  if(filters){
    if(filters.dateFrom) params.date_from = filters.dateFrom;
    if(filters.dateTo) params.date_to = filters.dateTo;
    if(filters.sub_district) params.sub_district = filters.sub_district;
    if(filters.section) params.section = filters.section;
    if(filters.engineer) params.engineer_filter = filters.engineer;
  }
  return API.call(params);
};

API.getSubmission = function(submissionId){
  return API.call({
    action: 'getSubmission',
    token: APP.getToken(),
    id: submissionId
  });
};

API.getUsers = function(){
  return API.call({
    action: 'getUsers',
    token: APP.getToken()
  });
};

API.getCities = function(){
  return API.call({ action: 'getCities' });
};

API.exportCSV = function(cityCode){
  return fetch(APP.config.API_URL + '?action=exportCSV&token=' + encodeURIComponent(APP.getToken()) +
    '&city_code=' + encodeURIComponent(cityCode || APP.getCity()))
    .then(function(r){ return r.text() });
};

API.saveKML = function(kmlContent, meta){
  var fd = new URLSearchParams();
  fd.append('action', 'saveKML');
  fd.append('token', APP.getToken());
  fd.append('kml_content', kmlContent);
  fd.append('owner_name', meta.owner_name || '');
  fd.append('owner_phone', meta.owner_phone || '');
  fd.append('sub_district', meta.sub_district || '');
  fd.append('section', meta.section || '');
  fd.append('survey_date', meta.survey_date || '');
  fd.append('engineer', APP.getUser());
  fd.append('city_code', APP.getCity());
  fd.append('area', meta.area || '');
  fd.append('perimeter', meta.perimeter || '');
  fd.append('num_points', String(meta.num_points || 0));

  return fetch(APP.config.API_URL, { method: 'POST', body: fd })
    .then(function(r){ return r.json() });
};

API.deleteSubmission = function(submissionId){
  return API.call({
    action: 'deleteSubmission',
    token: APP.getToken(),
    id: submissionId
  }, 'POST');
};
