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
    const okResponse = {
      status: 207,
      statusText: '',
      headers: { entries: () => [] as any[] },
      text: jest.fn().mockResolvedValue(
        '<current-user-principal><href>/principal/</href></current-user-principal>'
      ),
    };
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce(okResponse)
      .mockResolvedValueOnce({ ...okResponse, text: jest.fn().mockResolvedValue('') });
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
