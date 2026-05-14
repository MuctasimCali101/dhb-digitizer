/**
 * DHB Field Registration System — Google Apps Script Backend
 * ===========================================================
 * Deploy as Web App (Execute as: Me, Access: Anyone).
 * Acts as REST API for the frontend.
 * 
 * ============================================================
 * SECTION 1: CONFIGURATION
 * ============================================================
 */

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'dhb2024admin';
const ADMIN_CODE = 'DHB-ADMIN-2024';
const SECRET_SALT = 'dhb-secret-salt-2024';

const SHEET_USERS = 'Users';
const SHEET_CITIES = 'Cities';
const SHEET_PREFIX = 'Submissions_';

/**
 * ============================================================
 * SECTION 2: WEB APP ENTRY POINTS
 * ============================================================
 */

function doGet(e) {
  var action = e.parameter.action || '';
  var handler = getHandler(action);
  if (handler) return handler(e);
  return jsonError('Unknown action: ' + action);
}

function doPost(e) {
  var params = e.parameter;
  var action = params.action || '';
  var handler = getHandler(action);
  if (handler) return handler(e);
  return jsonError('Unknown action: ' + action);
}

function getHandler(action) {
  var handlers = {
    'login': handleLogin,
    'checkSession': handleCheckSession,
    'submit': handleSubmit,
    'getSubmissions': handleGetSubmissions,
    'getSubmission': handleGetSubmission,
    'getUsers': handleGetUsers,
    'addUser': handleAddUser,
    'updateUser': handleUpdateUser,
    'getCities': handleGetCities,
    'exportCSV': handleExportCSV,
    'saveKML': handleSaveKML
  };
  return handlers[action] || null;
}

/**
 * ============================================================
 * SECTION 3: AUTHENTICATION
 * ============================================================
 */

function handleLogin(e) {
  var username = (e.parameter.username || '').trim().toLowerCase();
  var password = e.parameter.password || '';
  var cityCode = (e.parameter.city_code || '').trim().toUpperCase();

  /* Admin login */
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    var token = generateToken(username);
    return jsonSuccess({
      token: token,
      role: 'admin',
      username: username,
      user_id: 0,
      city_code: 'ALL',
      city_name: 'Dhammaan Magaalooyinka'
    });
  }

  var users = getSheetData(SHEET_USERS);
  if (!users || users.length < 2) return jsonError('Users sheet not found or empty');

  var headers = users[0];
  var userRow = null;
  for (var i = 1; i < users.length; i++) {
    var u = users[i];
    if (String(u[getColIndex(headers, 'username')]).toLowerCase() === username &&
        u[getColIndex(headers, 'password')] === password) {
      userRow = u;
      break;
    }
  }

  if (!userRow) return jsonError('Username ama password waa khalad');

  var active = userRow[getColIndex(headers, 'active')];
  if (active === false || active === 'false' || active === 'FALSE') {
    return jsonError('Isticmaalaha waa la joojiyay. Xiriir maamulaha');
  }

  var userCity = String(userRow[getColIndex(headers, 'city_code')]).toUpperCase();
  if (userCity !== cityCode) {
    return jsonError('City code-ka kuma haboona account-kaaga');
  }

  var cities = getSheetData(SHEET_CITIES);
  var cityName = cityCode;
  if (cities && cities.length > 1) {
    var ch = cities[0];
    for (var k = 1; k < cities.length; k++) {
      if (String(cities[k][getColIndex(ch, 'city_code')]).toUpperCase() === cityCode) {
        cityName = cities[k][getColIndex(ch, 'city_name')] || cityCode;
        break;
      }
    }
  }

  var token = generateToken(username);
  updateLastLogin(username);

  return jsonSuccess({
    token: token,
    role: userRow[getColIndex(headers, 'role')] || 'engineer',
    username: username,
    user_id: i,
    city_code: cityCode,
    city_name: cityName
  });
}

