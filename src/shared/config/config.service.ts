import { Injectable } from '@nestjs/common';
import { AppConfig, loadConfig } from './config.schema';

@Injectable()
export class AppConfigService {
  private readonly config: AppConfig = loadConfig();

  get nodeEnv(): AppConfig['nodeEnv'] {
    return this.config.nodeEnv;
  }

  get port(): AppConfig['port'] {
    return this.config.port;
  }

  get logLevel(): AppConfig['logLevel'] {
    return this.config.logLevel;
  }

  get postgres(): AppConfig['postgres'] {
    return this.config.postgres;
  }

  get redis(): AppConfig['redis'] {
    return this.config.redis;
  }

  get quadtree(): AppConfig['quadtree'] {
    return this.config.quadtree;
  }

  get h3Simulator(): AppConfig['h3Simulator'] {
    return this.config.h3Simulator;
  }
}
