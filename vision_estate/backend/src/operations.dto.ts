import { UserRole } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
export class UserDto {
  @IsEmail() email: string;
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsString() @MinLength(12) @MaxLength(128) password: string;
  @IsEnum(UserRole) role: UserRole;
}
export class AssignDto {
  @IsUUID() brokerId: string;
}
export class SlotDto {
  @IsISO8601() startsAt: string;
  @IsISO8601() endsAt: string;
}
export class BookingDto {
  @IsUUID() slotId: string;
}
export class ActiveDto {
  @IsBoolean() active: boolean;
}
