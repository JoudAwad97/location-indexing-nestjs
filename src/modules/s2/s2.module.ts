import { Module } from '@nestjs/common';
import { S2Controller } from './s2.controller';
import { S2Repository } from './s2.repository';
import { S2Strategy } from './s2.strategy';

@Module({
  controllers: [S2Controller],
  providers: [S2Repository, S2Strategy],
  exports: [S2Strategy],
})
export class S2Module {}
