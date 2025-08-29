import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventTypesService } from '../event-types/event-types.service';
import { AvailabilityService } from '../availability/availability.service';
// import { IntegrationsService } from '../integrations/integrations.service';

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
}

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => EventTypesService))
    private eventTypesService: EventTypesService,
    private availabilityService: AvailabilityService,
    // private integrationsService: IntegrationsService
  ) {}

  async create(data: CreateBookingDto) {
    const booking = await this.prisma.booking.create({ 
      data,
      include: {
        event_type: true,
      },
    });
    
    // Create calendar events in all connected calendars
    // await this.createCalendarEvents(booking);
    
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
      },
    });

    // Create calendar events in all connected calendars
    // await this.createCalendarEvents(booking);

    // TODO: Add support for phone, company, and questions in a future update
    // For now, we'll store this data in the booking notes table
    // This requires fixing the Prisma client types

    return booking;
  }

  // private async createCalendarEvents(booking: any) {
  //   try {
  //     console.log('[CALENDAR] Creating calendar events for booking:', booking.id);
  //     
  //     // Get all connected calendars for the user
  //     const connectedCalendars = await this.prisma.externalCalendar.findMany({
  //       where: { user_id: booking.user_id },
  //     });

  //     console.log('[CALENDAR] Found connected calendars:', connectedCalendars.map(c => c.provider));

  //     // Create events in each connected calendar
  //     const eventPromises = connectedCalendars.map(async (calendar, index) => {
  //       const result = await this.createEventInCalendar(booking, calendar);
  //       
  //       // If this is a Zoom calendar and it created a meeting, update other calendars with the meeting link
  //       if (calendar.provider === 'zoom' && result && result.updatedEventData) {
  //         console.log('[CALENDAR] Zoom meeting created, updating other calendars with meeting link');
  //           
  //         // Create events in other calendars with the updated event data
  //         const otherCalendars = connectedCalendars.filter((_, i) => i !== index);
  //         const otherEventPromises = otherCalendars.map(otherCalendar => {
  //           const updatedEventData = result.updatedEventData;
  //           switch (otherCalendar.provider) {
  //             case 'google':
  //               return this.createGoogleCalendarEvent(otherCalendar, updatedEventData);
  //             case 'outlook':
  //               return this.createOutlookCalendarEvent(otherCalendar, updatedEventData);
  //             default:
  //               return Promise.resolve();
  //             }
  //           });
  //           
  //           await Promise.allSettled(otherEventPromises);
  //         }
  //         
  //         return result;
  //       });

  //       const results = await Promise.allSettled(eventPromises);
  //       
  //       // Log results
  //       results.forEach((result, index) => {
  //         const provider = connectedCalendars[index]?.provider;
  //         if (result.status === 'fulfilled') {
  //           console.log(`[CALENDAR] Successfully created event in ${provider}`);
  //         } else {
  //           console.error(`[CALENDAR] Failed to create event in ${provider}:`, result.reason);
  //         }
  //       });

  //     } catch (error) {
  //       console.error('[CALENDAR] Error creating calendar events:', error);
  //       // Don't throw - calendar creation failure shouldn't prevent booking creation
  //     }
  //   }

  // private async createEventInCalendar(booking: any, calendar: any) {
  //   const eventData = {
  //     summary: `${booking.event_type.title} with ${booking.name}`,
  //     description: `Meeting with ${booking.name} (${booking.email})\n\nEvent Type: ${booking.event_type.title}${booking.event_type.description ? '\n\n' + booking.event_type.description : ''}`,
  //     start: {
  //       dateTime: booking.starts_at.toISOString(),
  //       timeZone: 'UTC',
  //     },
  //     end: {
  //       dateTime: booking.ends_at.toISOString(),
  //       timeZone: 'UTC',
  //     },
  //     attendees: [
  //       { email: booking.email, displayName: booking.name }
  //     ],
  //   };

  //   switch (calendar.provider) {
  //     case 'google':
  //       return this.createGoogleCalendarEvent(calendar, eventData);
  //     case 'zoom':
  //       const zoomResult = await this.createZoomMeeting(calendar, eventData);
  //       // Use the updated event data for other calendars
  //       return { ...zoomResult, eventData: zoomResult.updatedEventData };
  //     case 'outlook':
  //       return this.createOutlookCalendarEvent(calendar, eventData);
  //     default:
  //       console.warn(`[CALENDAR] Unknown calendar provider: ${calendar.provider}`);
  //       return Promise.resolve();
  //   }
  // }

  // private async createGoogleCalendarEvent(calendar: any, eventData: any) {
  //   try {
  //     // Add Google Meet to the event
  //     const eventWithMeet = {
  //       ...eventData,
  //       conferenceData: {
  //         createRequest: {
  //           requestId: `meet-${Date.now()}`,
  //           conferenceSolutionKey: {
  //             type: 'hangoutsMeet'
  //           }
  //         }
  //       }
  //     };

  //     const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events`, {
  //       method: 'POST',
  //       headers: {
  //         'Authorization': `Bearer ${calendar.access_token}`,
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify(eventWithMeet),
  //     });

  //     if (!response.ok) {
  //       const errorText = await response.text();
  //       throw new Error(`Google Calendar API error: ${response.status} - ${errorText}`);
  //     }

  //     const result = await response.json();
  //     console.log('[CALENDAR] Google Calendar event created:', result.id);
  //     return result;
  //   } catch (error) {
  //     console.error('[CALENDAR] Google Calendar event creation failed:', error);
  //     throw error;
  //   }
  // }

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

  private async createOutlookCalendarEvent(calendar: any, eventData: any) {
    try {
      const outlookEventData = {
        subject: eventData.summary,
        body: {
          contentType: 'HTML',
          content: eventData.description.replace(/\n/g, '<br>'),
        },
        start: {
          dateTime: eventData.start.dateTime,
          timeZone: 'UTC',
        },
        end: {
          dateTime: eventData.end.dateTime,
          timeZone: 'UTC',
        },
        attendees: eventData.attendees.map((attendee: any) => ({
          emailAddress: {
            address: attendee.email,
            name: attendee.displayName,
          },
          type: 'required',
        })),
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

  findForUser(userId: string) {
    return this.prisma.booking.findMany({
      where: { user_id: userId },
      include: { 
        event_type: true,
        notes: true,
      },
      orderBy: { starts_at: 'asc' },
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
      // await this.deleteCalendarEvents(booking);
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
    // await this.updateCalendarEvents(updatedBooking);
    
    return updatedBooking;
  }

  // private async updateCalendarEvents(booking: any) {
  //   try {
  //     console.log('[CALENDAR] Updating calendar events for booking:', booking.id);
  //     
  //     // Get all connected calendars for the user
  //     const connectedCalendars = await this.prisma.externalCalendar.findMany({
  //       where: { user_id: booking.user_id },
  //     });

  //     console.log('[CALENDAR] Found connected calendars for update:', connectedCalendars.map(c => c.provider));

  //     // Update events in each connected calendar
  //     const eventPromises = connectedCalendars.map(calendar => 
  //       this.updateEventInCalendar(booking, calendar)
  //     );

  //     const results = await Promise.allSettled(eventPromises);
  //     
  //     // Log results
  //     results.forEach((result, index) => {
  //       const provider = connectedCalendars[index]?.provider;
  //       if (result.status === 'fulfilled') {
  //         console.log(`[CALENDAR] Successfully updated event in ${provider}`);
  //       } else {
  //         console.error(`[CALENDAR] Failed to update event in ${provider}:`, result.reason);
  //       }
  //     });

  //   } catch (error) {
  //     console.error('[CALENDAR] Error updating calendar events:', error);
  //     // Don't throw - calendar update failure shouldn't prevent booking update
  //   }
  // }

  // private async updateEventInCalendar(booking: any, calendar: any) {
  //   // For now, we'll just create a new event since we don't store external event IDs
  //   // In a production system, you'd want to store the external event IDs and update them
  //   return this.createEventInCalendar(booking, calendar);
  // }
}