function handleCheckSession(e) {
  var token = e.parameter.token || '';
  if (!token) return jsonSuccess(false);
  var parts = token.split('_');
  if (parts.length < 2) return jsonSuccess(false);
  var username = parts[0];
  var users = getSheetData(SHEET_USERS);
  if (!users) return jsonSuccess(false);
  for (var i = 1; i < users.length; i++) {
    if (String(users[i][0]).toLowerCase() === username) {
      return jsonSuccess(true);
    }
  }
  return jsonSuccess(false);
}

function generateToken(username) {
  return username + '_' + new Date().getTime() + '_' + Math.random().toString(36).slice(2);
}

function updateLastLogin(username) {
  var data = getSheetData(SHEET_USERS);
  if (!data || data.length < 2) return;
  var headers = data[0];
  var col = getColIndex(headers, 'last_login');
  if (col < 0) return;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  if (!sheet) return;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === username) {
      sheet.getRange(i + 1, col + 1).setValue(new Date().toISOString());
      break;
    }
  }
}

function validateToken(token, requiredRole) {
  if (!token) return false;
  var parts = token.split('_');
  if (parts.length < 1) return false;
  var username = parts[0];
  if (username === ADMIN_USERNAME) return true;
  var users = getSheetData(SHEET_USERS);
  if (!users) return false;
  for (var i = 1; i < users.length; i++) {
    if (String(users[i][0]).toLowerCase() === username) {
      if (requiredRole && requiredRole === 'admin') return false;
      return users[i][2] !== false && users[i][2] !== 'false';
    }
  }
  return false;
}

/**
 * ============================================================
 * SECTION 4: SUBMISSION HANDLERS
 * ============================================================
 */

function handleSubmit(e) {
  var token = e.parameter.token || '';
  if (!validateToken(token)) return jsonError('Token ma haboona');

  var cityCode = (e.parameter.city_code || '').trim().toUpperCase();
  if (!cityCode) return jsonError('City code waa loo baahan yahay');

  var sheet = getOrCreateCitySheet(cityCode);
  var headers = getOrCreateHeaders(sheet);

  var row = [];
  for (var h = 0; h < headers.length; h++) {
    var key = headers[h].replace(/[^a-zA-Z0-9_]/g, '_');
    var val = e.parameter[key] || e.parameter[headers[h]] || '';
    if (typeof val === 'object') val = JSON.stringify(val);
    row.push(val);
  }

  /* Add metadata columns */
  var metaCols = getMetaColumns(sheet);
  row[metaCols.engineer] = e.parameter.engineer || '';
  row[metaCols.city] = cityCode;
  row[metaCols.created] = new Date().toISOString();
  row[metaCols.status] = e.parameter._status || 'submitted';

  /* Generate submission ID */
  row[metaCols.id] = 'DHB-' + Date.now() + '-' + Math.random().toString(36).slice(2,6).toUpperCase();

  sheet.appendRow(row);

  return jsonSuccess({
    success: true,
    submission_id: row[metaCols.id],
    message: 'Gudbinta waa la diwaangeliyay'
  });
}

function handleGetSubmissions(e) {
  var token = e.parameter.token || '';
  if (!validateToken(token)) return jsonError('Unauthorized');

  var role = e.parameter.role || 'engineer';
  var cityCode = e.parameter.city_code || '';
  var engineer = e.parameter.engineer || '';

  var allSubs = [];
  var sheetNames = [];

  if (role === 'admin') {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    sheetNames = ss.getSheets().filter(function(s) {
      return s.getName().indexOf(SHEET_PREFIX) === 0;
    }).map(function(s) { return s.getName() });
  } else {
    var name = SHEET_PREFIX + cityCode;
    var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (s) sheetNames.push(name);
  }

  for (var si = 0; si < sheetNames.length; si++) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetNames[si]);
    if (!sheet) continue;
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) continue;
    var headers = data[0];
    for (var r = 1; r < data.length; r++) {
      var row = {};
      for (var c = 0; c < headers.length && c < data[r].length; c++) {
        row[headers[c]] = data[r][c];
      }
      row._city = sheetNames[si].replace(SHEET_PREFIX, '');
      row._sheet = sheetNames[si];

      if (role === 'engineer' && row._engineer !== engineer) continue;
      if (role !== 'admin' && cityCode && row._city !== cityCode) continue;

      allSubs.push(row);
    }
  }

  /* Apply filters */
  if (e.parameter.sub_district) {
    allSubs = allSubs.filter(function(r) {
      return String(r['Degmada (Sub-district)'] || r['sub_district'] || '') === e.parameter.sub_district;
    });
  }

  return jsonSuccess({ submissions: allSubs });
}

