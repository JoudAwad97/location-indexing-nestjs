import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SimulatorControlDto {
  @ApiProperty({ enum: ['start', 'stop'] })
  @IsIn(['start', 'stop'])
  action!: 'start' | 'stop';

  @ApiProperty({ example: 50, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  count?: number;

  @ApiProperty({ example: 1000, required: false, description: 'Tick interval in ms' })
  @IsOptional()
  @IsInt()
  @Min(250)
  @Max(60_000)
  intervalMs?: number;
}
