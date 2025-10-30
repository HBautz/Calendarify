"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
const cookieParser = require("cookie-parser");
async function bootstrap() {
    console.log('[SERVER DEBUG] Starting NestJS application...');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.enableCors({
        origin: (origin, cb) => cb(null, origin || true),
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });
    const config = new swagger_1.DocumentBuilder().setTitle('API').setVersion('1').build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('docs', app, document);
    const port = process.env.PORT ?? 3001;
    console.log('[SERVER DEBUG] Listening on port:', port);
    console.log('[SERVER DEBUG] ZOOM_CLIENT_ID:', (process.env.ZOOM_CLIENT_ID || '').slice(0, 6) || 'missing');
    console.log('[SERVER DEBUG] ZOOM_REDIRECT_URI:', process.env.ZOOM_REDIRECT_URI || 'missing');
    console.log('[SERVER DEBUG] ZOOM_SCOPES:', process.env.ZOOM_SCOPES || 'default');
    await app.listen(port);
    console.log('[SERVER DEBUG] Server started successfully on port:', port);
}
bootstrap();
//# sourceMappingURL=main.js.map