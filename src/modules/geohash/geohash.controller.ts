import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LocationInputDto } from '@/shared/contracts/dto/location-input.dto';
import { LocationRecord, NearbyResult } from '@/shared/contracts/location.types';
import { GeohashStrategy } from './geohash.strategy';
import { GeohashNearbyQueryDto } from './dto/geohash-nearby-query.dto';

@ApiTags('Geohash')
@Controller('api/geohash/locations')
export class GeohashController {
  constructor(private readonly strategy: GeohashStrategy) {}

  @Post()
  insert(@Body() dto: LocationInputDto): Promise<LocationRecord> {
    return this.strategy.insert(dto);
  }

  @Get('nearby')
  findNearby(@Query() q: GeohashNearbyQueryDto): Promise<NearbyResult> {
    return this.strategy.findNearby(q);
  }

  @Get(':id')
  async findById(@Param('id', new ParseUUIDPipe()) id: string): Promise<LocationRecord> {
    const r = await this.strategy.findById(id);
    if (!r) throw new NotFoundException();
    return r;
  }
}
