/* ============================================================
   DHB Field Registration System — Map & Digitizer Functions
   ============================================================ */

var DIGITIZER = DIGITIZER || {};

DIGITIZER.points = [];
DIGITIZER.markers = [];
DIGITIZER.distLabels = [];
DIGITIZER.polyline = null;
DIGITIZER.polygon = null;
DIGITIZER.gpsMarker = null;
DIGITIZER.gpsAccuracyCircle = null;
DIGITIZER.gpsWatchId = null;
DIGITIZER.isLocating = false;
DIGITIZER.map = null;

/* ---- Geometry ---- */
function toRad(d){ return d * Math.PI / 180 }

function haversineDist(p1, p2){
  var dlat = toRad(p2.lat - p1.lat);
  var dlng = toRad(p2.lng - p1.lng);
  var a = Math.sin(dlat/2)*Math.sin(dlat/2) + Math.cos(toRad(p1.lat))*Math.cos(toRad(p2.lat))*Math.sin(dlng/2)*Math.sin(dlng/2);
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function sphericalArea(latlngs){
  if(latlngs.length < 3) return 0;
  var R = 6371000, area = 0, n = latlngs.length;
  for(var i=0; i<n; i++){
    var j = (i+1)%n, k = (i+2)%n;
    area += toRad(latlngs[k].lng - latlngs[i].lng) * Math.sin(toRad(latlngs[j].lat));
  }
  return Math.abs(area * R * R / 2);
}

function sphericalPerimeter(latlngs){
  if(latlngs.length < 2) return 0;
  var perim = 0, n = latlngs.length;
  for(var i=0; i<n; i++){
    var j = (i+1)%n;
    if(n < 3 && j === 0) break;
    perim += haversineDist(latlngs[i], latlngs[j]);
  }
  return perim;
}

function polygonCentroid(arr){
  if(!arr || arr.length === 0) return null;
  var lat=0, lng=0;
  for(var i=0;i<arr.length;i++){ lat+=arr[i].lat; lng+=arr[i].lng }
  return {lat: lat/arr.length, lng: lng/arr.length};
}

/* ---- Marker Factory ---- */
DIGITIZER.createMarker = function(lat, lng, idx){
  var marker = L.marker([lat, lng], {
    draggable: true,
    icon: L.divIcon({
      className: 'pt-marker',
      html: '<div style="background:#00c896;color:#0a1628;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5);cursor:grab">' + (idx+1) + '</div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })
  });

  marker.on('drag', function(){
    var p = marker.getLatLng();
    DIGITIZER.points[idx].lat = p.lat;
    DIGITIZER.points[idx].lng = p.lng;
    DIGITIZER.render();
  });

  marker.on('click', function(){
    var content =
      '<div style="color:#fff;font-size:13px">Dhibcood #' + (idx+1) + '</div>' +
      '<button class="popup-del-btn" onclick="DIGITIZER.deletePoint(' + idx + ')">\u2715 Tirtir</button>';
    marker.bindPopup(content, {closeButton: true, className: 'point-popup'}).openPopup();
  });

  return marker;
};

DIGITIZER.deletePoint = function(idx){
  if(DIGITIZER.map) DIGITIZER.map.closePopup();
  if(idx < 0 || idx >= DIGITIZER.points.length) return;
  DIGITIZER.points.splice(idx, 1);
  var m = DIGITIZER.markers.splice(idx, 1)[0];
  if(m && DIGITIZER.map) DIGITIZER.map.removeLayer(m);
  DIGITIZER.rebuildMarkers();
  DIGITIZER.render();
};

DIGITIZER.rebuildMarkers = function(){
  if(!DIGITIZER.map) return;
  for(var i=0; i<DIGITIZER.markers.length; i++) DIGITIZER.map.removeLayer(DIGITIZER.markers[i]);
  DIGITIZER.markers = [];
  for(var i=0; i<DIGITIZER.points.length; i++){
    var p = DIGITIZER.points[i];
    var m = DIGITIZER.createMarker(p.lat, p.lng, i);
    m.addTo(DIGITIZER.map);
    DIGITIZER.markers.push(m);
  }
};

DIGITIZER.addPoint = function(lat, lng){
  if(!DIGITIZER.map) return;
  var idx = DIGITIZER.points.length;
  DIGITIZER.points.push({lat: lat, lng: lng});
  var m = DIGITIZER.createMarker(lat, lng, idx);
  m.addTo(DIGITIZER.map);
  DIGITIZER.markers.push(m);
  DIGITIZER.render();
  APP.toast('Dhibcood #' + (idx+1) + ' waa la daray', 'success');
};

DIGITIZER.undoPoint = function(){
  if(DIGITIZER.points.length === 0) return;
  DIGITIZER.points.pop();
  var m = DIGITIZER.markers.pop();
  if(m && DIGITIZER.map) DIGITIZER.map.removeLayer(m);
  DIGITIZER.render();
  APP.toast('Dhibcii waxaa laga noqday', 'info');
};

DIGITIZER.clearAll = function(){
  if(!DIGITIZER.map) return;
  for(var i=0; i<DIGITIZER.markers.length; i++) DIGITIZER.map.removeLayer(DIGITIZER.markers[i]);
  DIGITIZER.markers = [];
  DIGITIZER.points = [];
  DIGITIZER.clearDistLabels();
  if(DIGITIZER.polyline){ DIGITIZER.map.removeLayer(DIGITIZER.polyline); DIGITIZER.polyline = null }
  if(DIGITIZER.polygon){ DIGITIZER.map.removeLayer(DIGITIZER.polygon); DIGITIZER.polygon = null }
  DIGITIZER.render();
  APP.toast('Dhibcaha waa la nadiifiyay', 'info');
};

/* ---- Render ---- */
DIGITIZER.clearDistLabels = function(){
  if(!DIGITIZER.map) return;
  for(var i=0; i<DIGITIZER.distLabels.length; i++) DIGITIZER.map.removeLayer(DIGITIZER.distLabels[i]);
  DIGITIZER.distLabels = [];
};

DIGITIZER.render = function(){
  if(!DIGITIZER.map) return;
  DIGITIZER.clearDistLabels();
  if(DIGITIZER.polyline){ DIGITIZER.map.removeLayer(DIGITIZER.polyline); DIGITIZER.polyline = null }
  if(DIGITIZER.polygon){ DIGITIZER.map.removeLayer(DIGITIZER.polygon); DIGITIZER.polygon = null }

  var latlngs = DIGITIZER.points.map(function(p){ return [p.lat, p.lng] });

  if(latlngs.length >= 2){
    DIGITIZER.polyline = L.polyline(latlngs, {
      color: '#00c896', weight: 3, opacity: 0.9
    }).addTo(DIGITIZER.map);

    if(latlngs.length >= 3){
      var closed = latlngs.concat([latlngs[0]]);
      DIGITIZER.polyline.setLatLngs(closed);
      DIGITIZER.polygon = L.polygon(latlngs, {
        color: '#00c896', weight: 2, fillColor: '#00c896', fillOpacity: 0.15
      }).addTo(DIGITIZER.map);
      DIGITIZER.renderDistLabels(latlngs);
    }
  }

  DIGITIZER.updateStats();
};

DIGITIZER.renderDistLabels = function(latlngs){
  if(!DIGITIZER.map) return;
  var n = latlngs.length;
  for(var i=0; i<n; i++){
    var j = (i+1) % n;
    var p1 = {lat: latlngs[i][0], lng: latlngs[i][1]};
    var p2 = {lat: latlngs[j][0], lng: latlngs[j][1]};
    var dist = haversineDist(p1, p2);
    var midLat = (p1.lat + p2.lat) / 2;
    var midLng = (p1.lng + p2.lng) / 2;
    var label = dist < 1000 ? dist.toFixed(1) + ' m' : (dist/1000).toFixed(2) + ' km';
    var lbl = L.marker([midLat, midLng], {
      icon: L.divIcon({
        className: 'dist-label',
        html: label,
        iconSize: [null, null],
        iconAnchor: [0, 0]
      }),
      interactive: false
    }).addTo(DIGITIZER.map);
    DIGITIZER.distLabels.push(lbl);
  }
};

DIGITIZER.updateStats = function(){
  var elArea = document.getElementById('stat-area');
  var elPerim = document.getElementById('stat-perim');
  var elPts = document.getElementById('stat-points');
  var elPtCount = document.getElementById('pt-count');

  if(elPts) elPts.textContent = DIGITIZER.points.length;
  if(elPtCount) elPtCount.textContent = DIGITIZER.points.length + ' dhibcood';
  if(elArea || elPerim){
    var latlngs = DIGITIZER.points.map(function(p){ return L.latLng(p.lat, p.lng) });
    if(elArea) elArea.textContent = sphericalArea(latlngs).toFixed(1) + ' m\u00b2';
    if(elPerim) elPerim.textContent = (DIGITIZER.points.length >= 2 ? sphericalPerimeter(latlngs) : 0).toFixed(1) + ' m';
  }
  var undoBtn = document.getElementById('btn-undo');
  if(undoBtn) undoBtn.disabled = DIGITIZER.points.length === 0;
};

/* ---- GPS ---- */
DIGITIZER.startGPS = function(){
  if(!navigator.geolocation){
    APP.toast('GPS kama shaqeeyo qalabkan', 'error');
    return;
  }
  DIGITIZER.isLocating = true;
  var btn = document.getElementById('btn-gps');
  var status = document.getElementById('gps-status');
  if(btn) btn.innerHTML = '<span class="icon">\u23f9</span> Jooji';
  if(status) status.textContent = 'GPS: \u231b';

  DIGITIZER.gpsWatchId = navigator.geolocation.watchPosition(
    function(pos){
      var lat = pos.coords.latitude, lng = pos.coords.longitude, acc = pos.coords.accuracy;
      if(status) status.textContent = 'GPS: \u2713';
      var accEl = document.getElementById('stat-gps-acc');
      if(accEl) accEl.textContent = 'GPS: ' + (acc < 1 ? '<1' : Math.round(acc)) + 'm';

      if(!DIGITIZER.gpsMarker && DIGITIZER.map){
        DIGITIZER.gpsMarker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'gps-marker',
            html: '<div class="gps-dot"></div>',
            iconSize: [12, 12],
            iconAnchor: [6, 6]
          })
        }).addTo(DIGITIZER.map);
      } else if(DIGITIZER.gpsMarker){
        DIGITIZER.gpsMarker.setLatLng([lat, lng]);
      }

      if(DIGITIZER.gpsAccuracyCircle && DIGITIZER.map) DIGITIZER.map.removeLayer(DIGITIZER.gpsAccuracyCircle);
      if(DIGITIZER.map){
        DIGITIZER.gpsAccuracyCircle = L.circle([lat, lng], {
          radius: acc || 50, color: '#4488ff',
          fillColor: 'rgba(68,136,255,.15)', fillOpacity: 0.3, weight: 1
        }).addTo(DIGITIZER.map);
        DIGITIZER.map.setView([lat, lng], DIGITIZER.map.getZoom());
      }
    },
    function(err){
      APP.toast('GPS khalad: ' + err.message, 'error');
      if(status) status.textContent = 'GPS: \u2717';
    },
    {enableHighAccuracy: true, timeout: 15000, maximumAge: 5000}
  );
};

