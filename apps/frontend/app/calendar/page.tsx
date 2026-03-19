"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useGoogleToken } from './services/useGoogleToken';
import { supabase } from '@/lib/supabase';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import googleCalendarPlugin from '@fullcalendar/google-calendar';
import listPlugin from '@fullcalendar/list';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { useTheme } from 'next-themes';
import { format } from 'date-fns';

// Import custom styles
import './styles.css';

// Add FullCalendar types for event handlers
import { ViewMountArg, DatesSetArg, EventClickArg, DayCellMountArg, EventMountArg } from '@fullcalendar/core';

const CalendarPage = () => {
  const router = useRouter();
  const { getGoogleToken, loading, error } = useGoogleToken();
  const [calendarApi, setCalendarApi] = useState<any>(null);
  const [view, setView] = useState('dayGridMonth'); // Default view is month
  const [accessToken, setAccessToken] = useState('');
  const calendarRef = useRef<FullCalendar | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [apiKeyLoading, setApiKeyLoading] = useState(true);
  const [currentTitle, setCurrentTitle] = useState('');
  const [calendars, setCalendars] = useState<{id: string, name: string, backgroundColor?: string, textColor?: string}[]>([]);
  const { theme } = useTheme();

  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

  // Get current user using Supabase
  useEffect(() => {
    const getUser = async () => {
      setAuthLoading(true);
      const { data, error } = await supabase.auth.getUser();
      
      if (error || !data?.user) {
        router.push("/login");
        return;
      }
      
      setUser(data.user);
      setAuthLoading(false);
    };
    getUser();
  }, [router]);

  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
      // Properly clean up the calendar instance when unmounting
      if (calendarRef.current) {
        try {
          const api = calendarRef.current.getApi();
          // Using any to avoid TypeScript error with destroy method
          (api as any).destroy();
        } catch (err) {
          console.error('Error destroying calendar', err);
        }
      }
    };
  }, []);

  // Google Calendar color palette (similar to Google Calendar) with better contrast
  const googleColors = {
    light: [
      { bg: '#4285F4', text: '#FFFFFF' }, // Blue (primary)
      { bg: '#0B8043', text: '#FFFFFF' }, // Green
      { bg: '#D50000', text: '#FFFFFF' }, // Red
      { bg: '#F4511E', text: '#FFFFFF' }, // Orange
      { bg: '#8E24AA', text: '#FFFFFF' }, // Purple
      { bg: '#3F51B5', text: '#FFFFFF' }, // Indigo
      { bg: '#009688', text: '#FFFFFF' }, // Teal
      { bg: '#7986CB', text: '#FFFFFF' }, // Light Blue
      { bg: '#33B679', text: '#FFFFFF' }, // Light Green
      { bg: '#E67C73', text: '#FFFFFF' }, // Light Red
      { bg: '#F6BF26', text: '#000000' }, // Yellow
      { bg: '#039BE5', text: '#FFFFFF' }, // Cyan
    ],
    dark: [
      { bg: '#5E97F6', text: '#FFFFFF' }, // Blue (primary) - brighter for dark mode
      { bg: '#33B679', text: '#FFFFFF' }, // Green - brighter for dark mode
      { bg: '#E67C73', text: '#FFFFFF' }, // Red - brighter for dark mode
      { bg: '#F6BF26', text: '#000000' }, // Yellow - brighter for dark mode
      { bg: '#8E24AA', text: '#FFFFFF' }, // Purple
      { bg: '#7986CB', text: '#FFFFFF' }, // Light Blue
      { bg: '#039BE5', text: '#FFFFFF' }, // Cyan
      { bg: '#FF8A65', text: '#000000' }, // Light Orange
      { bg: '#4DB6AC', text: '#000000' }, // Light Teal
      { bg: '#F06292', text: '#FFFFFF' }, // Pink
      { bg: '#9575CD', text: '#FFFFFF' }, // Light Purple
      { bg: '#FF7043', text: '#FFFFFF' }, // Deep Orange
    ]
  };

  // Fetch Google calendars and token
  const fetchCalendarsAndToken = useCallback(async (token: string) => {
    try {
      // Fetch user's calendar list
      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch calendars: ${response.status}`);
      }
      
      const data = await response.json();
      const currentColorPalette = theme === 'dark' ? googleColors.dark : googleColors.light;
      
      const calendarsList = data.items.map((item: any, index: number) => {
        const colorIndex = index % currentColorPalette.length;
        return {
          id: item.id,
          name: item.summary,
          backgroundColor: item.backgroundColor || currentColorPalette[colorIndex].bg,
          textColor: item.foregroundColor || currentColorPalette[colorIndex].text
        };
      });
      
      setCalendars(calendarsList);
      console.log(`Loaded ${calendarsList.length} calendars`);
    } catch (error) {
      console.error('Error fetching calendars:', error);
      toast.error('Failed to load Google Calendars');
    }
  }, [theme]);

  // Fetch Google access token directly
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchToken = async () => {
      setApiKeyLoading(true);
      try {
        const tokenResponse = await getGoogleToken(user.id);
        if (tokenResponse?.access_token) {
          const token = tokenResponse.access_token;
          setAccessToken(token);
          await fetchCalendarsAndToken(token);
          toast.success('Calendar loaded successfully');
        } else {
          toast.error('Failed to load calendar access token');
        }
      } catch (err) {
        console.error('Error fetching Google token:', err);
        toast.error('Failed to load Google Calendar');
      } finally {
        setApiKeyLoading(false);
      }
    };
    
    fetchToken();
  }, [user, getGoogleToken, fetchCalendarsAndToken]);

  // Update colors when theme changes
  useEffect(() => {
    if (accessToken && calendars.length > 0) {
      fetchCalendarsAndToken(accessToken);
    }
  }, [theme, accessToken, fetchCalendarsAndToken]);

  const handleDateNavigate = (direction: 'prev' | 'next' | 'today') => {
    if (!calendarApi) return;
    
    try {
      if (direction === 'prev') {
        calendarApi.prev();
      } else if (direction === 'next') {
        calendarApi.next();
      } else if (direction === 'today') {
        calendarApi.today();
      }
      
      // Update title after navigation
      if (calendarApi.view) {
        setCurrentTitle(calendarApi.view.title);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      toast.error('Failed to navigate calendar');
    }
  };

  const handleViewChange = (newView: string) => {
    if (!calendarApi) return;
    
    try {
      // Keep the current date range when changing views
      const currentDate = calendarApi.getDate();
      
      setView(newView);
      calendarApi.changeView(newView);
      
      // Ensure we're looking at the same date after view change
      calendarApi.gotoDate(currentDate);
      
      // Update title after view change
      if (calendarApi.view) {
        setCurrentTitle(calendarApi.view.title);
      }
    } catch (error) {
      console.error('View change error:', error);
      toast.error('Failed to change view');
    }
  };

  const refreshEvents = () => {
    if (calendarApi) {
      calendarApi.refetchEvents();
      toast.success('Calendar events refreshed');
    }
  };

  // Create event sources with proper colors from Google Calendar API
  const createEventSources = () => {
    if (!accessToken || calendars.length === 0) {
      return [];
    }
    
    // Create an event source for each calendar with proper colors
    return calendars.map(calendar => ({
      googleCalendarId: calendar.id,
      className: `google-calendar-${calendar.id.replace('@', '-')}`,
      eventDataTransform: (event: any) => {
        // For list view, store the color in extendedProps for the dot
        event.extendedProps = event.extendedProps || {};
        event.extendedProps.dotColor = calendar.backgroundColor;
        
        // Only remove background in list view
        if (view === 'listMonth') {
          event.backgroundColor = 'transparent';
          event.borderColor = 'transparent';
        } else {
          event.backgroundColor = calendar.backgroundColor;
          event.borderColor = calendar.backgroundColor;
        }
        return event;
      },
      color: calendar.backgroundColor, // This will be overridden for list view
      textColor: calendar.textColor || '#FFFFFF',
      extraParams: {
        access_token: accessToken,
        singleEvents: true,
        timeMin: new Date().toISOString(),
        timeMax: new Date(new Date().getFullYear(), new Date().getMonth() + 3, 0).toISOString(),
        maxResults: 2500,
        orderBy: 'startTime'
      }
    }));
  };

  // Utility function to detect light colors that need dark text
  const isLightColor = (hexColor: string) => {
    // Convert hex to RGB
    let r = 0, g = 0, b = 0;
    if (hexColor.startsWith('#')) {
      r = parseInt(hexColor.slice(1, 3), 16);
      g = parseInt(hexColor.slice(3, 5), 16);
      b = parseInt(hexColor.slice(5, 7), 16);
    } else if (hexColor.startsWith('rgb')) {
      const rgbMatch = hexColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (rgbMatch) {
        r = parseInt(rgbMatch[1], 10);
        g = parseInt(rgbMatch[2], 10);
        b = parseInt(rgbMatch[3], 10);
      }
    }
    
    // Calculate brightness (HSP formula)
    const brightness = Math.sqrt(
      0.299 * (r * r) +
      0.587 * (g * g) +
      0.114 * (b * b)
    );
    
    // Return true if the color is light (needs dark text)
    return brightness > 170;
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <div className="p-8 text-center">Redirecting to login...</div>;
  }

  if (!isMounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading calendar...</p>
      </div>
    );
  }

  if (apiKeyLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p>Loading your calendar...</p>
        </div>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <Calendar size={64} className="mx-auto text-gray-400" />
          <h1 className="text-2xl font-bold">Google Calendar Not Connected</h1>
          <p className="text-gray-500">
            Please connect your Google Calendar in the settings page.
          </p>
          <Button 
            onClick={() => router.push('/settings?tab=integrations')}
            className="mt-4"
          >
            Go to Settings
          </Button>
          {error && <p className="text-red-500 mt-2">{error.message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 h-screen flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => handleDateNavigate('today')}>
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDateNavigate('prev')}>
            <ChevronLeft size={18} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDateNavigate('next')}>
            <ChevronRight size={18} />
          </Button>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-semibold whitespace-nowrap">
              {currentTitle || 'Calendar'}
            </h1>
            <div className="ml-4 px-3 py-1.5 border rounded-md bg-muted/30">
              <a 
                href="https://calendar.google.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-sm text-muted-foreground hover:text-primary flex items-center"
              >
                For full experience, use Google Calendar
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </div>
          </div>
        </div>
        <div className="flex space-x-2 items-center">
          <Button variant={view === 'dayGridMonth' ? 'secondary' : 'ghost'} onClick={() => handleViewChange('dayGridMonth')} className="px-3 py-1.5 h-auto text-sm">Month</Button>
          <Button variant={view === 'timeGridWeek' ? 'secondary' : 'ghost'} onClick={() => handleViewChange('timeGridWeek')} className="px-3 py-1.5 h-auto text-sm">Week</Button>
          <Button variant={view === 'timeGridDay' ? 'secondary' : 'ghost'} onClick={() => handleViewChange('timeGridDay')} className="px-3 py-1.5 h-auto text-sm">Day</Button>
          
          <Button onClick={refreshEvents} variant="ghost" size="icon" title="Refresh">
            <RefreshCw size={18} />
          </Button>
        </div>
      </div>

      <div className="flex-grow calendar-container">
        {accessToken && (
          <FullCalendar
            ref={calendarRef}
            plugins={[
              dayGridPlugin,
              timeGridPlugin,
              interactionPlugin,
              googleCalendarPlugin,
              listPlugin
            ]}
            headerToolbar={false}
            initialView={view}
            googleCalendarApiKey={googleApiKey}
            eventSources={createEventSources()}
            height="100%"
            editable={false}
            selectable={true}
            dayMaxEvents={true}
            weekends={true}
            nowIndicator={true}
            navLinks={true}
            fixedWeekCount={false}
            eventTimeFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: 'short'
            }}
            views={{
              dayGridMonth: {
                dayMaxEventRows: 4, // Show "more" link after 4 events
                showNonCurrentDates: false, // Hide days from other months
              },
              timeGridWeek: {
                allDaySlot: true,
                slotMinTime: '00:00:00',
                slotMaxTime: '24:00:00',
              },
              timeGridDay: {
                allDaySlot: true,
                slotMinTime: '00:00:00',
                slotMaxTime: '24:00:00',
              }
            }}
            viewDidMount={(info: ViewMountArg) => {
              setCalendarApi(info.view.calendar);
              setView(info.view.type);
              setCurrentTitle(info.view.title);
              
              // Add theme-specific classes
              const calendarEl = info.el;
              if (theme === 'dark') {
                calendarEl.classList.add('dark-theme');
              } else {
                calendarEl.classList.remove('dark-theme');
              }

              // Add a class to the view harness for custom styling
              if (info.view.type === 'listMonth') {
                const viewHarness = info.el.closest('.fc-view-harness');
                if (viewHarness) {
                  viewHarness.classList.add('fc-list-view-harness');
                }
              }
            }}
            datesSet={(info: DatesSetArg) => {
              setCurrentTitle(info.view.title);
              // Only update the view state if it's different
              if (info.view.type !== view) {
                setView(info.view.type);
              }
            }}
            eventClick={(info: EventClickArg) => {
              info.jsEvent.preventDefault();
              if (info.event.url) {
                window.open(info.event.url, '_blank');
              }
            }}
            eventSourceFailure={(error: Error) => {
              console.error('Event source failed:', error);
              toast.error('Failed to load calendar events: ' + error.message);
            }}
            moreLinkClick="day" // When "more" is clicked, show day view
            dayCellDidMount={(info: DayCellMountArg) => {
              // Add today class to highlight today
              if (info.date.toDateString() === new Date().toDateString()) {
                info.el.classList.add('fc-day-today');
              }
              
              // Apply theme-specific styling
              if (theme === 'dark') {
                info.el.classList.add('dark-cell');
              }
            }}
            eventDidMount={(info: EventMountArg) => {
              // Only make changes for list view
              if (view === 'listMonth') {
                // 1. Set background to transparent for all events
                (info.el as HTMLElement).style.backgroundColor = 'transparent';
                
                // 2. Handle custom date display for first events of each day
                // First, we need to determine if this is the first event of a day
                const eventDate = info.event.start ? info.event.start.toDateString() : '';
                const prevEl = info.el.previousSibling as Element;
                let isFirstEventOfDay = true;
                
                // Check if previous element is from same day
                if (prevEl && typeof prevEl.querySelector === 'function') {
                  const prevElTime = prevEl.getAttribute('data-date');
                  if (prevElTime === eventDate) {
                    isFirstEventOfDay = false;
                  }
                }
                
                // Store event date as an attribute on the element
                info.el.setAttribute('data-date', eventDate);
                
                // 3. Add custom styling for first event of the day
                if (isFirstEventOfDay) {
                  // Add class to mark as first event
                  info.el.classList.add('first-event');
                  
                  // Extract day information
                  const date = info.event.start;
                  if (date) {
                    const dayNum = date.getDate();
                    // Use date-fns for consistent date formatting
                    const dayName = format(date, 'EEEE'); // Full weekday name
                    const monthDay = format(date, 'MMMM d'); // Month and day
                    
                    // Create day number element (circle with number)
                    const dayNumberEl = document.createElement('div');
                    dayNumberEl.classList.add('day-number');
                    dayNumberEl.textContent = dayNum.toString();
                    info.el.appendChild(dayNumberEl);
                    
                    // Create day info element (Thursday May 1)
                    const dayInfoEl = document.createElement('div');
                    dayInfoEl.classList.add('day-info');
                    
                    const dayNameSpan = document.createElement('span');
                    dayNameSpan.classList.add('day-name');
                    dayNameSpan.textContent = dayName;
                    dayInfoEl.appendChild(dayNameSpan);
                    
                    const dayMonthSpan = document.createElement('span');
                    dayMonthSpan.classList.add('day-month');
                    dayMonthSpan.textContent = monthDay;
                    dayInfoEl.appendChild(dayMonthSpan);
                    
                    info.el.appendChild(dayInfoEl);
                  }
                  
                  // Store the date number for the dot (used in CSS)
                  const dot = info.el.querySelector('.fc-list-event-graphic');
                  if (dot && date) {
                    dot.setAttribute('data-date', date.getDate().toString());
                  }
                }
                
                // 4. Handle all-day events
                if (info.event.allDay) {
                  const timeEl = info.el.querySelector('.fc-list-event-time');
                  if (timeEl) {
                    timeEl.textContent = '';
                    timeEl.classList.add('all-day');
                  }
                }
                
                // 5. Style the event dot with calendar color
                const dot = info.el.querySelector('.fc-list-event-dot');
                if (dot) {
                  const dotEl = dot as HTMLElement;
                  if (info.event.extendedProps?.dotColor) {
                    dotEl.style.borderColor = info.event.extendedProps.dotColor;
                  }
                }
              }
              
              // Add theme-specific classes
              if (theme === 'dark') {
                info.el.classList.add('dark-event');
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

export default CalendarPage;
