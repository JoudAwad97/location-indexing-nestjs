import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseFloatPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LocationInputDto } from '@/shared/contracts/dto/location-input.dto';
import { NearbyQueryDto } from '@/shared/contracts/dto/nearby-query.dto';
import { LocationRecord, NearbyResult } from '@/shared/contracts/location.types';
import { CreateGeofenceDto } from './dto/create-geofence.dto';
import { CoveringCell } from './algorithm/region-cover';
import { S2Strategy } from './s2.strategy';

@ApiTags('S2')
@Controller('api/s2')
export class S2Controller {
  constructor(private readonly strategy: S2Strategy) {}

  @Post('locations')
  insert(@Body() dto: LocationInputDto): Promise<LocationRecord> {
    return this.strategy.insert(dto);
  }

  // NOTE: /nearby MUST come before /:id to prevent NestJS from treating "nearby" as a UUID param.
  @Get('locations/nearby')
  findNearby(@Query() q: NearbyQueryDto): Promise<NearbyResult> {
    return this.strategy.findNearby(q);
  }

  @Get('locations/:id')
  async findById(@Param('id', new ParseUUIDPipe()) id: string): Promise<LocationRecord> {
    const r = await this.strategy.findById(id);
    if (!r) throw new NotFoundException();
    return r;
  }

  @Post('geofences')
  createGeofence(
    @Body() dto: CreateGeofenceDto,
  ): Promise<{ id: string; cellCount: number; levels: number[]; coveringSample: CoveringCell[] }> {
    return this.strategy.createGeofence(dto);
  }

  // NOTE: /match MUST come before /:id if a geofences/:id route were added.
  @Get('geofences/match')
  matchGeofences(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
  ): Promise<{ matches: string[]; candidatesChecked: number; levels: number[] }> {
    return this.strategy.matchPoint(lat, lng);
  }
}
