import { PropertyCondition, PropertyType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  ValidateIf,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
class AddressDto {
  @IsString() @IsNotEmpty() @MaxLength(200) street: string;
  @Matches(/^\d{5}$/) postalCode: string;
  @IsString() @IsNotEmpty() @MaxLength(100) city: string;
  @ValidateIf((_object, value) => value !== undefined)
  @Equals('DE')
  country?: string;
}
class SellerContactDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsEmail() @MaxLength(254) email: string;
  @ValidateIf((_object, value) => value !== undefined)
  @Matches(/^[+\d\s()-]{6,25}$/)
  phone?: string;
}
export class CreatePropertyDto {
  @IsDefined() @ValidateNested() @Type(() => AddressDto) address: AddressDto;
  @IsEnum(PropertyType) propertyType: PropertyType;
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(1000000)
  sizeSqm: number;
  @IsEnum(PropertyCondition) condition: PropertyCondition;
  @IsInt() @Min(1600) @Max(new Date().getFullYear() + 5) yearBuilt: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(100)
  rooms?: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(6)
  @IsIn(['BALCONY', 'GARDEN', 'PARKING', 'ELEVATOR', 'TERRACE', 'BASEMENT'], {
    each: true,
  })
  features?: string[];
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['ASAP', 'THREE_MONTHS', 'SIX_MONTHS', 'EXPLORING'])
  sellingTimeline?: string;
  @IsDefined()
  @ValidateNested()
  @Type(() => SellerContactDto)
  sellerContact: SellerContactDto;
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['de-DE', 'en', 'en-GB'])
  locale?: string;
  @Equals(true) dataProcessingConsent: boolean;
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  newsletterOptIn?: boolean;
}
