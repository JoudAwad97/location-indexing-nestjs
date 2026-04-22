import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/shared/redis/tokens';

export const GEO_KEY = 'geo:locations';

export interface RedisGeoHit {
  member: string; // `${name}::${geohash_12}` as written by the seeder/dual-writer
  lng: number;
  lat: number;
  distanceMeters: number;
}

@Injectable()
export class GeohashRedisRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async upsert(loc: { name: string; lat: number; lng: number; geohash_12: string }): Promise<void> {
    await this.redis.geoadd(GEO_KEY, loc.lng, loc.lat, `${loc.name}::${loc.geohash_12}`);
  }

  async searchByRadius(
    lat: number,
    lng: number,
    radiusMeters: number,
    limit: number,
  ): Promise<RedisGeoHit[]> {
    const raw = (await this.redis.call(
      'GEOSEARCH',
      GEO_KEY,
      'FROMLONLAT',
      String(lng),
      String(lat),
      'BYRADIUS',
      String(radiusMeters),
      'm',
      'ASC',
      'COUNT',
      String(limit),
      'WITHCOORD',
      'WITHDIST',
    )) as Array<[string, string, [string, string]]>;

    return raw.map(([member, distance, [mLng, mLat]]) => ({
      member,
      distanceMeters: Number(distance),
      lat: Number(mLat),
      lng: Number(mLng),
    }));
  }
}
