import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NearbyQueryDto } from '@/shared/contracts/dto/nearby-query.dto';
import { H3Engine } from '../h3.repository';

export class H3NearbyQueryDto extends NearbyQueryDto {
  @ApiPropertyOptional({ enum: ['h3-js', 'h3-pg'] })
  @IsOptional()
  @IsIn(['h3-js', 'h3-pg'])
  engine?: H3Engine;
}
