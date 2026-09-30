import { ForbiddenException, Injectable } from '@nestjs/common';
import { LeadQueryDto } from './dto/lead-query.dto';
import { LeadQueryRepository } from './lead-query.repository';

@Injectable()
export class LeadQueryService {
  constructor(private repository: LeadQueryRepository) {}
  list(user: { id: string; role: string }, query: LeadQueryDto) {
    if (!user?.id || !['ADMIN', 'BROKER'].includes(user.role))
      throw new ForbiddenException('Broker access required.');
    return this.repository.list(
      user.id,
      user.role === 'ADMIN' ? null : user.id,
      query,
    );
  }
}
