import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NearbyQueryDto } from '@/shared/contracts/dto/nearby-query.dto';
import { GeohashEngine } from '../geohash.strategy';

export class GeohashNearbyQueryDto extends NearbyQueryDto {
  @ApiPropertyOptional({ enum: ['postgres', 'redis'] })
  @IsOptional()
  @IsIn(['postgres', 'redis'])
  engine?: GeohashEngine;
}
