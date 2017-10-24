/**
 * Leaflet implementation for the Map FormType
 *
 * @date   05/10/2017
 * @author webber <webber.nl@gmail.com>
 * @author j63 <jwoudstr@gmail.com>
 */
var CuriousMap = function (options) {
  // Object variables
  this.formId = options.formId;
  this.mapId = this.formId + '_map';
  this.$modal = $(`#${this.formId}_modal`);
  this.$mapControl = L.control.layers();
  this.geoJsonLayerObjects = [];

  // Set defaults
  this.lat = options.defaults.latitude;
  this.lng = options.defaults.longitude;
  this.zoom = options.defaults.zoom;

  // Initialise
  this.initialise(options);
};

/*
 * Initialise CuriousMap
 */
CuriousMap.prototype.initialise = function (options) {
  // Initiate the Leaflet map
  this.$map = new L.Map(this.mapId);

  // Initialise CuriousMap FormType
  this.initialiseSearchFields();
  this.initialiseFormFields(options.fields);
  this.initialiseMapElements(options);
  this.initialiseTriggers();
  this.focus();
};

/**
 * Initialise search fields
 */
CuriousMap.prototype.initialiseSearchFields = function () {
  this.$snapCurrent = $(`#${this.formId}_location_snap`);
  this.$searchField = $(`#${this.formId}_location_search_input`);
  this.$searchBtn = $(`#${this.formId}_location_search_btn`);
};

/**
 * Link the form fields to this object
 */
CuriousMap.prototype.initialiseFormFields = function (fields) {
  var $this = this;

  $this.fields = {};
  $.each(fields, function (name, options) {
    if (options.name === undefined) {
      options.name = name;
    }

    options.$field = $(`#${$this.formId}_${options.name}`);
    $this.fields[name] = options;
  });

  if (this.fields.latitude) this.lat = this.fields.latitude.$field.val() || this.lat;
  if (this.fields.longitude) this.lng = this.fields.longitude.$field.val() || this.lng;
};

/*
 * Generate map elements
 */
CuriousMap.prototype.initialiseMapElements = function (options) {
  // Add Map Control to Map
  this.$mapControl.addTo(this.$map);

  // Set view
  this.$map.setView(new L.LatLng(this.lat, this.lng), this.zoom);

  // Set the initial marker
  this.initiateMarker();

  // Add all layers
  this.baseLayers = [];
  this.initialiseFallbackLayer(options.fallbackLayer);
  this.initialiseBaseLayers(options.baseLayers);
  this.initialiseOverlays(options.overlays);
};

/**
 * Initialise triggers
 */
CuriousMap.prototype.initialiseTriggers = function () {
  var $this = this;

  // SnapToLocation button trigger
  if (undefined !== this.$snapCurrent) {
    this.$snapCurrent.on('click', function () {
      $this.snapToLocation();
    });
  }

  // Clicking on the map canvas
  this.$map.on('click', function (e) {
    $this.updateLocation(e.latlng);
  });

  // Dropping the marker somewhere on the map
  this.$marker.on('dragend', function () {
    $this.updateLocation(this.getLatLng());
  });

  // Ending a map zoom action
  this.$map.on('zoomend', function() {
    $this.updateGeoJsonLayers();
  });

  // Enter in searchField
  this.$searchField.on('keydown', function (e) {
    if (e.keyCode === 13) {
      e.preventDefault();
      $this.searchAddress($(this).val());
    }
  });

  // Search button pressed
  this.$searchBtn.on('click', function () {
    $this.searchAddress($this.$searchField.val());
  });
};

/**
 * Update the marker and map location
 */
CuriousMap.prototype.updateLocation = function (position) {
  // Set latitude and longitude from given position
  this.lat = position.lat;
  this.lng = position.lng;

  // Update all linked elements according to newly set coordinates
  this.$marker.setLatLng(position, { draggable: 'true' });
  this.$map.panTo(position);
  this.updateFormFields(position);
  this.updateGeoJsonLayers();
};

/**
 * Perform a reverse lookup for the provided position
 * in order to retrieve address information and update
 * the related form fields.
 */
