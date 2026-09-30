import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin-service';
import { AdminGuard, AuthGuard, AuthRequest } from './auth';
import { BookingService } from './booking-service';
import {
  ActiveDto,
  AssignDto,
  BookingDto,
  SlotDto,
  UserDto,
} from './operations.dto';
@Controller('v1/admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private application: AdminService) {}
  @Get('overview')
  async overview() {
    return this.application.overview();
  }
  @Post('users')
  async create(@Body() dto: UserDto, @Req() req: AuthRequest) {
    return this.application.create(dto, req.user);
  }
  @Patch('users/:id')
  async active(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActiveDto,
    @Req() req: AuthRequest,
  ) {
    return this.application.active(id, dto, req.user);
  }
  @Post('leads/:id/assign')
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDto,
    @Req() req: AuthRequest,
  ) {
    return this.application.assign(id, dto, req.user);
  }
}

@Controller('v1')
export class BookingController {
  constructor(private application: BookingService) {}
  @Get('broker/bookings')
  @UseGuards(AuthGuard)
  list(@Req() req: AuthRequest) {
    return this.application.list(req.user);
  }
  @Post('broker/slots')
  @UseGuards(AuthGuard)
  async slot(@Body() dto: SlotDto, @Req() req: AuthRequest) {
    return this.application.slot(dto, req.user);
  }
  @Get('properties/:id/slots')
  async slots(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-assessment-token') token: string,
  ) {
    return this.application.slots(id, token);
  }
  @Post('properties/:id/bookings')
  async book(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BookingDto,
    @Headers('x-assessment-token') token: string,
  ) {
    return this.application.book(id, dto, token);
  }
  @Get('properties/:id/bookings')
  async sellerBookings(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-assessment-token') token: string,
  ) {
    return this.application.sellerBookings(id, token);
  }
  @Post('properties/:id/bookings/cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-assessment-token') token: string,
  ) {
    return this.application.cancel(id, token);
  }
  @Post('bookings/:id/reconcile')
  @UseGuards(AuthGuard)
  async reconcile(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.application.reconcile(id, req.user);
  }
}
