import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '@/shared/config/config.service';
import { DriverPingsRepository } from './driver-pings.repository';

interface Driver {
  id: string;
  lat: number;
  lng: number;
}

@Injectable()
export class DriversSimulator {
  private readonly log = new Logger(DriversSimulator.name);
  private drivers: Driver[] = [];
  private handle: NodeJS.Timeout | null = null;

  constructor(
    private readonly repo: DriverPingsRepository,
    private readonly cfg: AppConfigService,
  ) {}

  isRunning(): boolean {
    return this.handle !== null;
  }
  driverCount(): number {
    return this.drivers.length;
  }

  start(count: number, intervalMs: number): void {
    if (this.handle) this.stop();
    const { minLat, maxLat, minLng, maxLng } = this.cfg.h3Simulator.bbox;
    this.drivers = Array.from({ length: count }, () => ({
      id: randomUUID(),
      lat: randomInRange(minLat, maxLat),
      lng: randomInRange(minLng, maxLng),
    }));
    this.log.log(`Simulator starting: drivers=${count} intervalMs=${intervalMs}`);
    this.handle = setInterval(() => void this.tick(), intervalMs);
  }

  stop(): void {
    if (this.handle) {
      clearInterval(this.handle);
      this.handle = null;
      this.log.log('Simulator stopped');
    }
  }

  private async tick(): Promise<void> {
    const stepDeg = 0.0005; // ~55m
    const { minLat, maxLat, minLng, maxLng } = this.cfg.h3Simulator.bbox;
    for (const d of this.drivers) {
      d.lat = clamp(d.lat + (Math.random() - 0.5) * stepDeg, minLat, maxLat);
      d.lng = clamp(d.lng + (Math.random() - 0.5) * stepDeg, minLng, maxLng);
      try {
        await this.repo.upsertPing({ driverId: d.id, lat: d.lat, lng: d.lng });
      } catch (err) {
        this.log.warn(`ping insert failed: ${(err as Error).message}`);
      }
    }
  }
}

function randomInRange(a: number, b: number): number {
  return a + (b - a) * Math.random();
}
function clamp(x: number, a: number, b: number): number {
  return Math.min(Math.max(x, a), b);
}
