import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { LocationInputDto } from '@/shared/contracts/dto/location-input.dto';
import { LocationRecord, NearbyResult } from '@/shared/contracts/location.types';
import { NearbyQueryDto } from '@/shared/contracts/dto/nearby-query.dto';
import { QuadtreeService } from './quadtree.service';
import { QuadtreeStrategy } from './quadtree.strategy';
import { BuildStats } from './algorithm/build';

@ApiTags('Quadtree')
@Controller('api/quadtree')
export class QuadtreeController {
  constructor(
    private readonly strategy: QuadtreeStrategy,
    private readonly tree: QuadtreeService,
  ) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  health(
    @Res({ passthrough: true }) res: Response,
  ): { ready: false } | { ready: true; stats: BuildStats | null } {
    if (!this.tree.ready) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).setHeader('Retry-After', '5');
      return { ready: false };
    }
    return { ready: true, stats: this.tree.stats };
  }

  @Post('locations')
  insert(@Body() dto: LocationInputDto): Promise<LocationRecord> {
    return this.strategy.insert(dto);
  }

  // NOTE: 'locations/nearby' MUST be declared before 'locations/:id' to avoid
  // "nearby" being captured as an :id param.
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
}
