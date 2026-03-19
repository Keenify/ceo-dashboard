# Google Maps Integration

This component integrates Google Maps into the CEO Dashboard application with the following features:

## Features

- Interactive Google Maps with search functionality
- Global place search and autocomplete with dropdown suggestions
- Performance-optimized with debounced searches
- Advanced marker placement with custom styling
- Open any location in Google Maps with a single click
- Current location detection
- Mobile-friendly responsive design
- Error handling for API key issues (billing, referrer restrictions)
- Dark mode compatible UI

## Setup Requirements

### Environment Variables

This component requires the following environment variables to be set:

```NEXT_PUBLIC_GOOGLE_API_KEY="your-google-maps-api-key"
NEXT_PUBLIC_GOOGLE_MAP_ID="your-map-id" (optional, for advanced markers styling)
```

### Google Cloud Console Setup

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the following APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
3. Create an API key with appropriate restrictions:
   - HTTP referrers: Add your domain and localhost for development
   - API restrictions: Limit to the APIs listed above
4. Enable billing on your Google Cloud account (a credit card is required, but Google provides $200 monthly credit which is sufficient for most applications)

### Map ID (Optional)

For custom map styling with the Advanced Markers feature:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to the Google Maps Platform > Map Management section
3. Create a new Map ID and customize the appearance
4. Add the Map ID to your environment variables

## Usage Notes

- The component will automatically adapt to available Google Maps API features with fallbacks for older browsers
- Search functionality uses debounced inputs for performance optimization
- Supports global search without country restrictions
- Clicking on any marker or location opens it in Google Maps
- Marker placement supports both the legacy and newer AdvancedMarkerElement APIs

## Performance Optimization

- Debounced search input to reduce API calls
- Lazy-loading map and API resources
- Automatic fallbacks for different Google API versions
- Image optimizations for markers and map elements

## Troubleshooting

Common issues:

1. **"Billing not enabled" error**: You need to enable billing in your Google Cloud Console
2. **"Referrer not allowed" error**: Add your domain to the API key restrictions
3. **Maps not loading**: Check browser console for specific API errors
4. **Location services not working**: User may need to enable location services in their browser

## Additional Resources

- [Google Maps JavaScript API Documentation](https://developers.google.com/maps/documentation/javascript)
- [Places API Documentation](https://developers.google.com/maps/documentation/places/web-service/overview)
- [Google Cloud Console](https://console.cloud.google.com/)
