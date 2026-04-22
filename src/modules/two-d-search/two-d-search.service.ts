import { Injectable } from '@nestjs/common';
import { TwoDSearchStrategy } from './two-d-search.strategy';

@Injectable()
export class TwoDSearchService {
  constructor(public readonly strategy: TwoDSearchStrategy) {}
}
