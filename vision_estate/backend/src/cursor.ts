import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class CursorQuery {
  @IsOptional() @IsString() @MaxLength(512) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
export function cursorWhere(query: CursorQuery, field = 'createdAt') {
  if (!query.cursor) return {};
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(query.cursor)) throw new Error();
    const value = JSON.parse(
      Buffer.from(query.cursor, 'base64url').toString('utf8'),
    );
    if (
      value.v !== 1 ||
      typeof value.id !== 'string' ||
      !/^[a-f0-9-]{36}$/i.test(value.id) ||
      typeof value.at !== 'string'
    )
      throw new Error();
    const date = new Date(value.at);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== value.at)
      throw new Error();
    return {
      OR: [{ [field]: { lt: date } }, { [field]: date, id: { lt: value.id } }],
    };
  } catch {
    throw new BadRequestException('Invalid pagination cursor.');
  }
}
export function cursorPage<T extends { id: string }>(
  rows: T[],
  limit: number,
  field = 'createdAt',
) {
  const data = rows.slice(0, limit),
    last = data[data.length - 1];
  const nextCursor =
    rows.length > limit && last
      ? Buffer.from(
          JSON.stringify({
            v: 1,
            id: last.id,
            at: new Date(last[field]).toISOString(),
          }),
        ).toString('base64url')
      : null;
  return { data, nextCursor };
}
