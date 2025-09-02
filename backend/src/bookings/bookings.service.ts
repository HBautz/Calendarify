import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventTypesService } from '../event-types/event-types.service';
import { AvailabilityService } from '../availability/availability.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { WorkflowExecutionService } from '../workflows/workflow-execution.service';

interface CreateBookingDto {
  event_type_id: string;
  user_id: string;
  name: string;
  email: string;
  starts_at: Date;
  ends_at: Date;
}

interface CreatePublicBookingDto {
  event_type_slug: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  starts_at: string;
  ends_at: string;
  questions?: any[];
  client_timezone?: string;
  client_offset_minutes?: number;
}

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => EventTypesService))
    private eventTypesService: EventTypesService,
    private availabilityService: AvailabilityService,
    private integrationsService: IntegrationsService,
    private workflowExecutionService: WorkflowExecutionService
  ) {}

  async create(data: CreateBookingDto) {
    const booking = await this.prisma.booking.create({ 
      data,
      include: {
        event_type: true,
      },
    });
    
    // Create calendar events in all connected calendars
    await this.createCalendarEvents(booking);
    
    return booking;
  }

  async createPublic(data: CreatePublicBookingDto) {
    // Find the event type by slug
    const eventType = await this.eventTypesService.findBySlug(data.event_type_slug);
    if (!eventType) {
      throw new Error('Event type not found');
    }

    // Parse requested times
    const startTime = new Date(data.starts_at);
    const endTime = new Date(data.ends_at);

    // Guard: ensure the requested slot is still available (prevents double booking)
    const isAvailable = await this.availabilityService.isSlotAvailable(
      eventType.userId,
      startTime,
      endTime,
      undefined,
      eventType.bufferBefore,
      eventType.bufferAfter
    );

    if (!isAvailable) {
      throw new Error('Selected time slot is not available');
    }

    // Enforce booking limit for the event type
    const limit = (eventType as any).bookingLimit;
    if (limit && typeof limit === 'object' && limit.count > 0) {
      const startWindow = new Date(startTime);
      startWindow.setHours(0, 0, 0, 0);
      let endWindow = new Date(startWindow);
      if (limit.period === 'week') {
        endWindow = new Date(startWindow.getTime() + 7 * 24 * 60 * 60000);
      } else {
        endWindow = new Date(startWindow.getTime() + 24 * 60 * 60000);
      }
      const count = await this.prisma.booking.count({
        where: {
          event_type_id: eventType.id,
          starts_at: { gte: startWindow },
          ends_at: { lt: endWindow },
        }
      });
      if (count >= limit.count) {
        throw new Error('Booking limit reached for this period');
      }
    }

    // Create the booking
    const booking = await this.prisma.booking.create({
      data: {
        event_type_id: eventType.id,
        user_id: eventType.userId,
        name: data.name,
        email: data.email,
        starts_at: startTime,
        ends_at: endTime,
      },
      include: {
        event_type: true,
        notes: true,
      },
    });

    // Trigger workflows for meeting scheduled
    try {
      await this.workflowExecutionService.onMeetingScheduled(
        eventType.userId,
        eventType.title,
        booking.id
      );
    } catch (error) {
      console.warn('[BOOKINGS] Failed to trigger workflows:', error);
    }

    // Determine chosen location from payload (optional)
    const chosenLocation = (data as any).chosen_location || null;

    // Persist attendee-provided context as notes for later display
    try {
      const notesPayload: any = {
        chosen_location: (data as any).chosen_location || null,
        phone: (data as any).phone || null,
        company: (data as any).company || null,
        questions: Array.isArray((data as any).questions) ? (data as any).questions : [],
      };
      const notesToCreate: { note: string }[] = [];
      // Store a compact machine-parsable summary
      notesToCreate.push({ note: `meta:${JSON.stringify(notesPayload)}` });
      // Also store a human-readable summary line
      const humanSummary = `Attendee details — Location: ${notesPayload.chosen_location || 'n/a'}; Phone: ${notesPayload.phone || 'n/a'}; Company: ${notesPayload.company || 'n/a'}`;
      notesToCreate.push({ note: humanSummary });

      if (notesToCreate.length) {
        await this.prisma.bookingNote.createMany({
          data: notesToCreate.map(n => ({ booking_id: booking.id, note: n.note })),
        });
      }
    } catch (e) {
      console.warn('[BOOKINGS] Failed to persist booking notes:', e);
    }

    // Create calendar events in all connected calendars
    await this.createCalendarEvents({
      ...booking,
      client_timezone: data.client_timezone,
      client_offset_minutes: data.client_offset_minutes,
      chosen_location: chosenLocation,
      // Attach locations from event type settings if present
      event_type: {
        ...booking.event_type,
        locations: (eventType as any).locations || [],
        customLocation: (eventType as any).customLocation || '',
        tags: (eventType as any).tags || [],
        addToContacts: (eventType as any).addToContacts === true,
      }
    });

    // TODO: Add support for phone, company, and questions in a future update
    // For now, we'll store this data in the booking notes table
    // This requires fixing the Prisma client types

    try {
      // If configured, upsert attendee into contacts and apply tags
      const addToContacts = (eventType as any).addToContacts === true || ((eventType as any).tags?.length > 0);
      if (addToContacts) {
        const existing = await this.prisma.contact.findFirst({ where: { user_id: eventType.userId, email: data.email } });
        const baseContact = {
          user_id: eventType.userId,
          name: data.name,
          email: data.email,
          phone: (data as any).phone || null,
          company: (data as any).company || null,
          notes: undefined as any,
          favorite: false,
        };
        let contactId: string;
        if (!existing) {
          const created = await this.prisma.contact.create({ data: baseContact });
          contactId = created.id;
        } else {
          const updateData: any = {};
          if (!existing.name && data.name) updateData.name = data.name;
          if (!existing.phone && (data as any).phone) updateData.phone = (data as any).phone;
          if (!existing.company && (data as any).company) updateData.company = (data as any).company;
          // Merge notes minimally by not touching existing notes
          if (Object.keys(updateData).length > 0) {
            await this.prisma.contact.update({ where: { id: existing.id }, data: updateData });
          }
          contactId = existing.id;
        }

        const tags: string[] = Array.isArray((eventType as any).tags) ? (eventType as any).tags : [];
        if (tags.length > 0) {
          for (const tagName of tags) {
            // Ensure tag exists and relation is created
            let tag = await this.prisma.tag.findFirst({ where: { user_id: eventType.userId, name: tagName } });
            if (!tag) {
              tag = await this.prisma.tag.create({ data: { user_id: eventType.userId, name: tagName } });
            }
            const rel = await this.prisma.contactTag.findFirst({ where: { contact_id: contactId, tag_id: tag.id } });
            if (!rel) {
              await this.prisma.contactTag.create({ data: { contact_id: contactId, tag_id: tag.id } });
              
              // IMPORTANT: Trigger workflows for automatically applied tags from event types
              // This ensures that workflows with "Tag Added" trigger work for auto-tags
              try {
                await this.workflowExecutionService.onTagAdded(eventType.userId, tagName, contactId);
                console.log(`[BOOKINGS] Triggered workflow execution for auto-applied tag "${tagName}"`);
              } catch (workflowError) {
                console.warn(`[BOOKINGS] Failed to trigger workflows for auto-applied tag "${tagName}":`, workflowError);
                // Don't fail the booking creation if workflow triggering fails
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[BOOKINGS] Failed to upsert contact or apply tags:', e);
    }

    return booking;
  }

  private async createCalendarEvents(booking: any) {
    try {
      console.log('[CALENDAR] Creating calendar events for booking:', booking.id);
      
      // Get all connected calendars for the user
      const connectedCalendars = await this.prisma.externalCalendar.findMany({
        where: { user_id: booking.user_id },
      });

      console.log('[CALENDAR] Found connected calendars:', connectedCalendars.map(c => c.provider));

      let zoomLink: string | null = null;
      let googleMeetLink: string | null = null;
      const chosenLocation: string | null = booking.chosen_location || null;
      
      console.log('[CALENDAR DEBUG] Chosen location:', chosenLocation);
      console.log('[CALENDAR DEBUG] Booking data:', {
        id: booking.id,
        chosen_location: booking.chosen_location,
        event_type: booking.event_type?.title
      });

      // Create events in each connected calendar
      const eventPromises = connectedCalendars.map(async (calendar, index) => {
        const result = await this.createEventInCalendar(booking, calendar);
        
        // If this is a Zoom calendar and it created a meeting, capture the link and update other calendars
        console.log('[CALENDAR DEBUG] Checking Zoom result:', {
          provider: calendar.provider,
          hasResult: !!result,
          hasJoinUrl: !!(result && result.join_url),
          joinUrl: result?.join_url
        });
        
        if (calendar.provider === 'zoom' && result && result.join_url) {
          zoomLink = result.join_url;
          console.log('[CALENDAR] Zoom meeting created with link:', zoomLink);
          
          // Create events in other calendars with the updated event data
          const otherCalendars = connectedCalendars.filter((_, i) => i !== index);
          const otherEventPromises = otherCalendars.map(otherCalendar => {
            const updatedEventData = result.updatedEventData;
            switch (otherCalendar.provider) {
              case 'google':
                return this.createGoogleCalendarEvent(otherCalendar, updatedEventData, booking);
              case 'outlook':
                return this.createOutlookCalendarEvent(otherCalendar, updatedEventData, booking);
              default:
                return Promise.resolve();
            }
          });
          
          await Promise.allSettled(otherEventPromises);
        }
        
        // If this is a Google calendar and it created a meet, capture the link
        if (calendar.provider === 'google' && result && result.meetLink) {
          googleMeetLink = result.meetLink;
          console.log('[CALENDAR] Google Meet created with link:', googleMeetLink);

          // If Google Meet was created, push description with Meet link to other calendars
          const otherCalendars = connectedCalendars.filter((_, i) => i !== index);
          const updatedEventData = {
            ...result.updatedEventData,
          };
          const otherEventPromises = otherCalendars.map(otherCalendar => {
            switch (otherCalendar.provider) {
              case 'google':
                return this.createGoogleCalendarEvent(otherCalendar, updatedEventData, booking);
              case 'outlook':
                return this.createOutlookCalendarEvent(otherCalendar, updatedEventData, booking);
              default:
                return Promise.resolve();
            }
          });
          await Promise.allSettled(otherEventPromises);
        }
        
        return result;
      });

      const results = await Promise.allSettled(eventPromises);
      
      // Log results
      results.forEach((result, index) => {
        const provider = connectedCalendars[index]?.provider;
        if (result.status === 'fulfilled') {
          console.log(`[CALENDAR] Successfully created event in ${provider}`);
        } else {
          console.error(`[CALENDAR] Failed to create event in ${provider}:`, result.reason);
        }
      });

      // Update the booking with meeting links if any were created
      const updateData: any = {};
      if (zoomLink) {
        updateData.zoom_link = zoomLink;
        console.log('[CALENDAR] Captured Zoom link:', zoomLink);
      }
      if (googleMeetLink) {
        updateData.google_meet_link = googleMeetLink;
        console.log('[CALENDAR] Captured Google Meet link:', googleMeetLink);
      }
      
      console.log('[CALENDAR DEBUG] Final update data:', updateData);
      console.log('[CALENDAR DEBUG] Booking ID for update:', booking.id);
      
      if (Object.keys(updateData).length > 0) {
        const updatedBooking = await this.prisma.booking.update({
          where: { id: booking.id },
          data: updateData
        });
        console.log('[CALENDAR] Updated booking with meeting links:', updateData);
        console.log('[CALENDAR DEBUG] Updated booking from database:', {
          id: updatedBooking.id,
          zoom_link: (updatedBooking as any).zoom_link,
          google_meet_link: (updatedBooking as any).google_meet_link
        });
      } else {
        console.log('[CALENDAR DEBUG] No meeting links to update');
      }

    } catch (error) {
      console.error('[CALENDAR] Error creating calendar events:', error);
      // Don't throw - calendar creation failure shouldn't prevent booking creation
    }
  }

  private async createEventInCalendar(booking: any, calendar: any) {
    // The booking times are stored in UTC, but we need to send them to Google Calendar
    // in the user's local timezone. Since we don't have the user's timezone on the server,
    // we'll send the times as UTC and let Google Calendar handle the display conversion.
    
    console.log('[CALENDAR DEBUG] Creating event with booking times:', {
      starts_at: booking.starts_at,
      ends_at: booking.ends_at,
      starts_at_iso: booking.starts_at.toISOString(),
      ends_at_iso: booking.ends_at.toISOString(),
      starts_at_local: new Date(booking.starts_at).toLocaleString(),
      ends_at_local: new Date(booking.ends_at).toLocaleString()
    });
    
    const eventData = {
      summary: `${booking.event_type.title} with ${booking.name}`,
      description: `Meeting with ${booking.name} (${booking.email})\n\nEvent Type: ${booking.event_type.title}${booking.event_type.description ? '\n\n' + booking.event_type.description : ''}`,
      start: {
        // Send ISO in UTC and let provider/viewer timezone handle display
        dateTime: booking.starts_at.toISOString(),
      },
      end: {
        dateTime: booking.ends_at.toISOString(),
      },
      attendees: [
        { email: booking.email, displayName: booking.name }
      ],
    };

    switch (calendar.provider) {
      case 'google':
        return this.createGoogleCalendarEvent(calendar, eventData, booking);
      case 'zoom':
        // Only create Zoom meeting if explicitly chosen
        if ((booking.chosen_location || '').toLowerCase() === 'zoom') {
          const zoomResult = await this.createZoomMeeting(calendar, eventData);
          // Use the updated event data for other calendars
          return { ...zoomResult, eventData: zoomResult.updatedEventData };
        }
        return { eventData };
      case 'outlook':
        return this.createOutlookCalendarEvent(calendar, eventData, booking);
      case 'apple':
        return this.createAppleCalendarEvent(calendar, eventData, booking);
      default:
        console.warn(`[CALENDAR] Unknown calendar provider: ${calendar.provider}`);
        return Promise.resolve();
    }
  }

  private async createGoogleCalendarEvent(calendar: any, eventData: any, booking?: any) {
    try {
      console.log('[CALENDAR DEBUG] Creating Google Calendar event with data (pre-tz):', {
        summary: eventData.summary,
        attendees: eventData.attendees,
        start: eventData.start,
        end: eventData.end
      });

      // Try to resolve the organizer's Google Calendar timezone and format start/end accordingly
      let calendarTimeZone: string | null = null;
      try {
        const tzRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/settings/timezone', {
          headers: { 'Authorization': `Bearer ${calendar.access_token}` }
        });
        if (tzRes.ok) {
          const tzJson = await tzRes.json();
          calendarTimeZone = tzJson?.value || null;
        } else {
          const txt = await tzRes.text();
          console.warn('[CALENDAR DEBUG] Failed to fetch calendar timezone:', tzRes.status, txt);
          
          // If token is expired, try to refresh it
          if (tzRes.status === 401) {
            console.log('[CALENDAR] Google token expired during timezone fetch, attempting refresh...');
            
            const refreshed = await this.integrationsService.refreshGoogleToken(calendar.user_id);
            if (refreshed) {
              console.log('[CALENDAR] Google token refreshed, retrying timezone fetch...');
              // Get the updated calendar record with fresh token
              const updatedCalendar = await this.prisma.externalCalendar.findFirst({
                where: { user_id: calendar.user_id, provider: 'google' },
              });
              
              if (updatedCalendar) {
                // Retry timezone fetch with fresh token
                const retryTzRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/settings/timezone', {
                  headers: { 'Authorization': `Bearer ${updatedCalendar.access_token}` }
                });
                if (retryTzRes.ok) {
                  const tzJson = await retryTzRes.json();
                  calendarTimeZone = tzJson?.value || null;
                  console.log('[CALENDAR] Google timezone fetched after token refresh:', calendarTimeZone);
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('[CALENDAR DEBUG] Error fetching calendar timezone:', e);
      }

      const formatInTimeZone = (d: Date, tz: string) => {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).formatToParts(d);
        const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
        const yyyy = part('year');
        const mm = part('month');
        const dd = part('day');
        const hh = part('hour');
        const mi = part('minute');
        const ss = part('second');
        return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
      };

      let finalEventBody = eventData;
      const clientTimezone: string | undefined = booking?.client_timezone;
      const chosenTimeZone = calendarTimeZone || clientTimezone || null;
      if (chosenTimeZone) {
        // Build event times as local wall time in the calendar's time zone, with explicit timeZone
        const startLocal = formatInTimeZone(new Date(eventData.start.dateTime), chosenTimeZone);
        const endLocal = formatInTimeZone(new Date(eventData.end.dateTime), chosenTimeZone);
        finalEventBody = {
          ...eventData,
          start: { dateTime: startLocal, timeZone: chosenTimeZone },
          end: { dateTime: endLocal, timeZone: chosenTimeZone }
        };
      }

      console.log('[CALENDAR DEBUG] Timezone selection:', {
        calendarTimeZone,
        clientTimezone,
        chosenTimeZone
      });
      console.log('[CALENDAR DEBUG] Final event data being sent to Google (post-tz):', JSON.stringify(finalEventBody, null, 2));

      // Validate attendee email
      if (!finalEventBody.attendees || finalEventBody.attendees.length === 0) {
        console.warn('[CALENDAR DEBUG] No attendees found, removing attendees from event');
        delete finalEventBody.attendees;
      } else {
        // Filter out invalid emails
        const validAttendees = finalEventBody.attendees.filter((attendee: any) => {
          const isValid = attendee.email && attendee.email.includes('@') && attendee.email.length > 3;
          if (!isValid) {
            console.warn('[CALENDAR DEBUG] Invalid attendee email:', attendee.email);
          }
          return isValid;
        });
        
        if (validAttendees.length === 0) {
          console.warn('[CALENDAR DEBUG] No valid attendees found, removing attendees from event');
          delete finalEventBody.attendees;
        } else {
          finalEventBody.attendees = validAttendees;
        }
      }

      // Add Google Meet to the event ONLY if chosen_location is google-meet
      const shouldCreateMeet = (booking?.chosen_location || '').toLowerCase() === 'google-meet';
      const baseEvent = { ...finalEventBody };
      const eventWithMeet = shouldCreateMeet
        ? {
            ...finalEventBody,
            conferenceData: {
              createRequest: {
                requestId: `meet-${Date.now()}`,
                conferenceSolutionKey: {
                  type: 'hangoutsMeet'
                }
              }
            },
            guestsCanModify: false,
            guestsCanInviteOthers: false,
            guestsCanSeeOtherGuests: true,
            conferenceDataVersion: 1
          }
        : baseEvent;

      console.log('[CALENDAR DEBUG] Sending Google Calendar event with Meet:', JSON.stringify(eventWithMeet, null, 2));

      const url = shouldCreateMeet
        ? `https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1`
        : `https://www.googleapis.com/calendar/v3/calendars/primary/events`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${calendar.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventWithMeet),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // If token is expired, try to refresh it
        if (response.status === 401) {
          console.log('[CALENDAR] Google token expired, attempting refresh...');
          
          const refreshed = await this.integrationsService.refreshGoogleToken(calendar.user_id);
          if (refreshed) {
            console.log('[CALENDAR] Google token refreshed, retrying event creation...');
            // Get the updated calendar record with fresh token
            const updatedCalendar = await this.prisma.externalCalendar.findFirst({
              where: { user_id: calendar.user_id, provider: 'google' },
            });
            
            if (updatedCalendar) {
              // Retry with fresh token
              const retryResponse = await fetch(url, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${updatedCalendar.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventWithMeet),
              });

              if (!retryResponse.ok) {
                const retryErrorText = await retryResponse.text();
                throw new Error(`Google Calendar API error after refresh: ${retryResponse.status} - ${retryErrorText}`);
              }

              const result = await retryResponse.json();
              console.log('[CALENDAR] Google Calendar event created after token refresh:', result.id);
              
              // Extract Google Meet link if available
              let meetLink = null;
              if (shouldCreateMeet && result.conferenceData) {
                if (result.conferenceData.entryPoints) {
                  const meetEntry = result.conferenceData.entryPoints.find((entry: any) => entry.entryPointType === 'video');
                  if (meetEntry) {
                    meetLink = meetEntry.uri;
                    console.log('[CALENDAR] Google Meet link found after refresh:', meetLink);
                  }
                }
              }
              
              const updatedEventData = meetLink
                ? { ...eventData, description: `${eventData.description}\n\nGoogle Meet Link: ${meetLink}` }
                : eventData;

              return { ...result, meetLink, updatedEventData };
            }
          }
        }
        
        throw new Error(`Google Calendar API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('[CALENDAR] Google Calendar event created:', result.id);
      console.log('[CALENDAR DEBUG] Full Google Calendar response:', JSON.stringify(result, null, 2));
      
      // Extract Google Meet link if available
      let meetLink = null;
      if (shouldCreateMeet && result.conferenceData) {
        console.log('[CALENDAR DEBUG] Conference data found:', JSON.stringify(result.conferenceData, null, 2));
        if (result.conferenceData.entryPoints) {
          console.log('[CALENDAR DEBUG] Entry points found:', result.conferenceData.entryPoints.length);
          const meetEntry = result.conferenceData.entryPoints.find((entry: any) => entry.entryPointType === 'video');
          if (meetEntry) {
            meetLink = meetEntry.uri;
            console.log('[CALENDAR] Google Meet link found:', meetLink);
          } else {
            console.log('[CALENDAR DEBUG] No video entry point found in entryPoints');
          }
        } else {
          console.log('[CALENDAR DEBUG] No entryPoints in conferenceData');
        }
      } else {
        if (shouldCreateMeet) {
          console.log('[CALENDAR DEBUG] No conferenceData in response');
        }
      }
      
      const updatedEventData = meetLink
        ? { ...eventData, description: `${eventData.description}\n\nGoogle Meet Link: ${meetLink}` }
        : eventData;

      return { ...result, meetLink, updatedEventData };
    } catch (error) {
      console.error('[CALENDAR] Google Calendar event creation failed:', error);
      throw error;
    }
  }

  private async createZoomMeeting(calendar: any, eventData: any) {
    try {
      const zoomMeetingData = {
        topic: eventData.summary,
        type: 2, // Scheduled meeting
        start_time: eventData.start.dateTime,
        duration: Math.round((new Date(eventData.end.dateTime).getTime() - new Date(eventData.start.dateTime).getTime()) / 60000),
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true,
          mute_upon_entry: false,
          watermark: false,
          use_pmi: false,
          approval_type: 0,
          audio: 'both',
          auto_recording: 'none',
        },
      };

      const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${calendar.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(zoomMeetingData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // If token is expired, try to refresh it
        if (response.status === 401) {
          console.log('[CALENDAR] Zoom token expired, attempting refresh...');
          
          const refreshed = await this.integrationsService.refreshZoomToken(calendar.user_id);
          if (refreshed) {
            console.log('[CALENDAR] Zoom token refreshed, retrying meeting creation...');
            // Get the updated calendar record with fresh token
            const updatedCalendar = await this.prisma.externalCalendar.findFirst({
              where: { user_id: calendar.user_id, provider: 'zoom' },
            });
            
            if (updatedCalendar) {
              // Retry with fresh token
              const retryResponse = await fetch('https://api.zoom.us/v2/users/me/meetings', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${updatedCalendar.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(zoomMeetingData),
              });

              if (!retryResponse.ok) {
                const retryErrorText = await retryResponse.text();
                throw new Error(`Zoom API error after refresh: ${retryResponse.status} - ${retryErrorText}`);
              }

              const result = await retryResponse.json();
              console.log('[CALENDAR] Zoom meeting created after token refresh:', result.id);
              
              // Update the event description to include the Zoom meeting link
              const updatedEventData = {
                ...eventData,
                description: `${eventData.description}\n\nZoom Meeting Link: ${result.join_url}`,
              };

              return { ...result, updatedEventData };
            }
          }
        }
        
        throw new Error(`Zoom API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('[CALENDAR] Zoom meeting created:', result.id);
      
      // Update the event description to include the Zoom meeting link
      const updatedEventData = {
        ...eventData,
        description: `${eventData.description}\n\nZoom Meeting Link: ${result.join_url}`,
      };

      // Create the event in other calendars with the updated description
      return { ...result, updatedEventData };
    } catch (error) {
      console.error('[CALENDAR] Zoom meeting creation failed:', error);
      throw error;
    }
  }

  private async createOutlookCalendarEvent(calendar: any, eventData: any, booking?: any) {
    try {
      console.log('[CALENDAR DEBUG] Creating Outlook Calendar event with data (pre-tz):', {
        summary: eventData.summary,
        attendees: eventData.attendees,
        start: eventData.start,
        end: eventData.end
      });

      // Try to get the user's timezone from Microsoft Graph
      let userTimeZone: string | null = null;
      try {
        const tzRes = await fetch('https://graph.microsoft.com/v1.0/me/mailboxSettings', {
          headers: { 'Authorization': `Bearer ${calendar.access_token}` }
        });
        if (tzRes.ok) {
          const tzJson = await tzRes.json();
          userTimeZone = tzJson?.timeZone || null;
        } else {
          console.warn('[CALENDAR DEBUG] Failed to fetch Outlook timezone:', tzRes.status);
          
          // If token is expired, try to refresh it
          if (tzRes.status === 401) {
            console.log('[CALENDAR] Outlook token expired during timezone fetch, attempting refresh...');
            
            const refreshed = await this.integrationsService.refreshOutlookToken(calendar.user_id);
            if (refreshed) {
              console.log('[CALENDAR] Outlook token refreshed, retrying timezone fetch...');
              // Get the updated calendar record with fresh token
              const updatedCalendar = await this.prisma.externalCalendar.findFirst({
                where: { user_id: calendar.user_id, provider: 'outlook' },
              });
              
              if (updatedCalendar) {
                // Retry timezone fetch with fresh token
                const retryTzRes = await fetch('https://graph.microsoft.com/v1.0/me/mailboxSettings', {
                  headers: { 'Authorization': `Bearer ${updatedCalendar.access_token}` }
                });
                if (retryTzRes.ok) {
                  const tzJson = await retryTzRes.json();
                  userTimeZone = tzJson?.timeZone || null;
                  console.log('[CALENDAR] Outlook timezone fetched after token refresh:', userTimeZone);
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('[CALENDAR DEBUG] Error fetching Outlook timezone:', e);
      }

      const formatInTimeZone = (d: Date, tz: string) => {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).formatToParts(d);
        const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
        const yyyy = part('year');
        const mm = part('month');
        const dd = part('day');
        const hh = part('hour');
        const mi = part('minute');
        const ss = part('second');
        return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
      };

      let finalEventData = eventData;
      const clientTimezone: string | undefined = booking?.client_timezone;
      const chosenTimeZone = userTimeZone || clientTimezone || 'UTC';
      
      if (chosenTimeZone !== 'UTC') {
        // Build event times as local wall time in the chosen time zone
        const startLocal = formatInTimeZone(new Date(eventData.start.dateTime), chosenTimeZone);
        const endLocal = formatInTimeZone(new Date(eventData.end.dateTime), chosenTimeZone);
        finalEventData = {
          ...eventData,
          start: { dateTime: startLocal, timeZone: chosenTimeZone },
          end: { dateTime: endLocal, timeZone: chosenTimeZone }
        };
      }

      console.log('[CALENDAR DEBUG] Timezone selection:', {
        userTimeZone,
        clientTimezone,
        chosenTimeZone
      });
      console.log('[CALENDAR DEBUG] Final event data being sent to Outlook (post-tz):', JSON.stringify(finalEventData, null, 2));

      // Validate attendee email
      if (!finalEventData.attendees || finalEventData.attendees.length === 0) {
        console.warn('[CALENDAR DEBUG] No attendees found, removing attendees from event');
        delete finalEventData.attendees;
      } else {
        // Filter out invalid emails
        const validAttendees = finalEventData.attendees.filter((attendee: any) => {
          const isValid = attendee.email && attendee.email.includes('@') && attendee.email.length > 3;
          if (!isValid) {
            console.warn('[CALENDAR DEBUG] Invalid attendee email:', attendee.email);
          }
          return isValid;
        });
        
        if (validAttendees.length === 0) {
          console.warn('[CALENDAR DEBUG] No valid attendees found, removing attendees from event');
          delete finalEventData.attendees;
        } else {
          finalEventData.attendees = validAttendees;
        }
      }

      const outlookEventData = {
        subject: finalEventData.summary,
        body: {
          contentType: 'HTML',
          content: finalEventData.description.replace(/\n/g, '<br>'),
        },
        start: {
          dateTime: finalEventData.start.dateTime,
          timeZone: finalEventData.start.timeZone || 'UTC',
        },
        end: {
          dateTime: finalEventData.end.dateTime,
          timeZone: finalEventData.end.timeZone || 'UTC',
        },
        ...(finalEventData.attendees && {
          attendees: finalEventData.attendees.map((attendee: any) => ({
            emailAddress: {
              address: attendee.email,
              name: attendee.displayName,
            },
            type: 'required',
          })),
        }),
        // Add Teams meeting if available
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness',
      };

      const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${calendar.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(outlookEventData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // If token is expired, try to refresh it
        if (response.status === 401) {
          console.log('[CALENDAR] Outlook token expired, attempting refresh...');
          
          const refreshed = await this.integrationsService.refreshOutlookToken(calendar.user_id);
          if (refreshed) {
            console.log('[CALENDAR] Outlook token refreshed, retrying event creation...');
            // Get the updated calendar record with fresh token
            const updatedCalendar = await this.prisma.externalCalendar.findFirst({
              where: { user_id: calendar.user_id, provider: 'outlook' },
            });
            
            if (updatedCalendar) {
              // Retry with fresh token
              const retryResponse = await fetch('https://graph.microsoft.com/v1.0/me/events', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${updatedCalendar.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(outlookEventData),
              });

              if (!retryResponse.ok) {
                const retryErrorText = await retryResponse.text();
                throw new Error(`Outlook API error after refresh: ${retryResponse.status} - ${retryErrorText}`);
              }

              const result = await retryResponse.json();
              console.log('[CALENDAR] Outlook Calendar event created after token refresh:', result.id);
              return result;
            }
          }
        }
        
        console.error('[CALENDAR DEBUG] Outlook API error response:', response.status, errorText);
        throw new Error(`Outlook API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('[CALENDAR] Outlook Calendar event created:', result.id);
      return result;
    } catch (error) {
      console.error('[CALENDAR] Outlook Calendar event creation failed:', error);
      throw error;
    }
  }

  private async createAppleCalendarEvent(calendar: any, eventData: any, booking?: any) {
    try {
      console.log('[CALENDAR] Creating Apple Calendar event:', {
        summary: eventData.summary,
        start: eventData.start.dateTime,
        end: eventData.end.dateTime,
        calendar: calendar.external_id
      });

      // Check if we have the required credentials
      if (!calendar.password) {
        throw new Error('Apple Calendar password not found. Please reconnect your Apple Calendar.');
      }

      // Apple iCloud CalDAV requires proper discovery workflow
      const auth = 'Basic ' + Buffer.from(`${calendar.external_id}:${calendar.password}`).toString('base64');
      const headers = {
        'Depth': '0',
        'Authorization': auth,
        'Content-Type': 'application/xml',
        'User-Agent': 'calendarify-caldav',
        'Accept': 'application/xml,text/xml;q=0.9,*/*;q=0.8',
      };

      // Step 1: Get principal URL
      const principalUrl = await this.getApplePrincipalUrl(headers);
      if (!principalUrl) {
        throw new Error('Could not discover Apple Calendar principal URL');
      }

      // Step 2: Get calendar home URL
      const calendarHomeUrl = await this.getAppleCalendarHomeUrl(principalUrl, headers);
      if (!calendarHomeUrl) {
        throw new Error('Could not discover Apple Calendar home URL');
      }

      // Step 3: Build target calendar URL list (use all selected calendars or fallback)
      const selectedCalendars = (calendar.selected_calendars as string[]) || [];
      const targetCalendarUrls: string[] = [];

      if (selectedCalendars.length > 0) {
        for (let calendarUrl of selectedCalendars) {
          // Normalize to absolute URL
          if (calendarUrl.startsWith('/')) {
            calendarUrl = 'https://caldav.icloud.com' + calendarUrl;
          }
          // If user selected the calendars root (e.g., main calendar presented as /calendars or /calendars/),
          // map it to the actual home calendar collection.
          const trimmed = calendarUrl.replace(/\/$/, '');
          if (trimmed.endsWith('/calendars')) {
            const normalizedHome = (calendarHomeUrl.endsWith('/') ? calendarHomeUrl : calendarHomeUrl + '/') + 'home/';
            targetCalendarUrls.push(normalizedHome);
          } else {
            targetCalendarUrls.push(calendarUrl);
          }
        }
      } else {
        // Fallback to the old method (first available calendar)
        const fallback = await this.getAppleTargetCalendarUrl(calendarHomeUrl, calendar.selected_calendar, headers);
        if (fallback) targetCalendarUrls.push(fallback);
      }

      if (targetCalendarUrls.length === 0) {
        throw new Error('Could not find target Apple Calendar');
      }

      // Create iCalendar event data
      const icsEvent = this.createICSEvent(eventData, booking);

      // Step 4: Create the event in each selected calendar using CalDAV PUT
      const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const results: { calendarUrl: string; ok: boolean; status?: number; errorText?: string }[] = [];

      for (const baseUrl of targetCalendarUrls) {
        const normalizedBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
        const eventUrl = `${normalizedBase}${eventId}.ics`;
        try {
          const response = await fetch(eventUrl, {
            method: 'PUT',
            headers: {
              'Authorization': auth,
              'Content-Type': 'text/calendar; charset=utf-8',
              'If-None-Match': '*',
            },
            body: icsEvent,
          });
          if (!response.ok) {
            const errorText = await response.text();
            console.error('[CALENDAR] Apple Calendar API error:', response.status, errorText, 'for', eventUrl);
            results.push({ calendarUrl: baseUrl, ok: false, status: response.status, errorText });
          } else {
            console.log('[CALENDAR] Apple Calendar event created successfully in:', baseUrl, 'event:', eventId);
            results.push({ calendarUrl: baseUrl, ok: true });
          }
        } catch (e: any) {
          console.error('[CALENDAR] Apple Calendar network error for', eventUrl, e);
          results.push({ calendarUrl: baseUrl, ok: false, errorText: String(e) });
        }
      }

      // If at least one succeeded, report success but include details
      const anySuccess = results.some(r => r.ok);
      if (!anySuccess) {
        throw new Error('Apple Calendar event creation failed for all selected calendars: ' + JSON.stringify(results));
      }

      return { id: eventId, success: true, results };
    } catch (error) {
      console.error('[CALENDAR] Apple Calendar event creation failed:', error);
      throw error;
    }
  }

  private async getApplePrincipalUrl(headers: any): Promise<string | null> {
    const bodyRoot = `<?xml version="1.0" encoding="UTF-8"?>\n<propfind xmlns="DAV:">\n  <prop><current-user-principal/></prop>\n</propfind>`;
    const res = await fetch('https://caldav.icloud.com/', {
      method: 'PROPFIND',
      headers,
      body: bodyRoot,
    });
    if (![207].includes(res.status)) return null;
    const text = await res.text();
    const m = text.match(/<[^>]*current-user-principal[^>]*>\s*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i);
    if (!m) return null;
    let principalUrl = m[1].trim();
    if (principalUrl.startsWith('/')) principalUrl = 'https://caldav.icloud.com' + principalUrl;
    return principalUrl;
  }

  private async getAppleCalendarHomeUrl(principalUrl: string, headers: any): Promise<string | null> {
    const bodyPrincipal = `<?xml version="1.0" encoding="UTF-8"?>\n<propfind xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">\n  <prop><cal:calendar-home-set/></prop>\n</propfind>`;
    const res = await fetch(principalUrl, {
      method: 'PROPFIND',
      headers,
      body: bodyPrincipal,
    });
    if (![207].includes(res.status)) return null;
    const text = await res.text();
    const m = text.match(/<[^>]*calendar-home-set[^>]*>\s*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i);
    if (!m) return null;
    let homeUrl = m[1].trim();
    if (homeUrl.startsWith('/')) homeUrl = 'https://caldav.icloud.com' + homeUrl;
    return homeUrl;
  }

  private async getAppleTargetCalendarUrl(calendarHomeUrl: string, selectedCalendar: string | null, headers: any): Promise<string | null> {
    const bodyCals = `<?xml version="1.0" encoding="UTF-8"?>\n<propfind xmlns="DAV:">\n  <prop><displayname/></prop>\n</propfind>`;
    const res = await fetch(calendarHomeUrl, {
      method: 'PROPFIND',
      headers: {...headers, Depth: '1'},
      body: bodyCals,
    });
    if (res.status !== 207) return null;
    const text = await res.text();
    
    // Parse calendar list
    const calendars: {href: string, name: string}[] = [];
    const regex = /<response[^>]*>.*?<href>([^<]+)<\/href>.*?<displayname[^>]*>([^<]*)<\/displayname>/gs;
    let m;
    while ((m = regex.exec(text))) {
      calendars.push({ href: m[1], name: m[2] });
    }
    
    // Find the target calendar
    if (selectedCalendar) {
      const target = calendars.find(cal => cal.name === selectedCalendar);
      if (target) {
        let calendarUrl = target.href;
        if (calendarUrl.startsWith('/')) calendarUrl = 'https://caldav.icloud.com' + calendarUrl;
        return calendarUrl;
      }
    }
    
    // Fallback to first available calendar
    if (calendars.length > 0) {
      let calendarUrl = calendars[0].href;
      if (calendarUrl.startsWith('/')) calendarUrl = 'https://caldav.icloud.com' + calendarUrl;
      return calendarUrl;
    }
    
    return null;
  }

  private createICSEvent(eventData: any, booking?: any): string {
    const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startDate = new Date(eventData.start.dateTime);
    const endDate = new Date(eventData.end.dateTime);
    
    // Get timezone information
    const clientTimezone = booking?.client_timezone;
    const clientOffset = booking?.client_offset_minutes;
    
    // Format dates for iCalendar with timezone handling
    const formatDate = (date: Date, timezone?: string) => {
      if (timezone) {
        // Format as local time with timezone
        const formatInTimeZone = (d: Date, tz: string) => {
          const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
          }).formatToParts(d);
          const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
          const yyyy = part('year');
          const mm = part('month');
          const dd = part('day');
          const hh = part('hour');
          const mi = part('minute');
          const ss = part('second');
          return `${yyyy}${mm}${dd}T${hh}${mi}${ss}`;
        };
        
        const localTime = formatInTimeZone(date, timezone);
        return `${localTime}`;
      } else {
        // Fallback to UTC
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      }
    };

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Calendarify//Calendar Integration//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${eventId}`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART${clientTimezone ? `;TZID=${clientTimezone}` : ''}:${formatDate(startDate, clientTimezone)}`,
      `DTEND${clientTimezone ? `;TZID=${clientTimezone}` : ''}:${formatDate(endDate, clientTimezone)}`,
      `SUMMARY:${eventData.summary}`,
      `DESCRIPTION:${eventData.description.replace(/\n/g, '\\n')}`,
      ...(eventData.attendees ? eventData.attendees.map((attendee: any) => 
        `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=${attendee.displayName}:mailto:${attendee.email}`
      ) : []),
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    return ics;
  }

  findForUser(userId: string) {
    return this.prisma.booking.findMany({
      where: { user_id: userId },
      include: { 
        event_type: true,
        notes: true,
      },
      orderBy: { starts_at: 'asc' }, // soonest -> latest
    });
  }

  async remove(id: string) {
    // Get the booking before deleting it so we can clean up calendar events
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { event_type: true },
    });

    if (booking) {
      // Delete calendar events in all connected calendars
      await this.deleteCalendarEvents(booking);
    }

    return this.prisma.booking.delete({ where: { id } });
  }

  private async deleteCalendarEvents(booking: any) {
    try {
      console.log('[CALENDAR] Deleting calendar events for booking:', booking.id);
      
      // Get all connected calendars for the user
      const connectedCalendars = await this.prisma.externalCalendar.findMany({
        where: { user_id: booking.user_id },
      });

      console.log('[CALENDAR] Found connected calendars for deletion:', connectedCalendars.map(c => c.provider));

      // Note: In a production system, you'd want to store external event IDs
      // and delete the specific events. For now, we'll just log that deletion
      // would happen here.
      
      connectedCalendars.forEach(calendar => {
        console.log(`[CALENDAR] Would delete event in ${calendar.provider} (external event ID not stored)`);
      });

    } catch (error) {
      console.error('[CALENDAR] Error deleting calendar events:', error);
      // Don't throw - calendar deletion failure shouldn't prevent booking deletion
    }
  }

  async update(id: string, data: { start: string; end: string }) {
    console.log('[DEBUG] Updating booking:', { id, data });
    
    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: {
        starts_at: new Date(data.start),
        ends_at: new Date(data.end),
      },
      include: { event_type: true },
    });
    
    console.log('[DEBUG] Updated booking result:', updatedBooking);
    
    // Update calendar events in all connected calendars
    await this.updateCalendarEvents(updatedBooking);
    
    return updatedBooking;
  }

  private async updateCalendarEvents(booking: any) {
    try {
      console.log('[CALENDAR] Updating calendar events for booking:', booking.id);
      
      // Get all connected calendars for the user
      const connectedCalendars = await this.prisma.externalCalendar.findMany({
        where: { user_id: booking.user_id },
      });

      console.log('[CALENDAR] Found connected calendars for update:', connectedCalendars.map(c => c.provider));

      // Update events in each connected calendar
      const eventPromises = connectedCalendars.map(calendar => 
        this.updateEventInCalendar(booking, calendar)
      );

      const results = await Promise.allSettled(eventPromises);
      
      // Log results
      results.forEach((result, index) => {
        const provider = connectedCalendars[index]?.provider;
        if (result.status === 'fulfilled') {
          console.log(`[CALENDAR] Successfully updated event in ${provider}`);
        } else {
          console.error(`[CALENDAR] Failed to update event in ${provider}:`, result.reason);
        }
      });

    } catch (error) {
      console.error('[CALENDAR] Error updating calendar events:', error);
      // Don't throw - calendar update failure shouldn't prevent booking update
    }
  }

  private async updateEventInCalendar(booking: any, calendar: any) {
    // For now, we'll just create a new event since we don't store external event IDs
    // In a production system, you'd want to store the external event IDs and update them
    return this.createEventInCalendar(booking, calendar);
  }
}
