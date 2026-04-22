import { Global, Module } from '@nestjs/common';
import { LoggerModule as PinoModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../config/config.service';

@Global()
@Module({
  imports: [
    PinoModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => ({
        pinoHttp: {
          level: cfg.logLevel,
          transport:
            cfg.nodeEnv === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          genReqId: (req): string => {
            const incoming = req.headers['x-request-id'];
            if (typeof incoming === 'string' && incoming.length > 0) return incoming;
            return randomUUID();
          },
          customProps: (req): Record<string, unknown> => ({ requestId: req.id }),
          redact: ['req.headers.authorization', 'req.headers.cookie'],
        },
      }),
    }),
  ],
  exports: [PinoModule],
})
export class AppLoggerModule {}