function handleGetSubmission(e) {
  var token = e.parameter.token || '';
  if (!validateToken(token)) return jsonError('Unauthorized');

  var id = e.parameter.id || '';
  if (!id) return jsonError('ID waa loo baahan yahay');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets().filter(function(s) {
    return s.getName().indexOf(SHEET_PREFIX) === 0;
  });

  for (var si = 0; si < sheets.length; si++) {
    var data = sheets[si].getDataRange().getValues();
    if (data.length < 2) continue;
    var headers = data[0];
    var idCol = getColIndex(headers, '_submission_id');
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][idCol]) === id) {
        var row = {};
        for (var c = 0; c < headers.length; c++) {
          row[headers[c]] = data[r][c];
        }
        return jsonSuccess({ submission: row });
      }
    }
  }

  return jsonError('Gudbin lama helin');
}

/**
 * ============================================================
 * SECTION 5: USER MANAGEMENT (ADMIN ONLY)
 * ============================================================
 */

function handleGetUsers(e) {
  if (!validateAdmin(e.parameter.token)) return jsonError('Unauthorized: admin only');
  var data = getSheetData(SHEET_USERS);
  if (!data || data.length < 2) return jsonSuccess({ users: [] });
  var headers = data[0];
  var users = [];
  for (var i = 1; i < data.length; i++) {
    var u = {};
    for (var c = 0; c < headers.length; c++) {
      u[headers[c]] = data[i][c];
    }
    u.user_id = i;
    users.push(u);
  }
  return jsonSuccess({ users: users });
}

function handleAddUser(e) {
  if (!validateAdmin(e.parameter.token)) return jsonError('Unauthorized: admin only');
  var sheet = getOrCreateSheet(SHEET_USERS);
  var headers = ['username','password','role','city_code','active','last_login'];
  ensureHeaders(sheet, headers);

  var row = [
    (e.parameter.username || '').trim().toLowerCase(),
    e.parameter.password || '',
    e.parameter.role || 'engineer',
    (e.parameter.city_code || '').trim().toUpperCase(),
    true,
    ''
  ];
  sheet.appendRow(row);
  return jsonSuccess({ success: true, message: 'Isticmaale waa la abuuray' });
}

function handleUpdateUser(e) {
  if (!validateAdmin(e.parameter.token)) return jsonError('Unauthorized: admin only');
  var userId = parseInt(e.parameter.user_id || '0');
  if (userId < 1) return jsonError('Invalid user ID');

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  if (!sheet) return jsonError('Sheet not found');

  var data = sheet.getDataRange().getValues();
  if (userId >= data.length) return jsonError('User not found');

  var headers = data[0];
  var row = userId; /* 1-indexed row */

  if (e.parameter.username) {
    var col = getColIndex(headers, 'username');
    if (col >= 0) sheet.getRange(row + 1, col + 1).setValue((e.parameter.username || '').trim().toLowerCase());
  }
  if (e.parameter.password) {
    var col = getColIndex(headers, 'password');
    if (col >= 0) sheet.getRange(row + 1, col + 1).setValue(e.parameter.password);
  }
  if (e.parameter.role) {
    var col = getColIndex(headers, 'role');
    if (col >= 0) sheet.getRange(row + 1, col + 1).setValue(e.parameter.role);
  }
  if (e.parameter.city_code) {
    var col = getColIndex(headers, 'city_code');
    if (col >= 0) sheet.getRange(row + 1, col + 1).setValue((e.parameter.city_code || '').trim().toUpperCase());
  }
  if (e.parameter.active !== undefined) {
    var col = getColIndex(headers, 'active');
    if (col >= 0) sheet.getRange(row + 1, col + 1).setValue(e.parameter.active === 'true' || e.parameter.active === true);
  }

  return jsonSuccess({ success: true, message: 'Isticmaale waa la cusboonaysiiyay' });
}