CuriousMap.prototype.updateFormFields = function (position) {
  var $this = this;

  this.clearFormFields();

  // Update latitude and longitude with map coordinates
  $this.fields.latitude.$field.val(position.lat);
  $this.fields.longitude.$field.val(position.lng);

  // Perform reverse address lookup
  $.getJSON('https://nominatim.openstreetmap.org/reverse?lat=' + position.lat + '&lon=' + position.lng + '&zoom=18&addressdetails=1&limit=1&format=json', function (data) {

    // Process address information
    if (data) {
      if (data.address) {
        var houseNumber = data.address.house_number || '';
        var street = data.address.footway || data.address.road || '';
        var postCode = data.address.postcode || '';
        var city = data.address.city || data.address.suburb || '';
        var district = data.address.city ? data.address.suburb || '' : data.address.district || '';
        var neighbourhood = data.address.neighbourhood || data.address.residential || data.address.industrial || '';
        var state = data.address.province || data.address.state || '';
        var country = data.address.country || '';

        // Populate input fields if configured
        if ($this.fields.address) $this.fields.address.$field.val($this.parseAddress(city, street, houseNumber));
        if ($this.fields.street) $this.fields.street.$field.val(street);
        if ($this.fields.postal_code) $this.fields.postal_code.$field.val(postCode);
        if ($this.fields.city) $this.fields.city.$field.val(city);
        if ($this.fields.city_district) $this.fields.city_district.$field.val(district);
        if ($this.fields.city_neighbourhood) $this.fields.city_neighbourhood.$field.val(neighbourhood);
        if ($this.fields.state) $this.fields.state.$field.val(state);
        if ($this.fields.country) $this.fields.country.$field.val(country);
      }
    }
  });
};

/**
 * Update GeoJson-Layers with new data, according to the map's current boundaries
 */
CuriousMap.prototype.updateGeoJsonLayers = function () {
  var bbox = this.$map.getBounds().toBBoxString();
  var currentZoomLevel = this.$map.getZoom();

  // function to generate url to fetch GeoJson objects
  var generateUrl = function(settings) {
    var parameters = Object.assign(
      {bbox: bbox},
      settings.parameters
    );

    return settings.url + L.Util.getParamString(parameters);
  };

  // Show or hide layer based on min and max zoom level settings per layer
  $.each(this.geoJsonLayerObjects, function(index, geoJsonLayerObject) {
    if (currentZoomLevel >= geoJsonLayerObject.settings.minZoom &&
      currentZoomLevel <= geoJsonLayerObject.settings.maxZoom) {
      geoJsonLayerObject.layer.setStyle(
        {
          opacity: 1,
          fillOpacity: 0.8
        });

      // Update the layer within the object with new GeoJson data, if any
      var url = generateUrl(geoJsonLayerObject.settings);
      if (url) {
        $.ajax({
          jsonp: true,
          url: url,
          dataType: 'json',
          jsonpCallback: 'getJson',
          success: function(data) {
            geoJsonLayerObject.layer.addData(data);
          }
        });
      }
    } else {
      geoJsonLayerObject.layer.setStyle(
        {
          opacity: 0,
          fillOpacity: 0
        });
    }
  });
};

/**
 * Update mapControl, only display when any layers are listed
 */
CuriousMap.prototype.updateMapControl = function () {
  if (this.$mapControl._layers.length >= 1) {
    // Add the control to the map
    this.$mapControl.addTo(this.$map);
  } else {
    // Remove the control from the map
    this.$mapControl.remove();
  }
};

/**
 * Clear all associated form fields
 */
CuriousMap.prototype.clearFormFields = function () {
  var $this = this;

  $.each($this.fields, function (name, field) {
    field.$field.val('');
  });
};

/**
 * Remove all baseLayers, except layers that are marked as fallback layers
 */
CuriousMap.prototype.clearBaseLayers = function () {
  var $this = this;

  $.each(this.baseLayers, function (index, baseLayer) {
    $this.$map.removeLayer(baseLayer);
  });
};

/**
 * Add baseLayer according to given definition
 */
CuriousMap.prototype.addBaseLayer = function (layerDefinition) {
  var layer;

  if (layerDefinition.url === undefined) {
    // Do not process layer without url
  } else if (layerDefinition.type === 'TileLayer') {
    layer = this.createTileLayer(layerDefinition);
  } else if (layerDefinition.type === 'WmsLayer') {
    layer = this.createWmsLayer(layerDefinition);
  } else {
    // Do not process unknown layerType
  }

  // Add layer to the map, if any
  if (layer !== undefined) {
    // Remove current baseLayers
    this.clearBaseLayers();
    // Add layer to the map
    this.addLayerToMap(layer);

    // Unless it is a fallback layer
    if (!layerDefinition.fallback) {
      // Add baseLayer to currently loaded baseLayers
      this.baseLayers.push(layer);
      // Add baseLayer to control
      this.addBaseLayerToControl(layer, layerDefinition.name);
    }
  }

  // Return the layer if any
  return layer;
};

