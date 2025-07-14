import { Injectable } from '@nestjs/common';
import { UserStateService } from '../users/user-state.service';

@Injectable()
export class IntegrationsService {
  constructor(private state: UserStateService) {}

  async activate(userId: string, provider: string) {
    const current = await this.state.load(userId);
    const key = `calendarify-integration-${provider}`;
    const updated = { ...current, [key]: true };
    await this.state.save(userId, updated);
    return { provider, active: true };
  }
}