/**
 * ============================================================
 * SECTION 6: CITIES
 * ============================================================
 */

function handleGetCities(e) {
  var data = getSheetData(SHEET_CITIES);
  if (!data || data.length < 2) return jsonSuccess({ cities: [] });
  var headers = data[0];
  var cities = [];
  for (var i = 1; i < data.length; i++) {
    var c = {};
    for (var h = 0; h < headers.length; h++) {
      c[headers[h]] = data[i][h];
    }
    cities.push(c);
  }
  return jsonSuccess({ cities: cities });
}

/**
 * ============================================================
 * SECTION 7: EXPORT & KML
 * ============================================================
 */

function handleExportCSV(e) {
  if (!validateToken(e.parameter.token)) return jsonError('Unauthorized');

  var cityCode = e.parameter.city_code || '';
  var allData = [];
  var headers = [];

  if (cityCode === 'ALL') {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = ss.getSheets().filter(function(s) {
      return s.getName().indexOf(SHEET_PREFIX) === 0;
    });
    for (var si = 0; si < sheets.length; si++) {
      var d = sheets[si].getDataRange().getValues();
      if (d.length > 1) {
        if (headers.length === 0) headers = d[0];
        for (var r = 1; r < d.length; r++) allData.push(d[r]);
      }
    }
  } else {
    var name = SHEET_PREFIX + cityCode;
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (!sheet) return jsonError('Sheet not found');
    var d = sheet.getDataRange().getValues();
    if (d.length > 1) {
      headers = d[0];
      for (var r = 1; r < d.length; r++) allData.push(d[r]);
    }
  }

  if (allData.length === 0) return jsonSuccess({ csv: '' });

  var csv = headers.map(function(h) { return '"' + String(h).replace(/"/g,'""') + '"' }).join(',') + '\n';
  allData.forEach(function(row) {
    csv += headers.map(function(h, i) {
      var v = String(row[i] || '').replace(/"/g,'""');
      return '"' + v + '"';
    }).join(',') + '\n';
  });

  return jsonSuccess({ csv: csv });
}

function handleSaveKML(e) {
  var kmlContent = e.parameter.kml_content || '';
  if (!kmlContent) return jsonError('KML content waa loo baahan yahay');

  var ownerName = e.parameter.owner_name || 'Unknown';
  var safeName = ownerName.replace(/[^a-zA-Z0-9_-]/g, '_');
  var dateStr = e.parameter.survey_date || new Date().toISOString().slice(0,10);
  var filename = 'DHB_' + safeName + '_' + dateStr + '.kml';

  var folder = getOrCreateDriveFolder('DHB KML Files');
  var file = folder.createFile(filename, kmlContent, 'application/vnd.google-earth.kml+xml');
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  /* Write to KML tracking sheet */
  var kmlSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('KML_Data');
  var kmlHeaders = ['Owner Name','Phone','Sub-district','Section','Survey Date','Engineer','Area m²','Perimeter m','Points','KML Filename','KML Drive Link','Saved At'];
  if (!kmlSheet) {
    kmlSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('KML_Data');
    kmlSheet.appendRow(kmlHeaders);
  }
  kmlSheet.appendRow([
    e.parameter.owner_name || '', e.parameter.owner_phone || '', e.parameter.sub_district || '',
    e.parameter.section || '', e.parameter.survey_date || '', e.parameter.engineer || '',
    e.parameter.area || '', e.parameter.perimeter || '', e.parameter.num_points || '',
    filename, file.getUrl(), new Date().toISOString()
  ]);

  return jsonSuccess({
    success: true,
    url: file.getUrl(),
    filename: filename
  });
}

/**
 * ============================================================
 * SECTION 8: HELPER FUNCTIONS
 * ============================================================
 */

function getSheetData(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) return null;
  return sheet.getDataRange().getValues();
}

function getOrCreateSheet(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(name);
  return sheet;
}

function getOrCreateCitySheet(cityCode) {
  var name = SHEET_PREFIX + cityCode;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(name);
    var allHeaders = getDefaultHeaders();
    var metaHeaders = ['_submission_id', '_engineer', '_city', '_created_at', '_status'];
    sheet.appendRow(allHeaders.concat(metaHeaders));
  }
  return sheet;
}

function getDefaultHeaders() {
  return [
    'Gudbinta ID (Submission ID)',
    'Taariikhda (Date)',
    'Injineer (Engineer)',
    'Magaca Milkiilaha (Owner Name)',
    'Telefoonka (Phone)',
    'Magaca Hooyada (Mother Name)',
    'Jinsiga (Gender)',
    'Magaca Tixraaca (Reference Name)',
    'Tel Tixraaca (Reference Phone)',
    'Jinsiga Tixraaca (Ref Gender)',
    'Xiriirka (Relationship)',
    'Nooca Hantida (Property Type)',
    'Ballaca (Width)',
    'Dhererka (Length)',
    'Bedka m² (Area)',
    'Degmada (Sub-district)',
    'Xaafadda (Section)',
    'Magaca Waddada (Street)',
    'Calaamadda (Landmark)',
    'Waqooyi (North Neighbor)',
    'Waqooyi masaafo (North Distance)',
    'Koonfur (South Neighbor)',
    'Koonfur masaafo (South Distance)',
    'Bari (East Neighbor)',
    'Bari masaafo (East Distance)',
    'Galbeed (West Neighbor)',
    'Galbeed masaafo (West Distance)',
    'TIX/LR Number',
    'Taariikhda TIX (Issue Date)',
    'Hay\'adda TIX (Authority)',
    'Latitude',
    'Longitude',
    'Sawirka Milkiilaha (Owner Photo)',
    'Sawirka Dhulka (Property Photo)'
  ];
}

function getOrCreateHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    var h = getDefaultHeaders().concat(['_submission_id','_engineer','_city','_created_at','_status']);
    sheet.appendRow(h);
    return h;
  }
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function getMetaColumns(sheet) {
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  return {
    id: getColIndex(headers, '_submission_id') || headers.length - 5,
    engineer: getColIndex(headers, '_engineer') || headers.length - 4,
    city: getColIndex(headers, '_city') || headers.length - 3,
    created: getColIndex(headers, '_created_at') || headers.length - 2,
    status: getColIndex(headers, '_status') || headers.length - 1
  };
}

function ensureHeaders(sheet, expectedHeaders) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(expectedHeaders);
  }
}

