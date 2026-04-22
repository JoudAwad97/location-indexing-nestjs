import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsLatitude, IsLongitude, IsOptional, IsPositive, Max, Min } from 'class-validator';

export class NearbyQueryDto {
  @ApiProperty({ example: 37.7749 })
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: -122.4194 })
  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @ApiProperty({ example: 1000, description: 'Radius in meters' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(100_000)
  radiusMeters!: number;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({ example: 10, description: 'Expand search if result count is below this' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minResults?: number;
}
