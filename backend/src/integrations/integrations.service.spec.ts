import { BadRequestException } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

describe('IntegrationsService - Apple Calendar', () => {
  let service: IntegrationsService;
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ email: 'test@example.com' }) },
    externalCalendar: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
  } as any;

  beforeEach(() => {
    service = new IntegrationsService(prisma);
    const okResponse = {
      status: 207,
      statusText: '',
      headers: { entries: () => [] as any[] },
      text: jest.fn().mockResolvedValue(
        '<D:multistatus xmlns:D="DAV:"><D:response><D:propstat><D:prop><D:current-user-principal><D:href>/principal/</D:href></D:current-user-principal></D:prop></D:propstat></D:response></D:multistatus>'
      ),
    };
    const okPrincipal = {
      ...okResponse,
      text: jest.fn().mockResolvedValue(
        '<D:multistatus xmlns:D="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav"><D:response><D:propstat><D:prop><cal:calendar-home-set><D:href>/home/</D:href></cal:calendar-home-set></D:prop></D:propstat></D:response></D:multistatus>'
      ),
    };
    (global as any).fetch = jest.fn().mockResolvedValueOnce(okResponse).mockResolvedValueOnce(okPrincipal);
  });

  it('stores credentials when valid', async () => {
    await service.connectAppleCalendar('user1', 'test@example.com', 'pass');
    expect((global as any).fetch).toHaveBeenCalledTimes(2);
    expect(prisma.externalCalendar.create).toHaveBeenCalledWith({
      data: {
        user_id: 'user1',
        provider: 'apple',
        external_id: 'test@example.com',
        password: 'pass',
      },
    });
  });

  it('throws BadRequestException for invalid credentials', async () => {
    const mockRes = (status: number) => ({
      status,
      statusText: '',
      headers: { entries: () => [] as any[] },
      text: jest.fn().mockResolvedValue(''),
    });
    for (const status of [401, 403, 404]) {
      (global as any).fetch = jest.fn().mockResolvedValue(mockRes(status));
      await expect(
        service.connectAppleCalendar('user1', 'bad@example.com', 'bad')
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });
});
