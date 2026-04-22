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
import { Observable, fromEvent, map } from 'rxjs';
import { diskCells, encodeCell } from '../algorithm/cell';
import { DriverPingsRepository } from './driver-pings.repository';
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
    @Query('k') kRaw?: string,
  ): Promise<{
    center: string;
    k: number;
    cellCount: number;
    pings: Awaited<ReturnType<DriverPingsRepository['latestPingsNearCells']>>;
  }> {
    const k = kRaw ? Number(kRaw) : 1;
    const center = encodeCell(lat, lng);
    const cells = diskCells(center, k);
    const cellsAsBigint = cells.map((c) => BigInt(`0x${c}`).toString());
    const pings = await this.pings.latestPingsNearCells(cellsAsBigint, 500);
    return { center, k, cellCount: cells.length, pings };
  }
}