DIGITIZER.stopGPS = function(){
  DIGITIZER.isLocating = false;
  if(DIGITIZER.gpsWatchId !== null){
    navigator.geolocation.clearWatch(DIGITIZER.gpsWatchId);
    DIGITIZER.gpsWatchId = null;
  }
  if(DIGITIZER.gpsMarker && DIGITIZER.map){ DIGITIZER.map.removeLayer(DIGITIZER.gpsMarker); DIGITIZER.gpsMarker = null }
  if(DIGITIZER.gpsAccuracyCircle && DIGITIZER.map){ DIGITIZER.map.removeLayer(DIGITIZER.gpsAccuracyCircle); DIGITIZER.gpsAccuracyCircle = null }
  var btn = document.getElementById('btn-gps');
  var status = document.getElementById('gps-status');
  if(btn) btn.innerHTML = '<span class="icon">\ud83d\udce1</span> Goobta';
  if(status) status.textContent = 'GPS: \u2717';
};

/* ---- KML Build ---- */
DIGITIZER.buildKML = function(){
  if(DIGITIZER.points.length < 3) return null;
  var centroid = polygonCentroid(DIGITIZER.points);
  var latlngs = DIGITIZER.points.map(function(p){ return L.latLng(p.lat, p.lng) });
  var area = sphericalArea(latlngs);
  var perim = sphericalPerimeter(latlngs);
  var owner = APP.getUrlParam('owner_name') || 'Unknown';
  var coords = '';
  for(var i=0; i<DIGITIZER.points.length; i++){
    coords += '          ' + DIGITIZER.points[i].lng + ',' + DIGITIZER.points[i].lat + ',0\n';
  }
  return {
    kml: '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n<name>DHB - ' + APP.esc(owner) + '</name>\n<Style id="polyStyle"><LineStyle><color>ff00c896</color><width>3</width></LineStyle><PolyStyle><color>4c00c896</color></PolyStyle></Style>\n<Placemark><name>Xuddunta Dhulka</name><Point><coordinates>' + centroid.lng + ',' + centroid.lat + ',0</coordinates></Point></Placemark>\n<Placemark><name>Xuduudaha Dhulka</name><styleUrl>#polyStyle</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>\n' + coords + '</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>\n</Document>\n</kml>',
    area: area,
    perimeter: perim,
    centroid: centroid
  };
};

