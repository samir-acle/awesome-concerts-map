/** Awesome Concert Finder
 * created by Samir Mehta
 *
 * The purpose of this app is to show the user what concerts are taking place in a specified
 * location on a certain day.
 *
 * This app populates a full-screen map with concert venues within a metro area.
 * Default location is Washington, DC. Only venues that have events on the specified
 * date (default is today) are shown. The list can be filtered based on keyword, artist,
 * or venue. The location and date can be changed, but only a single day can be used -
 * a range cannot be specified.
 *
 * Google Maps API was used to provide the map.
 * Eventful API used to gather event and location data.
 */

"use strict";

/** Error handling for google maps
 * Timeout cleared once initMap called
 */
var mapsError = window.setTimeout(function() {
    alert('The map was unable to load. Check your internet connection and try again.');
}, 8000);

/**
 * Creates model object holding the data for this app.
 * initially contains empty array that will be populated with
 * data received from eventful api
 */
var Model = {
    locations: []
};


/** viewmodel function used for knockout bindings */
var ViewModel = function() {

    var self = this;

    self.home_location = ko.observable('Washington, DC');

    var datepicker = $('#datepicker');

    //initialize datepicker with ISO 8601 format so can be converted by MomentJs
    datepicker.datepicker({
        dateFormat: 'yy-mm-dd'
    });

    self.currentDate = ko.observable(datepicker.datepicker('getDate'));
    self.currentDateFormatted = ko.computed(function() {
        var date = self.currentDate();
        var formattedDate = moment(date).format('YYYYMMDD') + '00';
        var dateRange = formattedDate + '-' + formattedDate;
        return dateRange;
    });

    self.selectedDate = ko.computed(function() {
        var date = self.currentDate();
        var formattedDate = moment(date).format('MMM Do YYYY');
        return formattedDate;
    });

    self.displayDate = ko.observable('today');

    self.eventfulOptions = ko.computed(function() {
        var options = {};
        options.category = 'music';
        options.location = self.home_location();
        options.date = self.currentDateFormatted();
        options.page_size = 20;
        options.sort_order = 'popularity';
        options.include = 'categories, price';
        options.change_multi_day_start = true;
        return options;
    });

    /**
     * makes ajax request to eventful api
     * @param {string} url - api url
     */
    function eventfulAjax(options) {
        var eventfulRequestTimeout = setTimeout(function() {
            alert('Unable to load venue data');
        }, 12000);

        var ajax = $.ajax({
                url: 'https://awesome-concerts-map.herokuapp.com/concerts',
                type: 'GET',
                dataType: 'json',
                data: options
            })
            .then(function(data) {
                Model.locations = data.events.event;
                self.generateList(Model.locations);
                clearTimeout(eventfulRequestTimeout);
            });
    }
    self.eventfulAjax = eventfulAjax;

    /** converts date to new format for display purposse */
    function setDisplayDate() {
        var date = moment(self.currentDate()).format('MMMM Do YYYY');
        self.displayDate(date);
    }
    self.setDisplayDate = setDisplayDate;


    /** sets up information for new eventful API request */
    function submitNew() {
        self.newEventfulRequest();
        self.newLocation();
        self.setDisplayDate();
        self.currentLocation = self.home_location();
        self.userInput(false);
    }
    self.submitNew = submitNew;


    /** calls geocodeLocation function to convert user inputted location to lat/long coords */
    function newLocation() {
        var newLoc = self.home_location();
        self.geocodeLocation(newLoc);
    }
    self.newLocation = newLocation;

    /**
     * clears view of all old location information before starting a new evenutful
     * API Ajax request for new event information based on user input
     */
    function newEventfulRequest() {
        self.clearMarkers();
        self.locationsList([]);
        self.venueArray = [];
        self.eventfulAjax(self.eventfulOptions());
    }
    self.newEventfulRequest = newEventfulRequest;

    // initial eventful API request
    self.eventfulAjax(self.eventfulOptions());

    /**
     * Event class
     * contains information on each event
     * @constructor
     */
    var Event = function(location) {
        this.start_time = location.start_time;
        this.event_title = location.title;
        this.url = location.url;
        this.image = (location.image) ? location.image.medium.url : '';
    };

    self.Event = Event;

    /**
     * Venue class
     * contains all relevant venue information
     * @constructor
     */
    var Venue = function(location) {
        var that = this;

        that.latLng = {
            lat: parseFloat(location.latitude),
            lng: parseFloat(location.longitude)
        };

        that.venue_name = location.venue_name;
        that.short_name = that.venue_name.slice(0, 35);

        that.events = ko.observableArray([]);

        that.events.push(new self.Event(location));

        // used for filtering
        that.description = ko.observable(location.description);
        that.title = ko.observable(location.title);

        that.marker = self.createMapMarker(that.latLng, that.venue_name);
        that.infoWindowContent = self.createInfoWindowContent(that);
        that.bounce = false;

        that.marker.addListener('click', function() {
            self.checkBounce(that.marker);
            self.infoWindow.close();
            self.infoWindow.setContent(that.infoWindowContent);
            self.map.panTo(that.marker.position);
            window.setTimeout(function() {
                self.infoWindow.open(self.map, that.marker);
                self.infoOpen(true);
            }, 600);
        });

        // if true, location is displayed on list and map
        this.displayLocation = ko.computed(function() {
            var venueSearch = self.lowerCase(that.venue_name);
            var titleSearch = self.lowerCase(that.title());
            var descriptionSearch = self.lowerCase(that.description());

            var venueResult = self.getResult(venueSearch);
            var titleResult = self.getResult(titleSearch);
            var descriptionResult = self.getResult(descriptionSearch);

            var displayLocation = (venueResult || titleResult || descriptionResult) ? true : false;
            return displayLocation;
        });
        self.filterMarkers(that);
    };

    self.locationsList = ko.observableArray([]);

    /**
     * converts string to lower case
     * @param {string}
     * @returns {string} all lower case
     */
    function lowerCase(string) {
        var lowerCase = (string) ? string.toLowerCase() : '';
        return lowerCase;
    }
    self.lowerCase = lowerCase;

    // creates regular expression from input of search bar
    self.filter = ko.observable();
    self.regExp = ko.computed(function() {
        var filter = self.lowerCase(self.filter());
        var reg = new RegExp(filter);
        return reg;
    });

    /**
     * use regular expression to test if string contains search entry
     * @param {string}
     * @returns {boolean}
     */
    function getResult(string) {
        return self.regExp().test(string);
    }
    self.getResult = getResult;

    /**
     * stops all bouncing map markers
     * https://developers.google.com/maps/documentation/javascript/markers#animate
     */
    function stopBounces() {
        self.locationsList().forEach(function(venue) {
            if (venue.marker.getAnimation() !== null) {
                venue.marker.setAnimation(null);
            }
        });
    }
    self.stopBounces = stopBounces;

    /**
     * sets bouncing animation on marker
     * @param {object} marker - map marker object
     */
    function toggleBounce(marker) {
        marker.setAnimation(google.maps.Animation.BOUNCE);
    }
    self.toggleBounce = toggleBounce;

    /**
     * checks if map marker is bouncing
     * calls stopBounces and toggleBounce function if it is
     * param {object} marker - map marker object
     */
    function checkBounce(marker) {
        if (marker.getAnimation() === null) {
            self.stopBounces();
            self.toggleBounce(marker);
        }
    }
    self.checkBounce = checkBounce;

    self.venueArray = [];

    /**
     * creates new Venue object for each unique venue
     * if venue already exists, adds event information to existing venue object
     * @param {array} locations - array of objects with location data
     */
    function generateList(locations) {
        locations.forEach(function(venue) {
            if (venue.performers) {
                var venueExists = self.venueArray.indexOf(venue.venue_name);

                if (venueExists === -1) {
                    self.locationsList.push(new Venue(venue));
                    self.venueArray.push(venue.venue_name);
                } else {
                    var existingVenue = self.locationsList()[venueExists];
                    existingVenue.events.push(new Event(venue));
                    existingVenue.infoWindowContent = self.createInfoWindowContent(existingVenue);
                    existingVenue.title(existingVenue.title() + ' ' + venue.title);
                    existingVenue.description(existingVenue.description + ' ' + venue.description);
                }
            }
        });
    }
    self.generateList = generateList;

    self.home = {
        lat: 38.9071923,
        lng: -77.03687070000001
    };
    self.currentLocation = 'Washington, DC';

    /** initialize the map from googlemaps API */
    function initMap() {
        window.clearTimeout(mapsError);

        var myLatLng = self.home;

        var mapOptions = {
            center: myLatLng,
            scrollwheel: false,
            zoom: 12,
            disableDefaultUI: true,
            zoomControl: true,
            zoomControlOptions: {
                position: google.maps.ControlPosition.RIGHT_BOTTOM
            }
        }

        self.map = new google.maps.Map(document.getElementById('map'), mapOptions);
        self.infoWindow = new google.maps.InfoWindow();
        self.geocoder = new google.maps.Geocoder();

        // used code from http://biostall.com/detect-infowindow-being-closed Steve Marks
        // to add event listener to info window close icon
        google.maps.event.addListener(self.infoWindow, 'closeclick', function() {
            self.stopBounces();
            self.infoOpen(false);
        });

    }
    self.infoOpen = ko.observable();
    self.initMap = initMap;

    /**
     * https://developers.google.com/maps/documentation/javascript/geocoding
     * takes user inputted location and turns into a latitude and longitude coordinate
     * @param {string} location
     */
    function geocodeLocation(location) {
        var address = location;
        self.geocoder.geocode({
            address: address
        }, function(results, status) {
            if (status === google.maps.GeocoderStatus.OK) {
                self.map.setCenter(results[0].geometry.location);
            } else {
                alert("Geocode was not successful for the following reason: " + status);
            }
        });
    }
    self.geocodeLocation = geocodeLocation;

    /**
     * creates map marker
     * @param {object} pos - latitude and longitude coordinates
     * @param {string} title - name of venue
     * @returns {object} map marker object
     */
    function createMapMarker(pos, title) {
        var marker = new google.maps.Marker({
            position: pos,
            map: self.map,
            title: title,
            animation: google.maps.Animation.DROP
        });

        return marker;
    }
    self.createMapMarker = createMapMarker;

    /**
     * opens info window and moves map towards location when clicked on in the list
     * @param {object} venue - data for venue that was clicked on
     */
    function locationClick(venue) {
        self.infoWindow.close();
        self.infoWindow.setContent(venue.infoWindowContent);
        self.map.panTo(venue.marker.position);
        self.checkBounce(venue.marker);
        window.setTimeout(function() {
            self.infoWindow.open(self.map, venue.marker);
            self.infoOpen(true);
        }, 600);
        self.toggleSideBar();
    }
    self.locationClick = locationClick;

    /**
     * creates content to display in info window for each venue
     * @param {object} that - Venue object containing name, events, etc.
     * @returns {string} html for info window content
     */
    function createInfoWindowContent(that) {
        var eventInfo = '';

        that.events().forEach(function(event) {
            eventInfo += '<div class="event-img"><img src="' + event.image + '" class="image"></div>' +
                '<div class="event-details">' +
                '<h4 class="artist">' + event.event_title + '</h4>' +
                '<h4 class="start-time">' + moment(event.start_time).format('MMM Do YYYY @ h:mm a') + '</h4>' +
                '</div>' +
                '<a class="event-details" href="' + event.url + '" class="link">Click Here for More Details</a>' +
                '<hr>';
        });

        var content = '<div class="info-window">' +
            '<h2 class="info-window-title">' + that.venue_name + '</h2>' +
            eventInfo +
            '</div>';

        return content;
    }
    self.createInfoWindowContent = createInfoWindowContent;

    /**
     * displays map markers if search query was met
     * @param {object} location - location information
     */
    function filterMarkers(location) {
        var map = ko.computed(function() {
            var map = self.map;

            if (!location.displayLocation()) {
                map = null;
            }

            location.marker.setMap(map);
        });
    }
    self.filterMarkers = filterMarkers;

    /** clears all map markers from the screen */
    function clearMarkers() {
        self.locationsList().forEach(function(location) {
            location.marker.setMap(null);
        });
    }
    self.clearMarkers = clearMarkers;

    self.sideBar = ko.observable(false);
    /**
     * opens or closes the search bar/list area
     * closes info window if open
     */
    function toggleSideBar() {
        self.sideBar(!self.sideBar());

        if (self.userInput()) {
            self.closeUserInput();
        }

        self.closeInfoWindow();
    }
    self.toggleSideBar = toggleSideBar;

    self.userInput = ko.observable(false);

    /**
     *  closes the search bar/list area as well as the info window
     *  opens date and location selection area
     */
    function openUserInput() {
        self.userInput(true);
        self.sideBar(false);
        self.closeInfoWindow();
    }
    self.openUserInput = openUserInput;

    /** closes date and location selection area */
    function closeUserInput() {
        self.userInput(false);
    }
    self.closeUserInput = closeUserInput;

    self.infoOpen = ko.observable(false);

    /** closes infoWindow and stops marker from bouncing */
    function closeInfoWindow() {
        self.infoWindow.close();
        self.infoOpen(false);
        self.stopBounces();
    }
    self.closeInfoWindow = closeInfoWindow;

    self.arrowUrl = ko.computed(function() {
        var url = (self.sideBar()) ? 'images/arrow-left.svg' : 'images/arrow-right.svg';
        return url;
    });

    /*Set up swipe events
     * Followed tutorial at
     * http://www.onextrapixel.com/2013/06/24/creating-a-swipeable-side-menu-for-the-web/
     * and used documentation at abs.rampinteractive.co.uk/touchSwipe/demos/Single_swipe.html
     * to create swipe funcitonality
     * TODO: make custom knockout binding
     */
    $('.left-swipe-area').swipe({
        swipeRight: function(event, direction, distance, duration, fingerCount, fingerData) {
            self.toggleSideBar();
        },
        swipeLeft: function(event, direction, distance, duration, fingerCount, fingerData) {
            self.toggleSideBar();
        }
    });

    $('.right-swipe-area').swipe({
        swipeRight: function(event, direction, distance, duration, fingerCount, fingerData) {
            self.closeUserInput();
        },
        swipeLeft: function(event, direction, distance, duration, fingerCount, fingerData) {
            self.openUserInput();
        }
    });
};

var vm = new ViewModel();
ko.applyBindings(vm);
