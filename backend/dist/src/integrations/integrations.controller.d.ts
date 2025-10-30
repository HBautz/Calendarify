import { IntegrationsService } from './integrations.service';
export declare class IntegrationsController {
    private readonly integrationsService;
    constructor(integrationsService: IntegrationsService);
    googleAuthUrl(req: any): {
        url: string;
    };
    googleCallback(code: string, state: string, res: any): Promise<any>;
    googleEvents(req: any, timeMin?: string, timeMax?: string): Promise<{
        events: import("googleapis").calendar_v3.Schema$Event[];
    }>;
    googleStatus(req: any): Promise<{
        connected: boolean;
    }>;
    googleMeet(body: any): {
        message: string;
        data: any;
    };
    zoomAuthUrl(req: any): {
        url: string;
    };
    outlookAuthUrl(req: any): {
        url: string;
    };
    zoomStatus(req: any): Promise<{
        connected: boolean;
    }>;
    outlookStatus(req: any): Promise<{
        connected: boolean;
    }>;
    disconnectZoom(req: any): Promise<{
        message: string;
    }>;
    disconnectOutlook(req: any): Promise<{
        message: string;
    }>;
    connectApple(req: any, body: {
        email: string;
        password: string;
    }): Promise<{
        message: string;
    }>;
    appleStatus(req: any): Promise<{
        connected: boolean;
    }>;
    disconnectApple(req: any): Promise<{
        message: string;
    }>;
    appleCalendars(req: any): Promise<{
        calendars: {
            href: string;
            name: string;
        }[];
    }>;
    selectApple(req: any, selectedCalendars: string[]): Promise<{
        message: string;
    }>;
    disconnectGoogle(req: any): Promise<{
        message: string;
    }>;
    testZoomCallback(): {
        message: string;
        timestamp: string;
    };
    zoomCallback(code: string, state: string, error: string, res: any, req: any): Promise<any>;
    outlookCallback(req: any, res: any): Promise<any>;
}
