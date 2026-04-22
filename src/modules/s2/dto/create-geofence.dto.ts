import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, ValidateNested, IsArray, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class GeoJsonPolygonDto {
  @ApiProperty({ example: 'Polygon' })
  @IsString()
  @IsIn(['Polygon'])
  type!: 'Polygon';

  @ApiProperty({
    example: [
      [
        [-122.43, 37.77],
        [-122.41, 37.77],
        [-122.41, 37.79],
        [-122.43, 37.79],
        [-122.43, 37.77],
      ],
    ],
    description: 'GeoJSON ring(s). coordinates[0] is the outer ring, first = last.',
  })
  @IsArray()
  coordinates!: number[][][];
}

export class CreateGeofenceDto {
  @ApiProperty({ example: 'Downtown SF delivery zone' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ type: GeoJsonPolygonDto })
  @ValidateNested()
  @Type(() => GeoJsonPolygonDto)
  polygon!: GeoJsonPolygonDto;
}
