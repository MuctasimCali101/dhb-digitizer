/* ============================================================
   DHB Field Registration System — Google Sheets API
   ============================================================ */

var API = API || {};

API.call = function(params, method){
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
