# Calendar Module

Google Calendar integration for the CEO Dashboard with full calendar view capabilities and real-time event synchronization.

## Features

- **Full Calendar Views**: Month, Week, and Day views with seamless navigation
- **Google Calendar Integration**: Direct connection to user's Google Calendar with OAuth2 authentication
- **Multi-Calendar Support**: Display multiple Google calendars with color-coded events
- **Real-time Events**: Live synchronization with Google Calendar events
- **Responsive Design**: Mobile-friendly interface with theme support (light/dark mode)
- **Event Interaction**: Click events to open in Google Calendar

## Architecture

### Core Components

- **`page.tsx`**: Main calendar page with FullCalendar integration
- **`services/useGoogleToken.ts`**: Google OAuth token management service
- **`styles.css`**: Custom styling for calendar theming

### Service Layer

The calendar module uses a dedicated service hook `useGoogleToken` that follows the established pattern:

```typescript
export function useGoogleToken() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  // OAuth operations: exchangeOAuthCode, disconnectGoogle, getGoogleConnectionStatus, getGoogleToken
  return { exchangeOAuthCode, disconnectGoogle, getGoogleConnectionStatus, getGoogleToken, loading, error };
}
```

### External Dependencies

- **FullCalendar**: `@fullcalendar/react` with plugins for different views
- **Google Calendar Plugin**: `@fullcalendar/google-calendar` for direct Google Calendar integration
- **Date Utilities**: `date-fns` for date formatting and manipulation

## Configuration

### Environment Variables

```bash
NEXT_PUBLIC_GOOGLE_API_KEY=         # Google Calendar API key
NEXT_PUBLIC_BACKEND_API_DOMAIN=     # Backend API for token management
```

### Google Calendar Setup

1. Users must connect their Google account through Settings → Integrations
2. OAuth flow handled by backend API (`/user-google-tokens` endpoints)
3. Access tokens automatically refreshed by the service

## Usage

### Navigation

- **View Controls**: Switch between Month, Week, and Day views
- **Date Navigation**: Previous/Next buttons and "Today" quick access
- **Refresh**: Manual event refresh functionality

### Event Display

- **Color Coding**: Each Google calendar has distinct colors (Google Calendar palette)
- **Theme Adaptation**: Colors adjust automatically for light/dark themes
- **Event Details**: Click events to open in Google Calendar web interface

### Authentication Flow

1. User visits calendar page
2. System checks for valid Google token
3. If no token, redirect to Settings page for Google integration
4. Once connected, calendar loads user's Google Calendar events

## File Structure

```
app/calendar/
├── page.tsx              # Main calendar component
├── services/
│   └── useGoogleToken.ts # Google OAuth service hook
├── styles.css           # Custom calendar styling
└── README.md           # This documentation
```

## API Integration

### Backend Endpoints

- `GET /user-google-tokens/google/token` - Retrieve access token
- `GET /user-google-tokens/google/status` - Check connection status
- `POST /user-google-tokens/google/oauth/exchange` - Exchange OAuth code
- `DELETE /user-google-tokens/google/disconnect` - Disconnect integration

### Google Calendar API

- Calendar List API: Fetch user's calendars with metadata
- Events API: Retrieve calendar events with proper time ranges
- Real-time sync with 3-month forward event window

## Error Handling

- **Token Expiry**: Automatic token refresh with graceful fallback
- **API Failures**: Toast notifications for user feedback
- **Network Issues**: Retry logic and error state management
- **Missing Integration**: Clear guidance to connect Google Calendar

## Performance Optimizations

- **Event Batching**: Loads 2500 events max per calendar
- **Time Window**: 3-month event window to prevent excessive API calls
- **Caching**: FullCalendar handles event caching automatically
- **Lazy Loading**: Calendar only loads after authentication verification