/* Copyright (c) 2014 by Sahana Software Foundation.
 * Published under the MIT license.
 * See LICENSE in the Sahana Eden distribution or repository for the
 * full text of the license. */

/**
 * @requires OpenLayers/Strategy/BBOX.js
 */

/**
 * Class: OpenLayers.Strategy.ZoomBBOX
 * A strategy that reads new features when the viewport invalidates
 *     some bounds (BBOX) and also re-requests features for different
 *     zoom levels.
 *
 * Inherits from:
 *  - <OpenLayers.Strategy.BBOX>
 */
OpenLayers.Strategy.ZoomBBOX = OpenLayers.Class(OpenLayers.Strategy.BBOX, {
    
    /**
     * Property: zoom
     * {Integer} Last zoom
     */
    zoom: null,

    /**
     * Property: center
     * {Integer} Last center
     */
    center: null,

    /**
     * Property: level
     * {Integer} Last level; detect level changes
     */
    level: null,

    /**
     * Property: pixels
     * {Float} Last Area in pixels^2
     */
    pixels: null,

    /**
     * Property: levels
     * {Array} Default Mapping of Zoom levels to Location Hierarchy levels
     *
     * @ToDo: This needs to vary by center point as different countries vary a lot here
     *        - have a default lookup list and then allow specification of Polygons (e.g. BBOXes) for exception cases
     */
    levels: {0: 0,
             1: 0,
             2: 0,
             3: 0,
             4: 1,
             5: 1,
             6: 1,
             7: 2,
             8: 2,
             9: 3,
             10: 3,
             11: 3,
             12: 3,
             13: 4,
             14: 4,
             15: 5,
             16: 5,
             // @ToDo: Individual Features (Clustered if-necessary)
             17: 5,
             18: 5
             },

    /**
     * Property: exceptions
     * {Array} Exception Mappings of Zoom levels to Location Hierarchy levels
     * - provides OpenLayers.Geometry areas which have a different set of mappings
     *
     */
    exceptions: {},

    /**
     * Method: getLevel
     *
     * Parameters:
     * center - {OpenLayers.LonLat}
     * zoom - {Integer}
     *
     * Returns:
     * {String} The level we should be requesting.
     */
    getLevel: function(center, zoom) {
        if (zoom == this.zoom) {
            // Return the previously-calculated value
            return this.level;
        }
        var features = this.layer.features;
        var len = features.length;
        if (!len) {
            // No features to introspect
            // - do a simple lookup
            // @ToDo: Lookup Exceptions?
            //if (feature.geometry.intersects(geom))
            return this.levels[zoom];
        } else {
            // Introspect the features to see if we should modify the Lx level
            var empty = 0;
            var total = 0;
            for (var i=0; i < len; i++) {
                var pixels = this.toPixel(features[i].geometry, zoom);
                if (pixels) {
                    total += pixels;
                } else {
                    // Don't include point features in the mean
                    empty++;
                }
            }
            var mean = total / (len - empty);
            s3_debug(mean);
            if (zoom > this.zoom) {
                // We're zooming-in
                if (mean > 500000) {
                    // Show more detail
                    return Math.min(this.level + 1, 5);
                } else {
                    // Keep it the same
                    return this.level;
                }
            } else {
                // We must be zooming-out
                if (mean < 500000) {
                    // Show less detail
                    return Math.max(this.level - 1, 0);
                } else {
                    // Keep it the same
                    return this.level;
                }
            }
        }
    },
 
    /**
     * Method: toPixel
     *
     * Parameters:
     * lat - {Float} of whatever units is used on the map
     * zoom - {Integer}
     *
     * Returns:
     * {Integer} The number of pixels
     */
    toPixel: function(geometry, zoom) {
        var lat = geometry.getCentroid().y;
        var C = 6372798.2; // Radius of the Earth (in meters)
        var m_per_pixel = C * Math.cos(lat) / Math.pow(2, zoom + 8);
        var area = geometry.getArea(); // m2
        var length = Math.sqrt(area) / m_per_pixel; // pixels
        var pixels = Math.pow(length, 2); // pixels ^2
        return pixels;
    },

    /**
     * Method: update
     * Callback function called on "moveend" or "refresh" layer events.
     *
     * Parameters:
     * options - {Object} Optional object whose properties will determine
     *     the behaviour of this Strategy
     *
     * Valid options include:
     * force - {Boolean} if true, new data must be unconditionally read.
     * noAbort - {Boolean} if true, do not abort previous requests.
     */
    update: function(options) {
        var layer = this.layer;
        var old_level = this.level || this.getLevel(this.center, this.zoom);
        var center = layer.map.getCenter();
        var zoom = layer.map.getZoom();
        var new_level = this.getLevel(center, zoom);
        this.level = new_level;
        this.center = center;
        this.zoom = zoom;
        var mapBounds = this.getMapBounds();
        if (mapBounds !== null && ((options && options.force) ||
            (layer.visibility && layer.calculateInRange() && this.invalidBounds(mapBounds)) ||
            new_level != old_level)) {
            this.calculateBounds(mapBounds);
            this.resolution = layer.map.getResolution();
            this.triggerRead(options);
        }
    },

    /**
     * Method: triggerRead
     *
     * Parameters:
     * options - {Object} Additional options for the protocol's read method 
     *     (optional)
     *
     * Returns:
     * {<OpenLayers.Protocol.Response>} The protocol response object
     *      returned by the layer protocol.
     */
    triggerRead: function(options) {
        var layer = this.layer;
        var response = this.response;
        if (response && !(options && options.noAbort === true)) {
            layer.protocol.abort(response);
            layer.events.triggerEvent('loadend');
        }
        var evt = {filter: this.createFilter()};
        layer.events.triggerEvent('loadstart', evt);
        response = layer.protocol.read(
            OpenLayers.Util.applyDefaults({
                filter: evt.filter,
                callback: this.merge,
                params: {level: 'L' + this.level},
                scope: this
        }, options));
    },
 
    CLASS_NAME: "OpenLayers.Strategy.ZoomBBOX" 
});
