import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  console.log('[SERVER DEBUG] Starting NestJS application...');
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({
    origin: (origin, cb) => cb(null, origin || true),
    credentials: true,
    methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
  });

  const config = new DocumentBuilder().setTitle('API').setVersion('1').build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  
  const port = process.env.PORT ?? 3001;
  console.log('[SERVER DEBUG] Listening on port:', port);
  // Quick diagnostics for Zoom OAuth environment
  console.log('[SERVER DEBUG] ZOOM_CLIENT_ID:', (process.env.ZOOM_CLIENT_ID || '').slice(0, 6) || 'missing');
  console.log('[SERVER DEBUG] ZOOM_REDIRECT_URI:', process.env.ZOOM_REDIRECT_URI || 'missing');
  console.log('[SERVER DEBUG] ZOOM_SCOPES:', process.env.ZOOM_SCOPES || 'default');
  await app.listen(port);
  console.log('[SERVER DEBUG] Server started successfully on port:', port);
}
bootstrap();
