import { Module } from '@nestjs/common';
import { H3Controller } from './h3.controller';
import { H3Repository } from './h3.repository';
import { H3Strategy } from './h3.strategy';
import { DriversController } from './drivers/drivers.controller';
import { DriverPingsRepository } from './drivers/driver-pings.repository';
import { DriversListener } from './drivers/drivers.listener';
import { DriversSimulator } from './drivers/drivers.simulator';

@Module({
  controllers: [H3Controller, DriversController],
  providers: [H3Repository, H3Strategy, DriverPingsRepository, DriversSimulator, DriversListener],
  exports: [H3Strategy],
})
export class H3Module {}