/* ---- Init ---- */
DIGITIZER.init = function(mapId, opts){
  opts = opts || {};
  DIGITIZER.map = L.map(mapId, {
    center: opts.center || [11.2842, 49.1816],
    zoom: opts.zoom || 17,
    maxZoom: 21,
    minZoom: 5,
    zoomControl: true
  });

  L.control.zoom({position:'bottomright'}).addTo(DIGITIZER.map);

  var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 21,
    attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
  });

  var sat = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 21, attribution: 'Google'
  });

  (opts.defaultLayer === 'sat' ? sat : osm).addTo(DIGITIZER.map);

  L.control.layers({
    "Khariidadda Waddooyinka": osm,
    "Khariidadda Dayax-gacmeedka": sat
  }, null, {position:'topleft'}).addTo(DIGITIZER.map);

  DIGITIZER.map.on('click', function(e){
    DIGITIZER.addPoint(e.latlng.lat, e.latlng.lng);
  });

  DIGITIZER.map.whenReady(function(){
    var ls = document.getElementById('loading-screen');
    if(ls) ls.classList.add('hidden');
  });
  setTimeout(function(){
    var ls = document.getElementById('loading-screen');
    if(ls) ls.classList.add('hidden');
  }, 3000);

  return DIGITIZER.map;
};
