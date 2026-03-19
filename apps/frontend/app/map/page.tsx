"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, MapPin, Search, AlertCircle, CreditCard, Globe, MapPinned } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';

// Import custom styles
import './styles.css';

// Define type for Google Maps
declare global {
  interface Window {
    google: any;
    initMap: () => void;
    googleMapsInitialized: boolean;
    infoWindow?: any; // Add infoWindow to the Window interface
  }
}

// Add type definitions for Google Maps predictions
interface PredictionStructuredFormatting {
  main_text: string;
  secondary_text: string;
}

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting?: PredictionStructuredFormatting;
}

// Fallback UI while map is loading
const MapLoadingFallback = () => (
  <div className="flex-grow w-full rounded-lg border shadow-sm relative" style={{ minHeight: "500px" }}>
    <div className="absolute inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p>Loading map...</p>
      </div>
    </div>
  </div>
);

export default function MapPage() {
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingError, setBillingError] = useState(false);
  const [referrerError, setReferrerError] = useState(false);
  const [isDroppingMarker, setIsDroppingMarker] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const mapIdRef = useRef<string>(process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || ''); // Get Map ID from environment variables
  const autocompleteRef = useRef<any>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const markerRef = useRef<any>(null); // Hold current marker
  const autocompleteInputRef = useRef<HTMLInputElement>(null);

  // One-time setup - hydration-safe check for client
  useEffect(() => {
    // This ensures we only run client-side code
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    if (!apiKey) {
      handleMapError('Google Maps API key is not configured');
    }
    
    // Log Map ID
    console.log('Map ID:', process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || 'Not set');
  }, []);

  // Handle outside clicks to close predictions dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#search-container')) {
        setShowPredictions(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Add error listener for Google Maps errors
  useEffect(() => {
    // Listen for maps API errors
    const handleGoogleMapsError = (event: ErrorEvent) => {
      if (event.message && event.message.includes('Google Maps JavaScript API')) {
        console.error('Google Maps error:', event);
        
        if (event.message.includes('BillingNotEnabledMapError')) {
          console.error('Billing not enabled for Google Maps API');
          setBillingError(true);
        }
        
        if (event.message.includes('RefererNotAllowedMapError')) {
          console.error('Referer not allowed for Google Maps API');
          setReferrerError(true);
        }
      }
    };

    window.addEventListener('error', handleGoogleMapsError);
    
    return () => {
      window.removeEventListener('error', handleGoogleMapsError);
    };
  }, []);

  // Initialize Google Maps - separated from the DOM manipulation
  useEffect(() => {
    // Skip if there's an error or we're already initialized
    if (error || window.googleMapsInitialized) return;

    // Safely create the map initialization function
    const setupMapInitFunction = () => {
      // Only define if not already defined
      if (typeof window.initMap !== 'function') {
        window.initMap = function() {
          console.log('initMap callback fired');
          window.googleMapsInitialized = true;
          setMapLoaded(true);
        };
      }
    };

    // Load the Google Maps script
    const loadGoogleMapsScript = () => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
      if (!apiKey) return;

      // Check if script is already in the document
      if (document.querySelector('script[src*="maps.googleapis.com/maps/api"]')) {
        console.log('Google Maps script already loaded');
        setMapLoaded(true);
        return;
      }
      
      // First set up the initialization function
      setupMapInitFunction();
      
      // Then create and append the script
      const script = document.createElement('script');
      // Load with the optimized version and defer loading of non-critical components
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&v=weekly&callback=initMap&loading=async&defer=true`;
      script.async = true;
      script.defer = true;
      
      script.onerror = () => {
        handleMapError('Failed to load Google Maps');
      };
      
      // Add timeout to catch slow loading scripts
      const scriptTimeout = setTimeout(() => {
        if (!window.googleMapsInitialized) {
          handleMapError('Google Maps took too long to load. Please check your connection and try again.');
        }
      }, 15000); // 15 second timeout
      
      // Clean up timeout when script loads
      script.onload = () => {
        clearTimeout(scriptTimeout);
      };
      
      document.head.appendChild(script);
    };

    // Load script with a small delay to ensure DOM is ready
    const timeoutId = setTimeout(loadGoogleMapsScript, 300);
    
    return () => {
      // Clean up timeout
      clearTimeout(timeoutId);
    };
  }, [error]);

  // Initialize the map once mapLoaded is true and we have a container
  useEffect(() => {
    // Check if we have what we need
    if (!mapLoaded || !window.google || !window.google.maps) {
      return; // Wait until everything is loaded
    }
    
    // Set a default location
    const defaultLocation = { lat: 37.7749, lng: -122.4194 }; // San Francisco
    setCurrentLocation(defaultLocation);
    
    // This must be in a setTimeout to ensure the container is available
    const initializeMapTimeout = setTimeout(() => {
      // Double check that the container exists
      if (!mapRef.current) {
        console.error('Map container ref not available after timeout');
        setError('Map container not available');
        setLoading(false);
        return;
      }
      
      // Check map not already initialized
      if (googleMapRef.current) {
        console.log('Google Map already initialized');
        setLoading(false);
        return;
      }
      
      try {
        console.log('Initializing map with container:', mapRef.current);
        
        // Create map with optimized settings
        googleMapRef.current = new window.google.maps.Map(mapRef.current, {
          center: defaultLocation,
          zoom: 14,
          mapTypeControl: false, // Simplify UI
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: 'greedy', // Better mobile experience
          disableDefaultUI: false,
          clickableIcons: true, // Enable clickable POIs
          mapTypeId: window.google.maps.MapTypeId.ROADMAP,
          mapId: mapIdRef.current, // Use Map ID from environment variables
          optimized: true, // Improve rendering performance
          tilt: 0, // Disable 45° imagery for better performance
          maxZoom: 18, // Limit max zoom level for better tile loading
          minZoom: 3, // Reasonable min zoom
          restriction: {
            latLngBounds: {
              north: 85,
              south: -85,
              west: -180,
              east: 180
            },
            strictBounds: true
          }, // Restrict panning to world bounds
        });
        
        // Set up click listener for dropping markers or for POI clicks
        googleMapRef.current.addListener('click', (e: any) => {
          if (isDroppingMarker) {
            placeMarkerOnMap(e.latLng);
            setIsDroppingMarker(false);
          } else {
            // Check if this is a POI (place) click
            if (e.placeId) {
              e.stop(); // Prevent default POI behavior
              
              // Get place details
              const placesService = new window.google.maps.places.PlacesService(googleMapRef.current);
              placesService.getDetails(
                {
                  placeId: e.placeId,
                  fields: ['name', 'geometry', 'formatted_address', 'place_id', 'website', 'rating', 'types']
                },
                (place: any, status: string) => {
                  if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
                    // Create marker at the place location
                    updateMarkerPosition(place.geometry.location);
                    
                    // Create info window with place details and Google Maps link
                    if (window.infoWindow) window.infoWindow.close();
                    
                    // Determine place type for display
                    let placeType = 'Place';
                    if (place.types && place.types.length > 0) {
                      // Convert the place type to a more readable format
                      placeType = place.types[0].replace(/_/g, ' ');
                      placeType = placeType.charAt(0).toUpperCase() + placeType.slice(1);
                    }
                    
                    // Create the content for the info window
                    let content = `
                      <div class="info-window">
                        <h3 class="text-base font-medium">${place.name}</h3>
                        <p class="text-sm text-gray-600">${place.formatted_address || ''}</p>
                    `;
                    
                    // Add rating if available
                    if (place.rating) {
                      content += `<p class="text-sm text-amber-600 mt-1">Rating: ${place.rating} ★</p>`;
                    }
                    
                    // Add website if available
                    if (place.website) {
                      content += `<a href="${place.website}" target="_blank" class="text-sm text-blue-600 block">Website</a>`;
                    }
                    
                    // Add Google Maps link
                    content += `<a href="#" class="text-sm text-blue-600 block mt-1 open-in-google-maps">Open in Google Maps</a>
                      </div>
                    `;
                    
                    window.infoWindow = new window.google.maps.InfoWindow({
                      content: content,
                      position: place.geometry.location,
                    });
                    
                    window.infoWindow.open(googleMapRef.current);
                    
                    // Add event listener to the link after the info window is opened
                    setTimeout(() => {
                      const link = document.querySelector('.open-in-google-maps');
                      if (link) {
                        link.addEventListener('click', (e) => {
                          e.preventDefault();
                          const location = place.geometry.location;
                          const lat = location.lat();
                          const lng = location.lng();
                          openLocationInGoogleMaps(lat, lng, place.place_id);
                        });
                      }
                    }, 100);
                  }
                }
              );
            }
          }
        });
        
        // Initialize Autocomplete
        initializeAutocomplete();
        
        // Create a marker for current location using AdvancedMarkerElement
        try {
          if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
            // Use the recommended AdvancedMarkerElement
            console.log('Using AdvancedMarkerElement');
            
            // Create the marker content
            const markerElement = document.createElement('div');
            markerElement.className = 'custom-pin';
            markerElement.innerHTML = '<div class="pin-inner"></div>';
            
            // Create the advanced marker
            markerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
              position: defaultLocation,
              map: googleMapRef.current,
              title: 'Current Location',
              content: markerElement,
            });
            
            // Make it animate in
            markerElement.style.opacity = '0';
            setTimeout(() => {
              markerElement.style.transition = 'opacity 0.5s';
              markerElement.style.opacity = '1';
            }, 10);
          } else {
            // Fall back to legacy Marker if AdvancedMarkerElement is not available
            console.log('Fallback to legacy Marker - AdvancedMarkerElement not available');
            markerRef.current = new window.google.maps.Marker({
              position: defaultLocation,
              map: googleMapRef.current,
              animation: window.google.maps.Animation.DROP,
              title: 'Current Location',
            });
          }
        } catch (markerError) {
          console.error('Error creating advanced marker, falling back to legacy', markerError);
          // Fallback to legacy markers if advanced markers fail
          markerRef.current = new window.google.maps.Marker({
            position: defaultLocation,
            map: googleMapRef.current,
            animation: window.google.maps.Animation.DROP,
            title: 'Current Location',
          });
        }
        
        // Attempt to get user location after map is created
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              };
              setCurrentLocation(userLocation);
              
              // Update map
              if (googleMapRef.current) {
                googleMapRef.current.setCenter(userLocation);
                
                // Update marker position
                updateMarkerPosition(userLocation);
              }
            },
            (err) => {
              console.warn('Geolocation error:', err);
            }
          );
        }
        
        setLoading(false);
      } catch (err) {
        handleMapError('Failed to initialize map');
      }
    }, 500); // Give DOM time to stabilize
    
    return () => {
      clearTimeout(initializeMapTimeout);
    };
  }, [mapLoaded, isDroppingMarker]);

  // Initialize Autocomplete - uses the new recommended API
  const initializeAutocomplete = () => {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      console.error('Places API not available');
      return;
    }
    
    try {
      const inputElement = document.getElementById('map-search-input') as HTMLInputElement;
      if (!inputElement) {
        console.error('Search input element not found');
        return;
      }

      // Try using the latest Autocomplete widget first
      try {
        console.log('Initializing latest Autocomplete widget');
        
        // Check if we can use the newest Places API style
        if (window.google.maps.places.PlacesService && window.google.maps.places.AutocompleteService) {
          // Use the Autocomplete widget - preferred approach
          autocompleteRef.current = new window.google.maps.places.Autocomplete(inputElement, {
            fields: ['place_id', 'geometry', 'name', 'formatted_address'],
            types: ['geocode', 'establishment']
          });
          
          // Listen for place selection
          autocompleteRef.current.addListener('place_changed', () => {
            const place = autocompleteRef.current.getPlace();
            
            if (!place || !place.geometry) {
              console.error('No place details available');
              return;
            }
            
            // Update the search query
            setSearchQuery(place.name || '');
            
            // Update the map
            googleMapRef.current.setCenter(place.geometry.location);
            googleMapRef.current.setZoom(15);
            
            // Update marker
            updateMarkerPosition(place.geometry.location);
            
            // Create info window
            if (window.infoWindow) window.infoWindow.close();
            
            window.infoWindow = new window.google.maps.InfoWindow({
              content: `
                <div class="info-window">
                  <h3 class="text-base font-medium">${place.name || 'Selected Location'}</h3>
                  <p class="text-sm text-gray-600">${place.formatted_address || ''}</p>
                </div>
              `,
              position: place.geometry.location,
            });
            
            window.infoWindow.open(googleMapRef.current);
          });
          
          console.log('Autocomplete initialized successfully');
        } else {
          throw new Error('Preferred Places API not available');
        }
      } catch (autocompleteError) {
        console.error('Error initializing Autocomplete widget:', autocompleteError);
        
        // Try the newer API first if available
        if (window.google.maps.places.AutocompletionRequest && window.google.maps.places.AutocompleteService) {
          console.log('Trying newer AutocompleteService API');
          const service = new window.google.maps.places.AutocompleteService();
          
          // Set up input change handler
          inputElement.addEventListener('input', (e) => {
            const input = (e.target as HTMLInputElement).value;
            
            if (!input.trim()) {
              setPredictions([]);
              setShowPredictions(false);
              return;
            }
            
            // Use the newer API style - remove country restriction
            service.getPlacePredictions({
              input,
              types: ['geocode', 'establishment']
            }, (predictions: PlacePrediction[] | null, status: string) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                setPredictions(predictions);
                setShowPredictions(true);
              } else {
                setPredictions([]);
                setShowPredictions(false);
              }
            });
          });
          
          autocompleteRef.current = service;
        } else {
          // Last resort - fallback to classic autocomplete service
          console.warn('Falling back to legacy autocomplete service');
          try {
            const service = new window.google.maps.places.AutocompleteService();
            autocompleteRef.current = service;
            
            // Set up input change handler
            inputElement.addEventListener('input', (e) => {
              const input = (e.target as HTMLInputElement).value;
              
              if (!input.trim()) {
                setPredictions([]);
                setShowPredictions(false);
                return;
              }
              
              // Use classic predictions API - remove country restriction
              service.getPlacePredictions({
                input, 
                types: ['geocode', 'establishment']
              }, (predictions: PlacePrediction[] | null, status: string) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                  setPredictions(predictions);
                  setShowPredictions(true);
                } else {
                  setPredictions([]);
                  setShowPredictions(false);
                }
              });
            });
          } catch (legacyError) {
            console.error('Failed to initialize any autocomplete service:', legacyError);
          }
        }
      }
    } catch (err) {
      console.error('Failed to initialize autocomplete:', err);
    }
  };

  // Handle search input change with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Only trigger search after user stops typing for 300ms
    if (value.trim() && autocompleteRef.current && typeof autocompleteRef.current.getPlacePredictions === 'function') {
      debounceTimerRef.current = setTimeout(() => {
        autocompleteRef.current.getPlacePredictions({
          input: value,
          types: ['geocode', 'establishment']
        }, (predictions: PlacePrediction[] | null, status: string) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            setPredictions(predictions);
            setShowPredictions(true);
          } else {
            setPredictions([]);
            setShowPredictions(false);
          }
        });
      }, 300);
    } else if (!value.trim()) {
      setPredictions([]);
      setShowPredictions(false);
    }
  };

  // Toggle marker dropping mode
  const toggleMarkerDrop = () => {
    setIsDroppingMarker(!isDroppingMarker);
    if (!isDroppingMarker) {
      toast.info('Click on the map to place a marker');
    }
  };
  
  // Update marker position
  const updateMarkerPosition = (position: {lat: number, lng: number} | any) => {
    if (!markerRef.current) return;
    
    // Handle google.maps.LatLng objects
    let latLng = position;
    if (typeof position.lat === 'function') {
      latLng = {
        lat: position.lat(),
        lng: position.lng()
      };
    }
    
    try {
      // Check if it's an AdvancedMarkerElement
      if (markerRef.current.position && typeof markerRef.current.position !== 'function') {
        // AdvancedMarkerElement
        markerRef.current.position = latLng;
      } else if (markerRef.current.setPosition) {
        // Legacy Marker
        markerRef.current.setPosition(latLng);
      }
    } catch (err) {
      console.error('Error updating marker position:', err);
    }
  };

  // Function to open the current location in Google Maps
  const openLocationInGoogleMaps = (lat: number, lng: number, label?: string) => {
    const url = label 
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${encodeURIComponent(label)}`
      : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, '_blank');
  };

  // Place marker on map at the specified position
  const placeMarkerOnMap = (position: any) => {
    // Clear existing marker
    if (markerRef.current) {
      if (typeof markerRef.current.setMap === 'function') {
        markerRef.current.setMap(null);
      } else if (markerRef.current.map) {
        markerRef.current.map = null;
      }
    }
    
    try {
      // Try to use AdvancedMarkerElement
      if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
        const markerElement = document.createElement('div');
        markerElement.className = 'custom-pin';
        markerElement.innerHTML = '<div class="pin-inner pin-dropped"></div>';
        
        markerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
          position: position,
          map: googleMapRef.current,
          title: 'Dropped Pin',
          content: markerElement,
        });
        
        // Animate in
        markerElement.style.opacity = '0';
        setTimeout(() => {
          markerElement.style.transition = 'opacity 0.5s, transform 0.3s';
          markerElement.style.opacity = '1';
          markerElement.style.transform = 'translateY(0)';
        }, 10);
        
        // Add click event to open in Google Maps
        markerElement.addEventListener('click', () => {
          const pos = markerRef.current.position;
          const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
          const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
          openLocationInGoogleMaps(lat, lng);
        });
      } else {
        // Fall back to legacy marker
        markerRef.current = new window.google.maps.Marker({
          position: position,
          map: googleMapRef.current,
          animation: window.google.maps.Animation.DROP,
          title: 'Dropped Pin'
        });
        
        // Add click event to open in Google Maps
        markerRef.current.addListener('click', () => {
          const pos = markerRef.current.getPosition();
          openLocationInGoogleMaps(pos.lat(), pos.lng());
        });
      }
      
      // Get address for the location
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: position }, (results: any, status: string) => {
        if (status === 'OK' && results[0]) {
          // Show info window with address
          if (window.infoWindow) window.infoWindow.close();
          
          // Create info window content with link to Google Maps
          const formattedAddress = results[0].formatted_address;
          
          window.infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div class="info-window">
                <h3 class="text-base font-medium">Dropped Pin</h3>
                <p class="text-sm text-gray-600">${formattedAddress}</p>
                <a href="#" class="text-sm text-blue-600 mt-2 inline-block open-in-google-maps">Open in Google Maps</a>
              </div>
            `,
            position: position,
          });
          
          window.infoWindow.open(googleMapRef.current);
          
          // Add event listener to the link after the info window is opened
          setTimeout(() => {
            const link = document.querySelector('.open-in-google-maps');
            if (link) {
              link.addEventListener('click', (e) => {
                e.preventDefault();
                const lat = typeof position.lat === 'function' ? position.lat() : position.lat;
                const lng = typeof position.lng === 'function' ? position.lng() : position.lng;
                openLocationInGoogleMaps(lat, lng, formattedAddress);
              });
            }
          }, 100);
        }
      });
      
      // Update current location
      const newLoc = { 
        lat: typeof position.lat === 'function' ? position.lat() : position.lat,
        lng: typeof position.lng === 'function' ? position.lng() : position.lng
      };
      setCurrentLocation(newLoc);
      
      toast.success('Marker placed');
    } catch (err) {
      console.error('Error placing marker:', err);
      toast.error('Failed to place marker');
    }
  };

  // Handle place selection
  const handlePlaceSelect = async (placeId: string) => {
    try {
      // Clear any existing info windows
      if (window.infoWindow) {
        window.infoWindow.close();
      }
      
      // Try to use the new Place API
      if (window.google.maps.places.Place) {
        const place = new window.google.maps.places.Place({
          id: placeId,
          requestedFields: ['id', 'location', 'displayName', 'formattedAddress'],
        });
        
        try {
          await place.fetchFields();
          
          // Close predictions dropdown
          setShowPredictions(false);
          
          // Update search query with place name
          if (place.displayName) {
            setSearchQuery(place.displayName.text);
          }
          
          if (place.location) {
            // Update marker position
            updateMarkerPosition(place.location);
            
            // Center and zoom map
            googleMapRef.current.setCenter(place.location);
            googleMapRef.current.setZoom(15);
            
            // Create info window with place details
            window.infoWindow = new window.google.maps.InfoWindow({
              content: `
                <div class="info-window">
                  <h3 class="text-base font-medium">${place.displayName?.text || 'Selected Location'}</h3>
                  <p class="text-sm text-gray-600">${place.formattedAddress || ''}</p>
                </div>
              `,
              position: place.location,
            });
            
            // Open info window
            window.infoWindow.open(googleMapRef.current);
          }
        } catch (fetchError) {
          console.error('Error fetching place details:', fetchError);
          fallbackPlaceDetails(placeId);
        }
      } else {
        // Fall back to legacy PlacesService
        fallbackPlaceDetails(placeId);
      }
    } catch (err) {
      console.error('Error selecting place:', err);
      fallbackPlaceDetails(placeId);
    }
  };
  
  // Fallback to legacy PlacesService if needed
  const fallbackPlaceDetails = (placeId: string) => {
    console.warn('Falling back to legacy PlacesService');
    try {
      const placesService = new window.google.maps.places.PlacesService(googleMapRef.current);
      
      placesService.getDetails(
        {
          placeId: placeId,
          fields: ['name', 'geometry', 'formatted_address']
        },
        (place: any, status: string) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
            // Close predictions dropdown
            setShowPredictions(false);
            
            // Update search query with place name
            setSearchQuery(place.name);
            
            // Update marker position
            if (place.geometry && place.geometry.location) {
              updateMarkerPosition(place.geometry.location);
              
              // Center and zoom map
              googleMapRef.current.setCenter(place.geometry.location);
              googleMapRef.current.setZoom(15);
              
              // Add info window with place details
              window.infoWindow = new window.google.maps.InfoWindow({
                content: `
                  <div class="info-window">
                    <h3 class="text-base font-medium">${place.name}</h3>
                    <p class="text-sm text-gray-600">${place.formatted_address}</p>
                  </div>
                `,
                position: place.geometry.location,
              });
              
              // Open info window
              window.infoWindow.open(googleMapRef.current);
            }
          }
        }
      );
    } catch (err) {
      console.error('Failed to use legacy PlacesService:', err);
    }
  };

  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;
    
    // Use the Google Geocoder API to search for locations
    if (window.google && window.google.maps && window.google.maps.Geocoder) {
      const geocoder = new window.google.maps.Geocoder();
      
      geocoder.geocode({ address: searchQuery }, (results: any, status: string) => {
        if (status === 'OK' && results && results[0]) {
          // Move the map to the location
          const location = results[0].geometry.location;
          googleMapRef.current.setCenter(location);
          googleMapRef.current.setZoom(15);
          
          // Update the marker
          updateMarkerPosition(location);
          
          // Show info window
          if (window.infoWindow) window.infoWindow.close();
          
          window.infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div class="info-window">
                <h3 class="text-base font-medium">${results[0].formatted_address.split(',')[0]}</h3>
                <p class="text-sm text-gray-600">${results[0].formatted_address}</p>
              </div>
            `,
            position: location,
          });
          
          window.infoWindow.open(googleMapRef.current);
          
          toast.success('Location found');
        } else {
          toast.error('Location not found');
          console.error('Geocode error:', status);
        }
      });
    } else {
      // Fallback - open Google Maps directly
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`, '_blank');
    }
  };
  
  // Open current view in Google Maps
  const openInGoogleMaps = () => {
    if (currentLocation) {
      window.open(`https://www.google.com/maps/@${currentLocation.lat},${currentLocation.lng},14z`, '_blank');
    } else {
      window.open('https://www.google.com/maps', '_blank');
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Clean up debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Clean up marker
      if (markerRef.current) {
        if (markerRef.current.map) {
          markerRef.current.map = null;
        } else if (markerRef.current.setMap) {
          markerRef.current.setMap(null);
        }
        markerRef.current = null;
      }
      
      // Clean up info window
      if (window.infoWindow) {
        window.infoWindow.close();
        window.infoWindow = null;
      }
      
      // Clean up map
      googleMapRef.current = null;
    };
  }, []);

  // Error handling utility to reset UI states
  const handleMapError = (errorMsg: string) => {
    console.error(errorMsg);
    setLoading(false);
    setIsLocating(false);
    setPredictions([]);
    setShowPredictions(false);
    setError(errorMsg);
  };

  // Function to get user's current location
  const getUserLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    
    setIsLocating(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        // Update state
        setCurrentLocation(userLocation);
        setIsLocating(false);
        setLocationDenied(false);
        
        // Update map
        if (googleMapRef.current) {
          googleMapRef.current.setCenter(userLocation);
          googleMapRef.current.setZoom(15);
          
          // Update marker position
          updateMarkerPosition(userLocation);
          
          // Show success message
          toast.success('Location found');
        }
      },
      (error) => {
        console.warn('Geolocation error:', error);
        setIsLocating(false);
        
        // Check if user denied location access
        if (error.code === 1) {
          setLocationDenied(true);
          toast.error('Location access denied. Please enable location services.');
        } else {
          toast.error('Unable to get your location');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Display error specifically for billing if detected
  if (billingError) {
    return (
      <div className="flex flex-col h-screen p-4 bg-background">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-semibold">Map</h1>
          <Button 
            onClick={openInGoogleMaps}
            variant="outline" 
            className="flex items-center space-x-2"
          >
            <span>Open Google Maps</span>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center space-y-6 max-w-md text-center p-8 border rounded-lg bg-muted/20">
            <CreditCard className="h-16 w-16 text-amber-500" />
            <h2 className="text-xl font-semibold">Google Maps Billing Required</h2>
            <p className="text-muted-foreground">
              The Google Maps Platform requires billing to be enabled on your Google Cloud account.
            </p>
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-md text-sm text-amber-800 dark:text-amber-300">
              <p className="font-medium mb-2">To fix this issue:</p>
              <ol className="list-decimal list-inside text-left space-y-2">
                <li>Go to the <a href="https://console.cloud.google.com/google/maps-apis/overview" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
                <li>Select your project</li>
                <li>Enable billing for your Google Cloud account</li>
                <li>Ensure the Maps JavaScript API is enabled</li>
                <li>Verify your API key has the correct restrictions</li>
              </ol>
            </div>
            <p className="text-sm text-muted-foreground">
              Google Maps offers a $200 monthly credit, which is enough for most small applications.
            </p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Display error specifically for referrer error if detected
  if (referrerError) {
    return (
      <div className="flex flex-col h-screen p-4 bg-background">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-semibold">Map</h1>
          <Button 
            onClick={openInGoogleMaps}
            variant="outline" 
            className="flex items-center space-x-2"
          >
            <span>Open Google Maps</span>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center space-y-6 max-w-md text-center p-8 border rounded-lg bg-muted/20">
            <Globe className="h-16 w-16 text-amber-500" />
            <h2 className="text-xl font-semibold">Referrer Not Allowed</h2>
            <p className="text-muted-foreground">
              Your API key is restricted to specific domains, and the current domain is not allowed.
            </p>
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-md text-sm text-amber-800 dark:text-amber-300">
              <p className="font-medium mb-2">To fix this issue:</p>
              <ol className="list-decimal list-inside text-left space-y-2">
                <li>Go to the <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console Credentials page</a></li>
                <li>Find your API key and click "Edit"</li>
                <li>Under "Application restrictions", select "HTTP referrers"</li>
                <li>Add <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900 rounded">{typeof window !== 'undefined' ? window.location.origin + '/*' : 'your-domain.com/*'}</code> to the allowed referrers</li>
                <li>For local development, also add <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900 rounded">localhost/*</code></li>
              </ol>
            </div>
            <p className="text-sm text-muted-foreground">
              While developing locally, make sure localhost is in your allowed referrers list.
            </p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen p-4 bg-background">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Map</h1>
        <div className="ml-4 px-3 py-1.5 border rounded-md bg-muted/30">
          <a 
            href="https://www.google.com/maps" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-sm text-muted-foreground hover:text-primary flex items-center"
            onClick={openInGoogleMaps}
          >
            For full experience, use Google Maps
            <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </div>
      </div>

      <div id="search-container" className="mb-4 relative">
        <form onSubmit={handleSearch} className="flex space-x-2">
          <div className="relative flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="map-search-input"
              type="text"
              placeholder="Search locations..."
              className="pl-9"
              value={searchQuery}
              onChange={handleSearchChange}
              autoComplete="off"
              ref={autocompleteInputRef}
            />
            
            {/* Predictions dropdown */}
            {showPredictions && predictions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-60 overflow-auto">
                {/* Show search predictions */}
                {predictions.length > 0 && (
                  <>
                    {predictions.map((prediction) => (
                      <button
                        key={prediction.place_id}
                        type="button"
                        className="w-full text-left px-4 py-2 hover:bg-muted focus:bg-muted outline-none"
                        onClick={() => handlePlaceSelect(prediction.place_id)}
                      >
                        <div className="flex items-start">
                          <MapPin className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{prediction.structured_formatting?.main_text || prediction.description}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {prediction.structured_formatting?.secondary_text || ''}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <Button 
            type="button" 
            variant={isDroppingMarker ? "destructive" : "secondary"}
            title="Drop a pin on the map"
            onClick={toggleMarkerDrop}
            className="min-w-10"
          >
            <MapPinned size={16} className={isDroppingMarker ? "animate-pulse" : ""} />
          </Button>
          <Button type="submit">Search</Button>
        </form>
        
        {/* Helper message to guide users */}
        <div className="mt-2 text-xs text-muted-foreground text-center bg-muted/20 py-1 rounded-sm">
          Tip: Click on any place or point of interest on the map to see details and open in Google Maps
        </div>
      </div>

      {error ? (
        <div className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4 max-w-md text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-destructive font-medium">{error}</p>
            <p className="text-muted-foreground text-sm">
              Check your API key configuration and try refreshing the page.
            </p>
            <Button onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </div>
        </div>
      ) : (
        <Suspense fallback={<MapLoadingFallback />}>
          <div 
            id="map-container"
            className="flex-grow w-full rounded-lg border shadow-sm relative"
            style={{ minHeight: "500px" }}
          >
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                <div className="flex flex-col items-center space-y-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                  <p>Loading map...</p>
                </div>
              </div>
            )}
            
            {isDroppingMarker && (
              <div className="absolute top-4 left-0 right-0 mx-auto text-center z-20 bg-black/70 text-white py-2 px-4 rounded-full w-fit">
                Click on the map to drop a pin
              </div>
            )}
            
            {/* Current location button */}
            <div className="absolute bottom-4 right-4 z-10">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={getUserLocation}
                disabled={loading || isLocating}
                className="h-10 w-10 rounded-full shadow-md"
                title="Use my current location"
              >
                {isLocating ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                ) : (
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="h-5 w-5"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                  </svg>
                )}
              </Button>
            </div>
            
            {/* Location denied alert */}
            {locationDenied && (
              <div className="absolute bottom-16 left-4 right-4 mx-auto z-10 bg-amber-100 dark:bg-amber-900/80 p-3 rounded-md shadow-md max-w-xs">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Location access denied</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Enable location in your browser settings to use this feature.</p>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={mapRef} className="w-full h-full" />
          </div>
        </Suspense>
      )}
    </div>
  );
}
