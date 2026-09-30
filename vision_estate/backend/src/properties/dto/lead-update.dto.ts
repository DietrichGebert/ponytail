import { IsIn, ValidateIf, IsString, MaxLength } from 'class-validator';
export class LeadUpdateDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['NEW', 'CONTACTED', 'QUALIFIED', 'CONSULTATION_BOOKED', 'WON', 'LOST'])
  stage?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
