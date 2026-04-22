import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Location Indexing NestJS')
    .setDescription(
      'Companion reference repo for the article on location indexing. Every module implements the same ProximityStrategy contract — compare 2D search, fixed grid, geohash, quadtree, S2, and H3 side by side.',
    )
    .setVersion('0.1.0')
    .build();

  const doc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, doc);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
