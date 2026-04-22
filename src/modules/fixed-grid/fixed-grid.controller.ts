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
import { NearbyQueryDto } from '@/shared/contracts/dto/nearby-query.dto';
import { LocationRecord, NearbyResult } from '@/shared/contracts/location.types';
import { FixedGridStrategy } from './fixed-grid.strategy';

@ApiTags('Fixed Grid')
@Controller('api/fixed-grid/locations')
export class FixedGridController {
  constructor(private readonly strategy: FixedGridStrategy) {}

  @Post()
  insert(@Body() dto: LocationInputDto): Promise<LocationRecord> {
    return this.strategy.insert(dto);
  }

  @Get('nearby')
  findNearby(@Query() q: NearbyQueryDto): Promise<NearbyResult> {
    return this.strategy.findNearby(q);
  }

  @Get(':id')
  async findById(@Param('id', new ParseUUIDPipe()) id: string): Promise<LocationRecord> {
    const r = await this.strategy.findById(id);
    if (!r) throw new NotFoundException();
    return r;
  }
}
