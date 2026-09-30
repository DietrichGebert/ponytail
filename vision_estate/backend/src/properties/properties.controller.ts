import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, AuthRequest, OptionalStaffGuard } from '../auth';
import { CreatePropertyDto } from './dto/create-property.dto';
import { LeadQueryDto } from './dto/lead-query.dto';
import { LeadUpdateDto } from './dto/lead-update.dto';
import { PropertyWorkflowService } from './property-workflow-service';
@Controller('v1')
export class PropertiesController {
  constructor(private application: PropertyWorkflowService) {}
  @Post('properties')
  create(
    @Body() dto: CreatePropertyDto,
    @Headers('idempotency-key') key: string,
    @Headers('x-assessment-token') token: string,
    @Req() req: Request,
  ) {
    return this.application.create(dto, key, token, req.ip || '');
  }
  @Get('properties/:id/status')
  async status(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-assessment-token') token: string,
  ) {
    return this.application.status(id, token);
  }
  @Get('properties/:id/report/value-signal')
  @UseGuards(OptionalStaffGuard)
  async signal(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-assessment-token') token: string,
    @Req() req: AuthRequest,
  ) {
    return this.application.signal(id, token, req.user);
  }
  @Get('properties/:id/report/full')
  @UseGuards(OptionalStaffGuard)
  async full(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-assessment-token') token: string,
    @Req() req: AuthRequest,
  ) {
    return this.application.full(id, token, req.user);
  }
  @Get('leads')
  @UseGuards(AuthGuard)
  leads(@Req() req: AuthRequest, @Query() query: LeadQueryDto) {
    return this.application.leads(req.user, query);
  }
  @Patch('leads/:id')
  @UseGuards(AuthGuard)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LeadUpdateDto,
    @Req() req: AuthRequest,
  ) {
    return this.application.update(id, dto, req.user);
  }
  @Post('leads/:id/review')
  @UseGuards(AuthGuard)
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.application.review(id, req.user);
  }
  @Post('reports/:id/release')
  @UseGuards(AuthGuard)
  async release(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.application.release(id, req.user);
  }
  @Post('leads/:id/retry-valuation')
  @UseGuards(AuthGuard)
  async retry(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.application.retry(id, req.user);
  }
}