CuriousMap.prototype.addOverlay = function (layerDefinition) {
  var layer;
  var layerGroup;

  if (layerDefinition.url === undefined) {
    // Do not process layer without url
  } else if (layerDefinition.type === 'GeoJson' && layerDefinition.parameters !== undefined) {
    layer = this.createGeoJsonLayer(layerDefinition);
  } else if (layerDefinition.type === 'TileLayer') {
    layer = this.createTileLayer(layerDefinition);
  } else if (layerDefinition.type === 'WmsLayer') {
    layer = this.createWmsLayer(layerDefinition);
  } else {
    // Do not process unknown layerType
  }

  // Add layer to the map, if any
  if (layer !== undefined) {
    // Enable snapping to this layer's features, if snapping was set to true in its definition
    if (layerDefinition.snapping) {
      this.enableSnappingForLayer(layer);
    }

    // Put layer in a group, even if it is the only one of its kind
    layerGroup = this.addLayerToGroup(layer, layerDefinition);

    // Add that group to the map and mapControl (if one of its layers is enabled)
    if (layerGroup.enabled) {
      this.addLayerToMap(layerGroup);
    }

    // Always add the group to mapControl
    this.addOverlayToControl(layerGroup, layerDefinition.name);
  }

  return layer;
};

/**
 * Add a layer to a group, depending on its name
 *
 * Note: This works for any layer but only makes sense for overlay layers
 */
CuriousMap.prototype.addLayerToGroup = function (layer, layerDefinition) {
  var groupName = layerDefinition.name;
  var enabled = layerDefinition.enabled || false;

  // Do not continue without a name for the group or the layer itself
  if (groupName === undefined && layer === undefined) {
    return undefined;
  }

  // Add layer to group according to its name
  if (Object.prototype.hasOwnProperty.call(this.overlayGroups, groupName)) {
    this.overlayGroups[groupName].addLayer(layer);
  } else {
    this.overlayGroups[groupName] = new L.LayerGroup([layer]);
  }

  // Enable layerGroup if one of its layers is configured to be enabled
  if (!Object.prototype.hasOwnProperty.call(this.overlayGroups[groupName], 'enabled')) {
    this.overlayGroups[groupName].enabled = enabled;
  } else {
    this.overlayGroups[groupName].enabled = this.overlayGroups[groupName].enabled || enabled;
  }

  // Return the (re)created group
  return this.overlayGroups[groupName];
};

/**
 * Add the layer or layerGroup to the map, after removing it
 */
CuriousMap.prototype.addLayerToMap = function (layer) {
  // in case of a group, remove the old one
  this.$map.removeLayer(layer);
  // Add the new layer or group
  layer.addTo(this.$map);
};

/**
 * Add a layer to a group in the map control
 */
CuriousMap.prototype.addBaseLayerToControl = function (layer, labelName) {
  var baseLayerLabel = '<span class="base-layer-label">%s</span>';

  // Do not modify map control without labelName or layer to add.
  if (labelName === undefined || layer === undefined) {
    return;
  }

  // Update map control: Remove the modified group and then re-add
  this.$mapControl.removeLayer(layer);
  this.$mapControl.addBaseLayer(layer, baseLayerLabel.replace('%s', labelName));
};

/**
 * Add overlay layer or overlay layerGroup to $mapControl
 */
CuriousMap.prototype.addOverlayToControl = function (layer, label) {
  var overlayLabel = '<span class="overlay-label">%s</span>';

  // Do not modify map control without labelName or layer to add.
  if (label === undefined || layer === undefined) {
    return;
  }

  // Add the layer in its group, after removing the old group if it exists
  this.$mapControl.removeLayer(layer);
  this.$mapControl.addOverlay(layer, overlayLabel.replace('%s', label));
};

/**
 * Create and return a Tile-Layer
 */
CuriousMap.prototype.createTileLayer = function (settings) {
  return new L.TileLayer(
    settings.url,
    {
      minZoom: settings.minZoom || 1,
      maxZoom: settings.maxZoom || 20,
      attribution: settings.attribution || '',
      subdomains: settings.subdomains || 'abc'
    }
  );
};

/**
 * Create and return a WMS-Layer
 */
CuriousMap.prototype.createWmsLayer = function (settings) {
  return L.WMS.overlay(
    settings.url,
    {
      layers: settings.layers.join(),
      format: settings.format || 'image/png',
      transparent: settings.transparent || true
    }
  );
};

/**
 * Create and return a GeoJsonLayer, and register it for updating on location change
 */
CuriousMap.prototype.createGeoJsonLayer = function (settings) {
  var $this = this;

  // Set style for circleMarkers if it has not been set
  this.geoJsonMarkerStyle = this.geoJsonMarkerStyle || {
    radius: 3,
    fillColor: '#ff7800',
    color: '#000',
    weight: 0.5,
    opacity: 1,
    fillOpacity: 0.8
  };

  // Create an empty geoJson layer
  var layer = L.geoJson(null, {
    pointToLayer: function (feature, location) {
      return L
        .circleMarker(location, $this.geoJsonMarkerStyle)
        .on('click', function () {
          // Update location of the main pointer to the center of this feature
          $this.updateLocation(this._latlng);
        });
    }
  });

  // Add this layer and its metadata to the geoJsonLayerObjects list
  this.geoJsonLayerObjects.push({
    layer: layer,
    settings: settings
  });

  // Return the geoJsonLayer
  return layer;
};

