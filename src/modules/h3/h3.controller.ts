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
import { H3NearbyQueryDto } from './dto/h3-nearby-query.dto';
import { H3Strategy } from './h3.strategy';

@ApiTags('H3')
@Controller('api/h3/locations')
export class H3Controller {
  constructor(private readonly strategy: H3Strategy) {}

  @Post()
  insert(@Body() dto: LocationInputDto): Promise<LocationRecord> {
    return this.strategy.insert(dto);
  }

  // NOTE: /nearby MUST come before /:id to prevent NestJS treating "nearby" as a UUID param.
  @Get('nearby')
  findNearby(@Query() q: H3NearbyQueryDto): Promise<NearbyResult> {
    return this.strategy.findNearby(q);
  }

  @Get(':id')
  async findById(@Param('id', new ParseUUIDPipe()) id: string): Promise<LocationRecord> {
    const r = await this.strategy.findById(id);
    if (!r) throw new NotFoundException();
    return r;
  }
}
