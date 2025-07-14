import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/api/integrations/google-meet (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/integrations/google-meet')
      .send({ token: 'test' })
      .expect(201)
      .expect({ message: 'google meet integration stub', data: { token: 'test' } });
  });

  it('/api/integrations/zoom (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/integrations/zoom')
      .send({ token: 'test' })
      .expect(201)
      .expect({ message: 'zoom integration stub', data: { token: 'test' } });
  });
});
