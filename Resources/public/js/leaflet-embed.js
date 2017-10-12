/**
 * Leaflet implementation for the Map FormType
 *
 * @date   05/10/2017
 * @author webber <webber.nl@gmail.com>
 * @author j63 <jwoudstr@gmail.com>
 */

var CuriousMap = function(options) {

  var $this = this;

  this.formId = options.formId;

  this.lat = options.latitude;
  this.long = options.longitude;
  this.zoom = options.zoom;
  this.mapId = options.mapId;
  this.latId = '#' + options.latId;
  this.longId = '#' + options.longId;
  this.currentLocationId = '#' + options.currentLocationId;

  // set up the map
  this.map = new L.Map(this.mapId);

  // SnapToLocation button trigger
  if (undefined !== options.snapButtonId) {
    $(document).on('click', `#${options.snapButtonId}`, function() {
      $this.onSnapToLocationPressed();
    });
  }

  // create the tile layer with correct attribution
  var osmUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  var osmAttrib = 'Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
  var osm = new L.TileLayer(osmUrl, {minZoom: 8, maxZoom: 22, attribution: osmAttrib});

  // start the map in a given location
  this.map.setView(new L.LatLng(this.lat, this.long), this.zoom);
  this.map.addLayer(osm);

  // Add marker
  this.marker = this.addMarker();

  // Set form fields
  this.setMarkerFormFields();

  L.Control.geocoder({defaultMarkGeocode: false}).on('markgeocode', function(e) {
    var position = e.geocode.center;
    $this.updateMap(position);
    $this.setMarkerFormFields();
  }).addTo($this.map);

  this.marker.on('dragend', function(){
    var position = $this.marker.getLatLng();
    $this.updatePosition(position);
    $this.marker.setLatLng(new L.LatLng(position.lat, position.lng), {draggable:'true'});
    $this.map.panTo(new L.LatLng(position.lat, position.lng));
    $this.setMarkerFormFields();
  });

  $(this.currentLocationId).click(function() {
    $this.map.on('locationfound', function(e){
      var position = e.latlng;
      $this.updatePosition(position);
      $this.updateMap(position);
      $this.setMarkerFormFields();
    });
    $this.map.locate({setView: false});
  });
};

CuriousMap.prototype.addMarker = function() {
  return L.marker([this.lat, this.long], {draggable:'true'}).addTo(this.map);
};

CuriousMap.prototype.updatePosition = function(position) {
  this.lat = position.lat;
  this.long = position.lng;
};

CuriousMap.prototype.updateMap = function(position) {
  this.marker.setLatLng(position, {draggable: 'true'});
  this.map.flyTo(position, 17, {duration: 0.7});
};

CuriousMap.prototype.setMarkerFormFields = function() {
  $(this.latId).val(this.marker.getLatLng().lat);
  $(this.longId).val(this.marker.getLatLng().lng);
};

/**
 * EventHandler for when the SnapToCurrentLocation button is pressed
 */
CuriousMap.prototype.onSnapToLocationPressed = function() {
  var bootstrapJsIsLoaded = (typeof $().modal === 'function')

  if (window.location.protocol === 'https:') {
    // Locate device's location on the map
    this.map.locate({
      watch: true,
      enableHighAccuracy: true,
    });
  } else if (bootstrapJsIsLoaded) {
    // Show a warning that this functionality does not work over http
    var $modal = $(`#${this.formId}_modal`)
      .modal()
      .addClass('security')
      .find('.alert_no_secure_connection')
      .show();
  } else {
    // Fallback for when bootstrap is not loaded
    alert('For security reasons, location will not be retreived over an insecure connection');
  }
};
