import { BadRequestException } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

describe('IntegrationsService - Apple Calendar', () => {
  let service: IntegrationsService;
  const prisma = {
    externalCalendar: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
  } as any;

  beforeEach(() => {
    service = new IntegrationsService(prisma);
    (global as any).fetch = jest.fn().mockResolvedValue({ status: 207 });
  });

  it('stores credentials when valid', async () => {
    await service.connectAppleCalendar('user1', 'test@example.com', 'pass');
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
