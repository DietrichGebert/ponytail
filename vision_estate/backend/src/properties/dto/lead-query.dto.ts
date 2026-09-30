import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  ValidateIf,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const leadStages = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'CONSULTATION_BOOKED',
  'WON',
  'LOST',
] as const;
export class LeadQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(leadStages)
  stage?: (typeof leadStages)[number];
}
