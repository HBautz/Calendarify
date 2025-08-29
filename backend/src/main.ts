import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('[SERVER DEBUG] Starting NestJS application...');
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' });

  const config = new DocumentBuilder().setTitle('API').setVersion('1').build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  
  const port = process.env.PORT ?? 3001;
  console.log('[SERVER DEBUG] Listening on port:', port);
  await app.listen(port);
  console.log('[SERVER DEBUG] Server started successfully on port:', port);
}
bootstrap();
