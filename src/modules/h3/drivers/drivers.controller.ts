import {
  Body,
  Controller,
  Get,
  MessageEvent,
  ParseFloatPipe,
  ParseIntPipe,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UNITS, getHexagonEdgeLengthAvg } from 'h3-js';
import { Observable, fromEvent, map } from 'rxjs';
import { haversineMeters } from '@/shared/geo/haversine';
import { H3_RES_POINT, diskCells, encodeCell } from '../algorithm/cell';
import { MAX_K, initialKForRadius } from '../algorithm/expand';
import { DriverPingsRepository, DriverPing } from './driver-pings.repository';
import { DriversListener, PingEvent } from './drivers.listener';
import { DriversSimulator } from './drivers.simulator';
import { SimulatorControlDto } from './dto/simulator-control.dto';

@ApiTags('H3')
@Controller('api/h3/drivers')
export class DriversController {
  constructor(
    private readonly sim: DriversSimulator,
    private readonly listener: DriversListener,
    private readonly pings: DriverPingsRepository,
  ) {}

  @Post('simulate')
  control(@Body() dto: SimulatorControlDto): { running: boolean; drivers?: number } {
    if (dto.action === 'stop') {
      this.sim.stop();
      return { running: false };
    }
    this.sim.start(dto.count ?? 50, dto.intervalMs ?? 1000);
    return { running: true, drivers: this.sim.driverCount() };
  }

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return fromEvent(this.listener, 'ping').pipe(
      map((evt) => ({ data: evt as PingEvent }) as MessageEvent),
    );
  }

  @Get('nearby')
  async nearby(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('radiusMeters', ParseIntPipe) radiusMeters: number,
    @Query('limit') limitRaw?: string,
  ): Promise<{
    center: string;
    initialK: number;
    finalK: number;
    cellsQueried: number;
    expansionSteps: number;
    pings: Array<DriverPing & { distanceMeters: number }>;
  }> {
    const limit = limitRaw ? Math.min(Math.max(Number(limitRaw), 1), 500) : 50;
    const edgeMeters = getHexagonEdgeLengthAvg(H3_RES_POINT, UNITS.m);
    const center = encodeCell(lat, lng);
    const initialK = initialKForRadius(radiusMeters, edgeMeters);

    // gridDisk expansion: honour the radius-driven initial k, then widen by up
    // to MAX_K additional steps when the result set is sparse. A caller asking
    // for a large radius (e.g. 20 km) already produces a wide disk; the MAX_K
    // cap bounds *extra* expansion rather than the initial query size.
    let k = initialK;
    let expansionSteps = 0;
    let candidates: DriverPing[] = [];
    const expansionCap = initialK + MAX_K;
    while (true) {
      const cells = diskCells(center, k);
      const cellsAsBigint = cells.map((c) => BigInt(`0x${c}`).toString());
      candidates = await this.pings.latestPingsNearCells(cellsAsBigint, limit * 4);
      if (candidates.length >= limit || k >= expansionCap) break;
      k += 1;
      expansionSteps += 1;
    }

    const pings = candidates
      .map((p) => ({
        ...p,
        distanceMeters: haversineMeters({ lat, lng }, { lat: p.lat, lng: p.lng }),
      }))
      .filter((p) => p.distanceMeters <= radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);

    return {
      center,
      initialK,
      finalK: k,
      cellsQueried: 3 * k * (k + 1) + 1,
      expansionSteps,
      pings,
    };
  }
}
