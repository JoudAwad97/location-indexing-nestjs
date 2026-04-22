import { ApiProperty } from '@nestjs/swagger';

export class NearbyResultItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() category!: string;
  @ApiProperty() lat!: number;
  @ApiProperty() lng!: number;
  @ApiProperty() distanceMeters!: number;
}

export class NearbyDiagnosticsDto {
  @ApiProperty() cellsQueried!: number;
  @ApiProperty() expansionSteps!: number;
  @ApiProperty({ required: false }) dbRowsExamined?: number;
  @ApiProperty() latencyMs!: number;
  @ApiProperty({ type: Object, required: false }) notes?: Record<string, unknown>;
}

export class NearbyResultDto {
  @ApiProperty() strategy!: string;
  @ApiProperty({ type: [NearbyResultItemDto] }) results!: NearbyResultItemDto[];
  @ApiProperty({ type: NearbyDiagnosticsDto }) diagnostics!: NearbyDiagnosticsDto;
}