function getColIndex(headers, name) {
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).toLowerCase() === name.toLowerCase()) return i;
  }
  return -1;
}

function getOrCreateDriveFolder(name) {
  var folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

function validateAdmin(token) {
  if (!token) return false;
  var parts = token.split('_');
  return parts[0] === ADMIN_USERNAME;
}

function jsonSuccess(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError(msg) {
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: msg
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * ============================================================
 * SECTION 9: SEED DATA (Run once to initialize)
 * ============================================================
 */

function seedInitialData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  /* Users */
  var userSheet = ss.getSheetByName(SHEET_USERS);
  if (!userSheet) {
    userSheet = ss.insertSheet(SHEET_USERS);
    userSheet.appendRow(['username','password','role','city_code','active','last_login']);
    userSheet.appendRow(['engineer1','eng123','engineer','BOS',true,'']);
    userSheet.appendRow(['supervisor1','sup123','supervisor','BOS',true,'']);
  }

  /* Cities */
  var citySheet = ss.getSheetByName(SHEET_CITIES);
  if (!citySheet) {
    citySheet = ss.insertSheet(SHEET_CITIES);
    citySheet.appendRow(['city_code','city_name','active']);
    citySheet.appendRow(['BOS','Bosaso',true]);
    citySheet.appendRow(['GAR','Garoowe',true]);
  }
}
