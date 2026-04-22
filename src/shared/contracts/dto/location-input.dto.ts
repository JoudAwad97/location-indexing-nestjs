import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LocationInputDto {
  @ApiProperty({ example: 'Philz Coffee', description: 'Display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'cafe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  category!: string;

  @ApiProperty({ example: 37.7749 })
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: -122.4194 })
  @IsLongitude()
  lng!: number;
}
