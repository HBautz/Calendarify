import { Injectable } from '@nestjs/common';

@Injectable()
export class IntegrationsService {
  connectGoogleMeet(data: any) {
    return { message: 'google meet integration stub', data };
  }

  connectZoom(data: any) {
    return { message: 'zoom integration stub', data };
  }
}
