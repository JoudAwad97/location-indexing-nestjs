import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';
import { EventEmitter } from 'node:events';
import { AppConfigService } from '@/shared/config/config.service';

export interface PingEvent {
  driver_id: string;
  lat: number;
  lng: number;
  h3_r9: string;
  seen_at: string;
}

@Injectable()
export class DriversListener extends EventEmitter implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(DriversListener.name);
  private client: Client | null = null;

  constructor(private readonly cfg: AppConfigService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // Dedicated Client — can't use the shared Pool because LISTEN is stateful.
    this.client = new Client({
      host: this.cfg.postgres.host,
      port: this.cfg.postgres.port,
      database: this.cfg.postgres.database,
      user: this.cfg.postgres.user,
      password: this.cfg.postgres.password,
    });
    await this.client.connect();
    this.client.on('notification', (msg) => {
      if (msg.channel !== 'driver_pings_channel' || !msg.payload) return;
      try {
        const evt = JSON.parse(msg.payload) as PingEvent;
        this.emit('ping', evt);
      } catch (err) {
        this.log.warn(`parse failed: ${(err as Error).message}`);
      }
    });
    await this.client.query('LISTEN driver_pings_channel');
    this.log.log('Listening on driver_pings_channel');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.query('UNLISTEN driver_pings_channel').catch(() => undefined);
      await this.client.end();
    }
  }
}