/**
 * Initialise the baseLayers, according to given layerDefinitions
 */
CuriousMap.prototype.initialiseBaseLayers = function (layerDefinitions) {
  var $this = this;

  // Go through each layerDefinition
  $.each(layerDefinitions, function (index, layerDefinition) {
    if (layerDefinition.url === undefined || layerDefinition.type === undefined) {
      // Warn the user when a base layer cannot be initialised
      $(document).ready(function () {
        $this.$modal
          .modal()
          .attr('class', 'modal fade')
          .addClass('default')
          .find('.alert_no_base_layer')
          .show();
      });
    } else {
      // Add the layer according to its definition
      $this.addBaseLayer(layerDefinition);
    }
  });

  this.updateMapControl();
};

/**
 * Initialise Overlays, according to given layerDefinitions
 */
CuriousMap.prototype.initialiseOverlays = function (layerDefinitions) {
  var $this = this;

  this.overlayGroups = {};

  $.each(layerDefinitions, function (index, layerDefinition) {
    if (layerDefinition.url && layerDefinition.type) {
      $this.addOverlay(layerDefinition);
    }
  });

  this.updateMapControl();
};

/**
 * Add layer under every other layer as a fallback
 *
 * This method is executed before adding baseLayers and will
 * add the fallback property, so it doesn't get listed in the mapControl
 */
CuriousMap.prototype.initialiseFallbackLayer = function (layerDefinition) {
  var fallbackDefinition = layerDefinition;

  // Do not produce a fallback layer if definition is empty or incomplete
  if (fallbackDefinition.url === undefined || fallbackDefinition.type === undefined) {
    return;
  }

  fallbackDefinition.fallback = true;

  this.addBaseLayer(fallbackDefinition);
};

/**
 * Add a MapControl to the map (uses this.$mapControl by default)
 */
CuriousMap.prototype.addMapControl = function (control) {
  var mapControl = control || this.$mapControl;

  this.$mapControl = mapControl
    .layers()
    .addTo(this.$map);
};

/**
 * Update the marker according to current latitude and longitude
 */
CuriousMap.prototype.initiateMarker = function () {
  this.$marker = L.marker([this.lat, this.lng], { draggable: 'true' }).addTo(this.$map);
  this.$marker.snapediting = new L.Handler.MarkerSnap(this.$map, this.$marker);
};

/**
 * Enable snapping for given layer
 */
CuriousMap.prototype.enableSnappingForLayer = function (layer) {
  this.$marker.snapediting.addGuideLayer(layer);
  this.$marker.snapediting.enable();
};

/**
 * Search for an address
 */
CuriousMap.prototype.searchAddress = function (address) {
  var $this = this;

  var position;

  $.getJSON('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + address, function (data) {
    if (data.length) {
      position = new L.LatLng(data[0].lat, data[0].lon);
      $this.updateLocation(position);
      $this.$map.setZoom($this.determineZoomLevel(data[0].type));
    }
  });
};

/**
 * Determine appropriate zoom-level based on information level-type (e.g. 'city') of a JSON response
 */
CuriousMap.prototype.determineZoomLevel = function (type) {
  var level;
  if (type === 'house' || type === 'residential') {
    level = 18;
  } else if (type === 'neighbourhood') {
    level = 16;
  } else if (type === 'city') {
    level = 13;
  } else if (type === 'administrative') {
    level = 11;
  } else {
    level = 8;
  }
  return level;
};

/**
 * Focus CuriousMap by focusing the searchField, if it is defined
 */
CuriousMap.prototype.focus = function () {
  if (this.$searchField) this.$searchField.focus();
};

/**
 * Snap to current location (HTTPS/Local only)
 */
CuriousMap.prototype.snapToLocation = function () {
  if (
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    // Locate device's location on the map
    this.$map.locate({
      watch: true,
      enableHighAccuracy: true
    });
  } else {
    // Show a warning that this functionality does not work over http, unless origin is localhost
    this.$modal
      .modal()
      .attr('class', 'modal fade')
      .addClass('security')
      .find('.alert_no_secure_connection')
      .show();
  }
};

/**
 * Format the address
 * We want either the city,
 * or street (houseNumber if available), city
 */
CuriousMap.prototype.parseAddress = function (city, street, houseNumber) {
  if (street.length && city.length) {
    city = ', ' + city;
  }

  if (street.length && houseNumber.length) {
    houseNumber = ' ' + houseNumber;
  } else if (!street.length && houseNumber.length) {
    houseNumber = '';
  }

  return street + houseNumber + city;
};
