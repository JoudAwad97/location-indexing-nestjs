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
import { ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { LocationInputDto } from '@/shared/contracts/dto/location-input.dto';
import { NearbyQueryDto } from '@/shared/contracts/dto/nearby-query.dto';
import { LocationRecord, NearbyResult } from '@/shared/contracts/location.types';
import { TwoDSearchService } from './two-d-search.service';
import { TwoDEngine } from './two-d-search.repository';

class TwoDNearbyQueryDto extends NearbyQueryDto {
  @ApiPropertyOptional({ enum: ['naive', 'postgis'], default: 'naive' })
  @IsOptional()
  @IsIn(['naive', 'postgis'])
  engine?: TwoDEngine;
}

@ApiTags('2D Search')
@Controller('api/two-d-search/locations')
export class TwoDSearchController {
  constructor(private readonly svc: TwoDSearchService) {}

  @Post()
  insert(@Body() dto: LocationInputDto): Promise<LocationRecord> {
    return this.svc.strategy.insert(dto);
  }

  @Get('nearby')
  findNearby(@Query() q: TwoDNearbyQueryDto): Promise<NearbyResult> {
    return this.svc.strategy.findNearby(q);
  }

  @Get(':id')
  async findById(@Param('id', new ParseUUIDPipe()) id: string): Promise<LocationRecord> {
    const found = await this.svc.strategy.findById(id);
    if (!found) throw new NotFoundException();
    return found;
  }
}
